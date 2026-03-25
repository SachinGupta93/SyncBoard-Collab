import uuid
from datetime import datetime
from pydantic import BaseModel


class ActivityLogResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID | None = None
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    action_type: str
    details: dict | None = None
    created_at: datetime
    user_display_name: str | None = None
    task_title: str | None = None

    model_config = {"from_attributes": True}
