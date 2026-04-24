import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.comment import CommentCreate, CommentResponse
from app.services.comment_service import create_comment, get_task_comments, delete_comment
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/tasks", tags=["Comments"])


@router.post("/{task_id}/comments", response_model=CommentResponse, status_code=201)
async def add_comment(
    task_id: uuid.UUID,
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_comment(db, task_id, current_user.id, data.content)


@router.get("/{task_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_task_comments(db, task_id, current_user.id)


@router.delete("/comments/{comment_id}", status_code=204)
async def remove_comment(
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_comment(db, comment_id, current_user.id)
