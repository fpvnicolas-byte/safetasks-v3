import logging
import time
from typing import List

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.api.v1.api import api_router
from app.db.session import get_db_metrics, reset_db_metrics, restore_db_metrics

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
    start_time = time.perf_counter()
    db_tokens = reset_db_metrics()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        response = JSONResponse(status_code=500, content={"detail": "Internal server error"})
    finally:
        try:
            if settings.ENABLE_SERVER_TIMING and response is not None:
                total_ms = (time.perf_counter() - start_time) * 1000.0
                db_ms, db_q = get_db_metrics()
                response.headers["Server-Timing"] = ", ".join(
                    [
                        f"app;dur={total_ms:.1f}",
                        f"db;dur={db_ms:.1f}",
                        f'dbq;desc=\"queries\";dur={db_q}',
                    ]
                )
        finally:
            restore_db_metrics(db_tokens)
    return response

# Add rate limiting middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

def _normalize_origin(origin: str) -> str:
    return origin.strip().strip('"').strip("'").rstrip("/")


def _build_allowed_origins() -> List[str]:
    origins: List[str] = []

    def add_origin(value: str) -> None:
        cleaned = _normalize_origin(value)
        if cleaned and cleaned not in origins:
            origins.append(cleaned)

    add_origin(str(settings.FRONTEND_URL))

    for configured_origin in settings.BACKEND_CORS_ORIGINS:
        add_origin(str(configured_origin))

    for default_origin in [
        "https://safetasks.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]:
        add_origin(default_origin)

    if settings.ENVIRONMENT == "development":
        for dev_origin in [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://192.168.15.3:3000",
            "http://192.168.15.11:3000",
        ]:
            add_origin(dev_origin)

    return origins


allowed_origins = _build_allowed_origins()
logger.info(
    "CORS configured for %d origin(s) in %s environment",
    len(allowed_origins),
    settings.ENVIRONMENT,
)
logger.info("CORS origins: %s", ", ".join(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

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
