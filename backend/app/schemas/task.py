import uuid
from datetime import datetime
from pydantic import BaseModel, Field


VALID_STATUSES = ["todo", "in_progress", "done", "review"]


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    status: str = "todo"
    assigned_to: uuid.UUID | None = None
    position: int = 0


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=300)
    description: str | None = None
    status: str | None = None
    assigned_to: uuid.UUID | None = None
    position: int | None = None
    version: int  # Required for conflict resolution


class TaskMove(BaseModel):
    status: str
    position: int
    version: int  # Required for conflict resolution


class TaskResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    title: str
    description: str | None = None
    status: str
    assigned_to: uuid.UUID | None = None
    position: int
    version: int
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    assignee_name: str | None = None
    creator_name: str | None = None

    model_config = {"from_attributes": True}
