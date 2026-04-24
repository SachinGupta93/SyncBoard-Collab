import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.invite import InviteCreate, InviteResponse
from app.services.invite_service import (
    create_invite, get_workspace_invites, get_invite_by_token,
    accept_invite, revoke_invite,
)
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api", tags=["Invites"])


@router.post("/workspaces/{workspace_id}/invites", response_model=InviteResponse, status_code=201)
async def create_invite_endpoint(
    workspace_id: uuid.UUID,
    data: InviteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_invite(db, workspace_id, current_user.id, data.email, data.role)


@router.get("/workspaces/{workspace_id}/invites", response_model=list[InviteResponse])
async def list_invites(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_workspace_invites(db, workspace_id, current_user.id)


@router.get("/invites/{token}")
async def get_invite_info(token: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint — get invite info by token (no auth required to view)."""
    invite = await get_invite_by_token(db, token)
    if not invite:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Invite not found or expired")
    return invite


@router.post("/invites/{token}/accept", response_model=InviteResponse)
async def accept_invite_endpoint(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await accept_invite(db, token, current_user.id)


@router.delete("/invites/{invite_id}", status_code=204)
async def revoke_invite_endpoint(
    invite_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await revoke_invite(db, invite_id, current_user.id)
