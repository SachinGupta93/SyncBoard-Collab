import uuid
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr


class InviteCreate(BaseModel):
    email: EmailStr
    role: str = "viewer"


class InviteResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    email: str
    role: str
    token: str
    status: str
    invited_by: uuid.UUID
    created_at: datetime
    accepted_at: datetime | None = None
    workspace_name: str | None = None
    inviter_name: str | None = None

    model_config = {"from_attributes": True}
