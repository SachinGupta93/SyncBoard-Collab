import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.models.comment import Comment
from app.models.user import User
from app.models.task import Task
from app.services.workspace_service import require_membership


async def create_comment(
    db: AsyncSession, task_id: uuid.UUID, user_id: uuid.UUID, content: str
) -> dict:
    task = await db.execute(select(Task).where(Task.id == task_id))
    task = task.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await require_membership(db, task.workspace_id, user_id)

    comment = Comment(task_id=task_id, user_id=user_id, content=content)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    user = await db.execute(select(User.display_name).where(User.id == user_id))
    display_name = user.scalar_one_or_none()

    return {**_to_dict(comment), "user_display_name": display_name}


async def get_task_comments(
    db: AsyncSession, task_id: uuid.UUID, user_id: uuid.UUID
) -> list[dict]:
    task = await db.execute(select(Task).where(Task.id == task_id))
    task = task.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await require_membership(db, task.workspace_id, user_id)

    result = await db.execute(
        select(Comment).where(Comment.task_id == task_id).order_by(Comment.created_at)
    )
    comments = result.scalars().all()

    comment_list = []
    for c in comments:
        user_result = await db.execute(
            select(User.display_name).where(User.id == c.user_id)
        )
        name = user_result.scalar_one_or_none()
        comment_list.append({**_to_dict(c), "user_display_name": name})

    return comment_list


async def delete_comment(
    db: AsyncSession, comment_id: uuid.UUID, user_id: uuid.UUID
):
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.user_id != user_id:
        raise HTTPException(status_code=403, detail="Can only delete your own comments")

    await db.delete(comment)
    await db.commit()


def _to_dict(comment: Comment) -> dict:
    return {
        "id": comment.id,
        "task_id": comment.task_id,
        "user_id": comment.user_id,
        "content": comment.content,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
    }
