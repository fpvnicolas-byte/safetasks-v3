"""
WebSocket Connection Manager for real-time notifications.

Manages WebSocket connections per user, allowing targeted message delivery
when notifications are created.
"""

import json
import logging
from typing import Dict, List, Optional, Any
from uuid import UUID
from fastapi import WebSocket
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class ConnectionInfo:
    """Information about a WebSocket connection."""
    websocket: WebSocket
    organization_id: UUID
    profile_id: UUID
    connected_at: datetime = field(default_factory=datetime.utcnow)


class NotificationConnectionManager:
    """
    Manages WebSocket connections for real-time notifications.
    
    Connections are tracked by (organization_id, profile_id) tuple,
    allowing multiple connections per user (e.g., multiple browser tabs).
    """
    
    def __init__(self):
        # Map of (org_id, profile_id) -> list of connections
        self._connections: Dict[tuple, List[ConnectionInfo]] = {}
        self._active_count = 0
    
    async def connect(
        self,
        websocket: WebSocket,
        organization_id: UUID,
        profile_id: UUID
    ) -> None:
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        
        key = (str(organization_id), str(profile_id))
        connection = ConnectionInfo(
            websocket=websocket,
            organization_id=organization_id,
            profile_id=profile_id
        )
        
        if key not in self._connections:
            self._connections[key] = []
        
        self._connections[key].append(connection)
        self._active_count += 1
        
        logger.info(
            f"WebSocket connected: user={profile_id}, org={organization_id}. "
            f"Total connections: {self._active_count}"
        )
    
    def disconnect(
        self,
        websocket: WebSocket,
        organization_id: UUID,
        profile_id: UUID
    ) -> None:
        """Remove a WebSocket connection."""
        key = (str(organization_id), str(profile_id))
        
        if key in self._connections:
            self._connections[key] = [
                conn for conn in self._connections[key] 
                if conn.websocket != websocket
            ]
            self._active_count -= 1
            
            # Clean up empty lists
            if not self._connections[key]:
                del self._connections[key]
        
        logger.info(
            f"WebSocket disconnected: user={profile_id}, org={organization_id}. "
            f"Total connections: {self._active_count}"
        )
    
    async def send_to_user(
        self,
        organization_id: UUID,
        profile_id: UUID,
        message: Dict[str, Any]
    ) -> int:
        """
        Send a message to all connections for a specific user.
        Returns the number of connections that received the message.
        """
        key = (str(organization_id), str(profile_id))
        
        if key not in self._connections:
            return 0
        
        sent_count = 0
        dead_connections = []
        
        for conn in self._connections[key]:
            try:
                await conn.websocket.send_json(message)
                sent_count += 1
            except Exception as e:
                logger.warning(f"Failed to send WebSocket message: {e}")
                dead_connections.append(conn)
        
        # Clean up dead connections
        for conn in dead_connections:
            self.disconnect(conn.websocket, organization_id, profile_id)
        
        return sent_count
    
    async def broadcast_notification(
        self,
        organization_id: UUID,
        profile_id: UUID,
        notification_data: Dict[str, Any]
    ) -> int:
        """
        Broadcast a new notification to a user's connections.
        
        Args:
            organization_id: The organization ID
            profile_id: The user's profile ID
            notification_data: The notification data to send
            
        Returns:
            Number of connections that received the notification
        """
        message = {
            "type": "notification",
            "action": "new",
            "data": notification_data
        }
        
        return await self.send_to_user(organization_id, profile_id, message)
    
    async def broadcast_notification_update(
        self,
        organization_id: UUID,
        profile_id: UUID,
        action: str = "refresh"
    ) -> int:
        """
        Broadcast a notification update signal (e.g., after delete or mark as read).
        
        Args:
            organization_id: The organization ID
            profile_id: The user's profile ID
            action: The action type (refresh, deleted, read, etc.)
            
        Returns:
            Number of connections that received the update
        """
        message = {
            "type": "notification",
            "action": action
        }
        
        return await self.send_to_user(organization_id, profile_id, message)
    
    def get_connection_count(self) -> int:
        """Get the total number of active connections."""
        return self._active_count
    
    def get_user_connection_count(
        self,
        organization_id: UUID,
        profile_id: UUID
    ) -> int:
        """Get the number of connections for a specific user."""
        key = (str(organization_id), str(profile_id))
        return len(self._connections.get(key, []))


# Global connection manager instance
notification_ws_manager = NotificationConnectionManager()
