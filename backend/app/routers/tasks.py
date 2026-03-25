import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskMove,
    TaskResponse,
)
from app.services.task_service import (
    create_task,
    get_workspace_tasks,
    get_task_by_id,
    update_task,
    move_task,
    delete_task,
)
from app.services.workspace_service import require_membership
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter(tags=["Tasks"])


@router.post(
    "/api/workspaces/{workspace_id}/tasks",
    response_model=TaskResponse,
    status_code=201,
)
async def create_task_endpoint(
    workspace_id: uuid.UUID,
    data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await create_task(
        db,
        workspace_id,
        current_user.id,
        data.title,
        data.description,
        data.status,
        data.assigned_to,
        data.position,
    )
    return TaskResponse.model_validate(task)


@router.get(
    "/api/workspaces/{workspace_id}/tasks",
    response_model=list[TaskResponse],
)
async def list_tasks(
    workspace_id: uuid.UUID,
    status: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tasks = await get_workspace_tasks(db, workspace_id, current_user.id, status)
    return [TaskResponse(**t) for t in tasks]


@router.get("/api/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await get_task_by_id(db, task_id)
    if not task:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Task not found")
    await require_membership(db, task.workspace_id, current_user.id)
    return TaskResponse.model_validate(task)


@router.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task_endpoint(
    task_id: uuid.UUID,
    data: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await update_task(
        db,
        task_id,
        current_user.id,
        data.version,
        data.title,
        data.description,
        data.status,
        data.assigned_to,
        data.position,
    )
    return TaskResponse.model_validate(task)


@router.patch("/api/tasks/{task_id}/move", response_model=TaskResponse)
async def move_task_endpoint(
    task_id: uuid.UUID,
    data: TaskMove,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await move_task(
        db, task_id, current_user.id, data.status, data.position, data.version
    )
    return TaskResponse.model_validate(task)


@router.delete("/api/tasks/{task_id}", status_code=204)
async def delete_task_endpoint(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_task(db, task_id, current_user.id)
