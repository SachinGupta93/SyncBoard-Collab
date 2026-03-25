import uuid
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.utils.security import decode_access_token
from app.models.user import User
from app.models.workspace import MemberRole
from app.services.workspace_service import get_member_role
from app.websocket.manager import manager
from sqlalchemy import select

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/{workspace_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    workspace_id: uuid.UUID,
    token: str = Query(...),
):
    """
    WebSocket endpoint for real-time workspace updates.
    Authentication happens during the handshake via query param token.
    """
    # Authenticate
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4001, reason="Invalid token payload")
        return

    # Verify workspace membership
    async with AsyncSessionLocal() as db:
        role = await get_member_role(db, workspace_id, uuid.UUID(user_id))
        if role is None:
            await websocket.close(code=4003, reason="Not a workspace member")
            return

        # Get user info
        result = await db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user = result.scalar_one_or_none()
        if not user:
            await websocket.close(code=4001, reason="User not found")
            return

        user_display_name = user.display_name
        is_viewer = role == MemberRole.VIEWER

    workspace_id_str = str(workspace_id)

    await manager.connect(websocket, workspace_id_str, user_id, user_display_name)

    try:
        while True:
            data = await websocket.receive_text()

            # Viewers cannot send mutations
            if is_viewer:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Viewers cannot send mutations",
                }))
                continue

            try:
                message = json.loads(data)
                msg_type = message.get("type")

                if msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

                elif msg_type == "cursor_position":
                    # Broadcast cursor position to others
                    await manager.broadcast_to_room(
                        workspace_id_str,
                        {
                            "type": "cursor_update",
                            "user_id": user_id,
                            "display_name": user_display_name,
                            "position": message.get("position"),
                        },
                        exclude_user=user_id,
                    )

                else:
                    logger.debug(f"Unknown message type: {msg_type}")

            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON",
                }))

    except WebSocketDisconnect:
        await manager.disconnect(websocket, workspace_id_str, user_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await manager.disconnect(websocket, workspace_id_str, user_id)
