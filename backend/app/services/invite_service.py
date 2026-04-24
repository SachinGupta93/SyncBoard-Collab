import uuid
import secrets
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.models.invite import WorkspaceInvite
from app.models.workspace import Workspace, WorkspaceMember, MemberRole
from app.models.user import User
from app.services.workspace_service import require_membership


async def create_invite(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    inviter_id: uuid.UUID,
    email: str,
    role: str = "viewer",
) -> dict:
    await require_membership(db, workspace_id, inviter_id, MemberRole.ADMIN)

    # Check if invite already exists and is pending
    result = await db.execute(
        select(WorkspaceInvite).where(
            WorkspaceInvite.workspace_id == workspace_id,
            WorkspaceInvite.email == email,
            WorkspaceInvite.status == "pending",
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Invite already sent to this email")

    token = secrets.token_urlsafe(32)
    invite = WorkspaceInvite(
        workspace_id=workspace_id,
        email=email,
        role=role,
        token=token,
        invited_by=inviter_id,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    return await _enrich_invite(db, invite)


async def get_workspace_invites(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID
) -> list[dict]:
    await require_membership(db, workspace_id, user_id, MemberRole.ADMIN)

    result = await db.execute(
        select(WorkspaceInvite)
        .where(WorkspaceInvite.workspace_id == workspace_id)
        .order_by(WorkspaceInvite.created_at.desc())
    )
    invites = result.scalars().all()
    return [await _enrich_invite(db, inv) for inv in invites]


async def get_invite_by_token(db: AsyncSession, token: str) -> dict | None:
    result = await db.execute(
        select(WorkspaceInvite).where(WorkspaceInvite.token == token)
    )
    invite = result.scalar_one_or_none()
    if not invite:
        return None
    return await _enrich_invite(db, invite)


async def accept_invite(
    db: AsyncSession, token: str, user_id: uuid.UUID
) -> dict:
    result = await db.execute(
        select(WorkspaceInvite).where(WorkspaceInvite.token == token)
    )
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.status != "pending":
        raise HTTPException(status_code=400, detail=f"Invite is already {invite.status}")

    # Check if already a member
    existing = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == invite.workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    if existing.scalar_one_or_none():
        invite.status = "accepted"
        invite.accepted_at = datetime.now(timezone.utc)
        await db.commit()
        return await _enrich_invite(db, invite)

    # Add as member
    role_enum = MemberRole(invite.role) if invite.role in [r.value for r in MemberRole] else MemberRole.VIEWER
    member = WorkspaceMember(
        workspace_id=invite.workspace_id,
        user_id=user_id,
        role=role_enum,
    )
    db.add(member)

    invite.status = "accepted"
    invite.accepted_at = datetime.now(timezone.utc)
    await db.commit()

    return await _enrich_invite(db, invite)


async def revoke_invite(
    db: AsyncSession, invite_id: uuid.UUID, user_id: uuid.UUID
):
    result = await db.execute(
        select(WorkspaceInvite).where(WorkspaceInvite.id == invite_id)
    )
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    await require_membership(db, invite.workspace_id, user_id, MemberRole.ADMIN)

    await db.delete(invite)
    await db.commit()


async def _enrich_invite(db: AsyncSession, invite: WorkspaceInvite) -> dict:
    ws_result = await db.execute(
        select(Workspace.name).where(Workspace.id == invite.workspace_id)
    )
    workspace_name = ws_result.scalar_one_or_none()

    inviter_result = await db.execute(
        select(User.display_name).where(User.id == invite.invited_by)
    )
    inviter_name = inviter_result.scalar_one_or_none()

    return {
        "id": invite.id,
        "workspace_id": invite.workspace_id,
        "email": invite.email,
        "role": invite.role,
        "token": invite.token,
        "status": invite.status,
        "invited_by": invite.invited_by,
        "created_at": invite.created_at,
        "accepted_at": invite.accepted_at,
        "workspace_name": workspace_name,
        "inviter_name": inviter_name,
    }
