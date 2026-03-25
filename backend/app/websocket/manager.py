import uuid
import json
import asyncio
import logging
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections organized by workspace rooms.
    Broadcasting works locally for the current backend instance.
    """

    def __init__(self):
        # workspace_id -> set of (user_id, websocket)
        self._rooms: dict[str, set[tuple[str, WebSocket]]] = {}
        self._user_info: dict[str, dict] = {}  # user_id -> {display_name, email}

    async def connect(
        self,
        websocket: WebSocket,
        workspace_id: str,
        user_id: str,
        user_display_name: str,
    ):
        """Accept connection and add to room."""
        await websocket.accept()

        if workspace_id not in self._rooms:
            self._rooms[workspace_id] = set()

        self._rooms[workspace_id].add((user_id, websocket))
        self._user_info[user_id] = {"display_name": user_display_name}

        # Broadcast presence update
        await self.broadcast_to_room(
            workspace_id,
            {
                "type": "presence",
                "action": "joined",
                "user_id": user_id,
                "display_name": user_display_name,
                "online_users": self._get_online_users(workspace_id),
            },
            exclude_user=None,  # Send to everyone including the joiner
        )

        logger.info(f"User {user_id} connected to workspace {workspace_id}")

    async def disconnect(self, websocket: WebSocket, workspace_id: str, user_id: str):
        """Remove connection from room."""
        if workspace_id in self._rooms:
            self._rooms[workspace_id].discard((user_id, websocket))

            if not self._rooms[workspace_id]:
                del self._rooms[workspace_id]

        display_name = self._user_info.get(user_id, {}).get("display_name", "Unknown")

        # Broadcast presence update
        await self.broadcast_to_room(
            workspace_id,
            {
                "type": "presence",
                "action": "left",
                "user_id": user_id,
                "display_name": display_name,
                "online_users": self._get_online_users(workspace_id),
            },
        )

        logger.info(f"User {user_id} disconnected from workspace {workspace_id}")

    def _get_online_users(self, workspace_id: str) -> list[dict]:
        """Get list of online users in a workspace."""
        if workspace_id not in self._rooms:
            return []

        seen = set()
        users = []
        for uid, _ in self._rooms[workspace_id]:
            if uid not in seen:
                seen.add(uid)
                info = self._user_info.get(uid, {})
                users.append({
                    "user_id": uid,
                    "display_name": info.get("display_name", "Unknown"),
                })
        return users

    async def broadcast_to_room(
        self,
        workspace_id: str,
        message: dict,
        exclude_user: str | None = None,
    ):
        """Send message to all connections in a workspace room."""
        if workspace_id not in self._rooms:
            return

        dead_connections = []
        payload = json.dumps(message)

        for user_id, ws in self._rooms[workspace_id]:
            if exclude_user and user_id == exclude_user:
                continue
            try:
                await ws.send_text(payload)
            except Exception:
                dead_connections.append((user_id, ws))

        # Clean up dead connections
        for conn in dead_connections:
            self._rooms[workspace_id].discard(conn)

    async def publish_event(self, workspace_id: str, event: dict):
        """Broadcast event locally to connected websockets."""
        await self.broadcast_to_room(workspace_id, event)


# Singleton instance
manager = ConnectionManager()
