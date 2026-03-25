import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceResponse,
    MemberAdd,
    MemberUpdateRole,
    MemberResponse,
)
from app.services.workspace_service import (
    create_workspace,
    get_user_workspaces,
    get_workspace_by_id,
    update_workspace,
    delete_workspace,
    add_member,
    update_member_role,
    remove_member,
    get_workspace_members,
    require_membership,
)
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/workspaces", tags=["Workspaces"])


@router.post("", response_model=WorkspaceResponse, status_code=201)
async def create_workspace_endpoint(
    data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await create_workspace(
        db, data.name, current_user.id, data.description
    )
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        owner_id=workspace.owner_id,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
        member_count=1,
        my_role="admin",
    )


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspaces = await get_user_workspaces(db, current_user.id)
    return [WorkspaceResponse(**w) for w in workspaces]


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = await require_membership(db, workspace_id, current_user.id)
    workspace = await get_workspace_by_id(db, workspace_id)
    if not workspace:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Workspace not found")

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        owner_id=workspace.owner_id,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
        my_role=role.value if hasattr(role, "value") else str(role),
    )


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace_endpoint(
    workspace_id: uuid.UUID,
    data: WorkspaceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await update_workspace(
        db, workspace_id, current_user.id, data.name, data.description
    )
    return WorkspaceResponse.model_validate(workspace)


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace_endpoint(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_workspace(db, workspace_id, current_user.id)


# --- Members ---

@router.get("/{workspace_id}/members", response_model=list[MemberResponse])
async def list_members(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_membership(db, workspace_id, current_user.id)
    members = await get_workspace_members(db, workspace_id)
    return [MemberResponse(**m) for m in members]


@router.post("/{workspace_id}/members", response_model=MemberResponse, status_code=201)
async def add_member_endpoint(
    workspace_id: uuid.UUID,
    data: MemberAdd,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member = await add_member(
        db, workspace_id, current_user.id, data.email, data.role
    )
    return MemberResponse(
        user_id=member.user_id,
        workspace_id=member.workspace_id,
        role=member.role,
        joined_at=member.joined_at,
    )


@router.put("/{workspace_id}/members/{user_id}", response_model=MemberResponse)
async def update_member_role_endpoint(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    data: MemberUpdateRole,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member = await update_member_role(
        db, workspace_id, current_user.id, user_id, data.role
    )
    return MemberResponse(
        user_id=member.user_id,
        workspace_id=member.workspace_id,
        role=member.role,
        joined_at=member.joined_at,
    )


@router.delete("/{workspace_id}/members/{user_id}", status_code=204)
async def remove_member_endpoint(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await remove_member(db, workspace_id, current_user.id, user_id)
