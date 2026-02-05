import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.api.v1.api import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# ROBUSTNESS FIX: Clean API_V1_STR to handle potential quote injection and ensure format
api_v1_str = settings.API_V1_STR
if api_v1_str:
    api_v1_str = api_v1_str.strip('"').strip("'")
    if not api_v1_str.startswith("/"):
        api_v1_str = f"/{api_v1_str}"

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="3.0.6",
    openapi_url=f"{api_v1_str}/openapi.json",
    description="""
    Safe Tasks V3 - Professional Video Production Management Platform

    A comprehensive backend system for audiovisual production management,
    featuring multi-tenant architecture, advanced financial tracking,
    equipment lifecycle management, and automated cloud synchronization.

    ## Key Features
    - **Multi-tenant Organizations**: Complete data isolation per client
    - **Financial Management**: Revenue tracking, expense management, profit analysis
    - **Production Workflow**: Project management, script breakdown, scheduling
    - **Equipment Lifecycle**: Asset tracking, maintenance scheduling, health monitoring
    - **Cloud Integration**: Automated Google Drive sync for production files
    - **Executive Dashboard**: Real-time business metrics and analytics

    ## Authentication
    All endpoints require Bearer token authentication via Supabase Auth.

    ## Organization Isolation
    All data is strictly isolated by `organization_id` for multi-tenant security.
    """,
    contact={
        "name": "Safe Tasks Development Team",
        "email": "dev@safetasks.com",
    },
    license_info={
        "name": "Proprietary",
    },
)

# Add logging middleware 
@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"DEBUG_PATH_CHECK: {request.method} {request.url.path}", flush=True)
    response = await call_next(request)
    return response

# Add rate limiting middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Set up CORS for production security
allowed_origins = [
    # Production - Vercel
    "https://safetasks.vercel.app",
    # Local development
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    # Production
    "https://safetasks.vercel.app",
]

# For development, allow additional origins
if settings.ENVIRONMENT == "development":
    allowed_origins.extend([
        "http://localhost:5173",  # Vite
        "http://127.0.0.1:5173",  # Vite
        "http://192.168.15.3:3000",
        "http://192.168.15.11:3000",
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "X-CSRF-Token",
        "Access-Control-Allow-Origin",
    ],
)

# Include API routers
app.include_router(api_router, prefix=api_v1_str)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "version": "3.0"}


# === WebSocket for Real-Time Notifications ===
from fastapi import WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from sqlalchemy import select
from app.core.websocket_manager import notification_ws_manager
from app.db.session import SessionLocal
from app.models.profiles import Profile


async def get_user_from_token(token: str) -> tuple:
    """
    Extract user_id and org_id from JWT token.
    Returns (user_id, org_id) or (None, None) if invalid.
    """
    try:
        payload = jwt.get_unverified_claims(token)
        user_id = payload.get("sub")
        if not user_id:
            return None, None
        
        # Get org_id from database
        async with SessionLocal() as db:
            from uuid import UUID
            query = select(Profile).where(Profile.id == UUID(user_id))
            result = await db.execute(query)
            profile = result.scalar_one_or_none()
            
            if profile and profile.organization_id:
                return UUID(user_id), profile.organization_id
        
        return None, None
    except (JWTError, Exception) as e:
        logger.warning(f"WebSocket auth failed: {e}")
        return None, None


@app.websocket("/ws/notifications")
async def notifications_websocket(
    websocket: WebSocket,
    token: str = Query(None)
):
    """
    WebSocket endpoint for real-time notifications.
    
    Connect with: ws://host/ws/notifications?token=<jwt_token>
    
    Messages sent:
    - {"type": "notification", "action": "new", "data": {...}}
    - {"type": "notification", "action": "refresh"}
    """
    # Validate token
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return
    
    user_id, org_id = await get_user_from_token(token)
    if not user_id or not org_id:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    # Connect
    await notification_ws_manager.connect(websocket, org_id, user_id)
    
    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "message": "WebSocket connected for notifications"
        })
        
        # Keep connection alive and handle any incoming messages
        while True:
            try:
                # Wait for messages (ping/pong or client commands)
                data = await websocket.receive_text()
                
                # Handle ping
                if data == "ping":
                    await websocket.send_text("pong")
                    
            except WebSocketDisconnect:
                break
                
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        notification_ws_manager.disconnect(websocket, org_id, user_id)

