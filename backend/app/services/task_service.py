import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from app.models.task import Task
from app.models.user import User
from app.models.activity import ActivityLog
from app.models.workspace import MemberRole
from app.services.workspace_service import require_membership


async def create_task(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    title: str,
    description: str | None = None,
    task_status: str = "todo",
    assigned_to: uuid.UUID | None = None,
    position: int = 0,
) -> Task:
    await require_membership(db, workspace_id, user_id, MemberRole.EDITOR)

    task = Task(
        workspace_id=workspace_id,
        title=title,
        description=description,
        status=task_status,
        assigned_to=assigned_to,
        position=position,
        created_by=user_id,
    )
    db.add(task)
    await db.flush()

    log = ActivityLog(
        task_id=task.id,
        workspace_id=workspace_id,
        user_id=user_id,
        action_type="task_created",
        details={"title": title, "status": task_status},
    )
    db.add(log)

    await db.commit()
    await db.refresh(task)
    return task


async def get_workspace_tasks(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    status_filter: str | None = None,
) -> list[dict]:
    await require_membership(db, workspace_id, user_id)

    stmt = select(Task).where(Task.workspace_id == workspace_id)
    if status_filter:
        stmt = stmt.where(Task.status == status_filter)
    stmt = stmt.order_by(Task.status, Task.position, Task.created_at)

    result = await db.execute(stmt)
    tasks = result.scalars().all()

    task_list = []
    for task in tasks:
        # Fetch assignee and creator names
        assignee_name = None
        creator_name = None

        if task.assigned_to:
            assignee_result = await db.execute(
                select(User.display_name).where(User.id == task.assigned_to)
            )
            assignee_name = assignee_result.scalar_one_or_none()

        creator_result = await db.execute(
            select(User.display_name).where(User.id == task.created_by)
        )
        creator_name = creator_result.scalar_one_or_none()

        task_list.append({
            "id": task.id,
            "workspace_id": task.workspace_id,
            "title": task.title,
            "description": task.description,
            "status": task.status,
            "assigned_to": task.assigned_to,
            "position": task.position,
            "version": task.version,
            "created_by": task.created_by,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
            "assignee_name": assignee_name,
            "creator_name": creator_name,
        })
    return task_list


async def get_task_by_id(db: AsyncSession, task_id: uuid.UUID) -> Task | None:
    result = await db.execute(select(Task).where(Task.id == task_id))
    return result.scalar_one_or_none()


async def update_task(
    db: AsyncSession,
    task_id: uuid.UUID,
    user_id: uuid.UUID,
    version: int,
    title: str | None = None,
    description: str | None = None,
    task_status: str | None = None,
    assigned_to: uuid.UUID | None = None,
    position: int | None = None,
) -> Task:
    task = await get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await require_membership(db, task.workspace_id, user_id, MemberRole.EDITOR)

    # Version conflict check
    if task.version != version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Task has been modified by another user. Please refresh and try again.",
                "current_version": task.version,
                "your_version": version,
            },
        )

    changes = {}
    if title is not None and title != task.title:
        changes["title"] = {"from": task.title, "to": title}
        task.title = title
    if description is not None and description != task.description:
        changes["description"] = {"from": task.description, "to": description}
        task.description = description
    if task_status is not None and task_status != task.status:
        changes["status"] = {"from": task.status, "to": task_status}
        task.status = task_status
    if assigned_to is not None and assigned_to != task.assigned_to:
        changes["assigned_to"] = {
            "from": str(task.assigned_to) if task.assigned_to else None,
            "to": str(assigned_to),
        }
        task.assigned_to = assigned_to
    if position is not None and position != task.position:
        changes["position"] = {"from": task.position, "to": position}
        task.position = position

    task.version += 1
    task.updated_at = datetime.now(timezone.utc)

    if changes:
        log = ActivityLog(
            task_id=task.id,
            workspace_id=task.workspace_id,
            user_id=user_id,
            action_type="task_updated",
            details=changes,
        )
        db.add(log)

    await db.commit()
    await db.refresh(task)
    return task


async def move_task(
    db: AsyncSession,
    task_id: uuid.UUID,
    user_id: uuid.UUID,
    new_status: str,
    new_position: int,
    version: int,
) -> Task:
    task = await get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await require_membership(db, task.workspace_id, user_id, MemberRole.EDITOR)

    # Version conflict check
    if task.version != version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Task has been modified by another user. Please refresh and try again.",
                "current_version": task.version,
                "your_version": version,
            },
        )

    old_status = task.status
    old_position = task.position

    task.status = new_status
    task.position = new_position
    task.version += 1
    task.updated_at = datetime.now(timezone.utc)

    log = ActivityLog(
        task_id=task.id,
        workspace_id=task.workspace_id,
        user_id=user_id,
        action_type="task_moved",
        details={
            "status": {"from": old_status, "to": new_status},
            "position": {"from": old_position, "to": new_position},
        },
    )
    db.add(log)

    await db.commit()
    await db.refresh(task)
    return task


async def delete_task(
    db: AsyncSession,
    task_id: uuid.UUID,
    user_id: uuid.UUID,
):
    task = await get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await require_membership(db, task.workspace_id, user_id, MemberRole.EDITOR)

    log = ActivityLog(
        task_id=None,  # Task is being deleted
        workspace_id=task.workspace_id,
        user_id=user_id,
        action_type="task_deleted",
        details={"title": task.title, "status": task.status},
    )
    db.add(log)

    await db.delete(task)
    await db.commit()
