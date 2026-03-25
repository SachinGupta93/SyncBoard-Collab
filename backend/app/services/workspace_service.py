import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.models.workspace import Workspace, WorkspaceMember, MemberRole
from app.models.user import User
from app.models.activity import ActivityLog


async def create_workspace(
    db: AsyncSession,
    name: str,
    owner_id: uuid.UUID,
    description: str | None = None,
) -> Workspace:
    workspace = Workspace(name=name, description=description, owner_id=owner_id)
    db.add(workspace)
    await db.flush()

    # Auto-add owner as admin member
    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=owner_id,
        role=MemberRole.ADMIN,
    )
    db.add(member)

    # Log activity
    log = ActivityLog(
        workspace_id=workspace.id,
        user_id=owner_id,
        action_type="workspace_created",
        details={"workspace_name": name},
    )
    db.add(log)

    await db.commit()
    await db.refresh(workspace)
    return workspace


async def get_user_workspaces(
    db: AsyncSession, user_id: uuid.UUID
) -> list[dict]:
    """Get all workspaces the user is a member of, with role and member count."""
    stmt = (
        select(
            Workspace,
            WorkspaceMember.role,
            func.count(WorkspaceMember.user_id).over(
                partition_by=WorkspaceMember.workspace_id
            ).label("member_count"),
        )
        .join(WorkspaceMember, Workspace.id == WorkspaceMember.workspace_id)
        .where(WorkspaceMember.user_id == user_id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    workspaces = []
    for workspace, role, member_count in rows:
        workspaces.append({
            "id": workspace.id,
            "name": workspace.name,
            "description": workspace.description,
            "owner_id": workspace.owner_id,
            "created_at": workspace.created_at,
            "updated_at": workspace.updated_at,
            "member_count": member_count,
            "my_role": role.value if isinstance(role, MemberRole) else role,
        })
    return workspaces


async def get_workspace_by_id(
    db: AsyncSession, workspace_id: uuid.UUID
) -> Workspace | None:
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    return result.scalar_one_or_none()


async def get_member_role(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID
) -> MemberRole | None:
    result = await db.execute(
        select(WorkspaceMember.role).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    role = result.scalar_one_or_none()
    return role


async def require_membership(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    minimum_role: MemberRole | None = None,
) -> MemberRole:
    """Verify user is a workspace member and optionally check minimum role."""
    role = await get_member_role(db, workspace_id, user_id)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this workspace",
        )

    role_hierarchy = {
        MemberRole.VIEWER: 0,
        MemberRole.EDITOR: 1,
        MemberRole.ADMIN: 2,
    }

    if minimum_role and role_hierarchy.get(role, 0) < role_hierarchy.get(minimum_role, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires at least {minimum_role.value} role",
        )

    return role


async def update_workspace(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    name: str | None = None,
    description: str | None = None,
) -> Workspace:
    await require_membership(db, workspace_id, user_id, MemberRole.ADMIN)

    workspace = await get_workspace_by_id(db, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if name is not None:
        workspace.name = name
    if description is not None:
        workspace.description = description
    workspace.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(workspace)
    return workspace


async def delete_workspace(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID
):
    await require_membership(db, workspace_id, user_id, MemberRole.ADMIN)

    workspace = await get_workspace_by_id(db, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    await db.delete(workspace)
    await db.commit()


async def add_member(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    adder_id: uuid.UUID,
    target_email: str,
    role: MemberRole,
) -> WorkspaceMember:
    await require_membership(db, workspace_id, adder_id, MemberRole.ADMIN)

    # Find target user
    result = await db.execute(select(User).where(User.email == target_email))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found with that email")

    # Check if already a member
    existing = await get_member_role(db, workspace_id, target_user.id)
    if existing is not None:
        raise HTTPException(status_code=409, detail="User is already a member")

    member = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=target_user.id,
        role=role,
    )
    db.add(member)

    # Log activity
    log = ActivityLog(
        workspace_id=workspace_id,
        user_id=adder_id,
        action_type="member_added",
        details={"added_user": target_user.email, "role": role.value},
    )
    db.add(log)

    await db.commit()
    await db.refresh(member)
    return member


async def update_member_role(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    updater_id: uuid.UUID,
    target_user_id: uuid.UUID,
    new_role: MemberRole,
) -> WorkspaceMember:
    await require_membership(db, workspace_id, updater_id, MemberRole.ADMIN)

    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == target_user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.role = new_role

    log = ActivityLog(
        workspace_id=workspace_id,
        user_id=updater_id,
        action_type="role_changed",
        details={"target_user_id": str(target_user_id), "new_role": new_role.value},
    )
    db.add(log)

    await db.commit()
    await db.refresh(member)
    return member


async def remove_member(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    remover_id: uuid.UUID,
    target_user_id: uuid.UUID,
):
    await require_membership(db, workspace_id, remover_id, MemberRole.ADMIN)

    # Prevent removing the workspace owner
    workspace = await get_workspace_by_id(db, workspace_id)
    if workspace and workspace.owner_id == target_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the workspace owner",
        )

    result = await db.execute(
        delete(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == target_user_id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Member not found")

    log = ActivityLog(
        workspace_id=workspace_id,
        user_id=remover_id,
        action_type="member_removed",
        details={"removed_user_id": str(target_user_id)},
    )
    db.add(log)
    await db.commit()


async def get_workspace_members(
    db: AsyncSession, workspace_id: uuid.UUID
) -> list[dict]:
    stmt = (
        select(WorkspaceMember, User)
        .join(User, WorkspaceMember.user_id == User.id)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.joined_at)
    )
    result = await db.execute(stmt)
    rows = result.all()

    members = []
    for member, user in rows:
        members.append({
            "user_id": member.user_id,
            "workspace_id": member.workspace_id,
            "role": member.role,
            "joined_at": member.joined_at,
            "user_email": user.email,
            "user_display_name": user.display_name,
        })
    return members
