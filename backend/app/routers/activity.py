import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas.activity import ActivityLogResponse
from app.models.activity import ActivityLog
from app.models.user import User
from app.models.task import Task
from app.services.workspace_service import require_membership
from app.middleware.auth import get_current_user

router = APIRouter(tags=["Activity"])


@router.get(
    "/api/workspaces/{workspace_id}/activity",
    response_model=list[ActivityLogResponse],
)
async def get_workspace_activity(
    workspace_id: uuid.UUID,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_membership(db, workspace_id, current_user.id)

    stmt = (
        select(ActivityLog, User.display_name, Task.title)
        .join(User, ActivityLog.user_id == User.id)
        .outerjoin(Task, ActivityLog.task_id == Task.id)
        .where(ActivityLog.workspace_id == workspace_id)
        .order_by(ActivityLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        ActivityLogResponse(
            id=log.id,
            task_id=log.task_id,
            workspace_id=log.workspace_id,
            user_id=log.user_id,
            action_type=log.action_type,
            details=log.details,
            created_at=log.created_at,
            user_display_name=user_name,
            task_title=task_title,
        )
        for log, user_name, task_title in rows
    ]


@router.get(
    "/api/tasks/{task_id}/activity",
    response_model=list[ActivityLogResponse],
)
async def get_task_activity(
    task_id: uuid.UUID,
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify task exists and user has access
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if not task:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Task not found")

    await require_membership(db, task.workspace_id, current_user.id)

    stmt = (
        select(ActivityLog, User.display_name)
        .join(User, ActivityLog.user_id == User.id)
        .where(ActivityLog.task_id == task_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        ActivityLogResponse(
            id=log.id,
            task_id=log.task_id,
            workspace_id=log.workspace_id,
            user_id=log.user_id,
            action_type=log.action_type,
            details=log.details,
            created_at=log.created_at,
            user_display_name=user_name,
            task_title=task.title,
        )
        for log, user_name in rows
    ]
