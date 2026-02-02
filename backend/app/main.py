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

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="3.0.6",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
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
    "https://safetasks-v3.vercel.app",
    # Local development
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
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
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "version": "3.0"}
