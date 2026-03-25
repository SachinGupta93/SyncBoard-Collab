import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.workspace import MemberRole


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=1000)


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=1000)


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    member_count: int | None = None
    my_role: str | None = None

    model_config = {"from_attributes": True}


class MemberAdd(BaseModel):
    email: str
    role: MemberRole = MemberRole.VIEWER


class MemberUpdateRole(BaseModel):
    role: MemberRole


class MemberResponse(BaseModel):
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    role: MemberRole
    joined_at: datetime
    user_email: str | None = None
    user_display_name: str | None = None

    model_config = {"from_attributes": True}
