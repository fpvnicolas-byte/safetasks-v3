from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
import logging

from .core.config import settings
from .core.database import create_tables

# Import all module routers
from .modules.commercial.router import router as commercial_router
from .modules.production.router import router as production_router
from .modules.scheduling.router import router as scheduling_router
from .modules.financial.router import router as financial_router
from .modules.inventory.router import router as inventory_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for FastAPI application.
    Handles startup and shutdown events.
    """
    logger.info("Starting Safe Tasks V3 backend...")

    # Create database tables on startup
    try:
        await create_tables()
        logger.info("Database tables created/verified successfully")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise

    yield

    logger.info("Shutting down Safe Tasks V3 backend...")


# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="3.0.0",
    description="Safe Tasks V3 - Audiovisual Production Management Platform",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with consistent response format."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "path": str(request.url),
            "method": request.method
        }
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """Handle SQLAlchemy exceptions."""
    logger.error(f"Database error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Database operation failed",
            "details": str(exc) if settings.PROJECT_NAME == "development" else "Internal server error",
            "path": str(request.url),
            "method": request.method
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "path": str(request.url),
            "method": request.method
        }
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint to verify service status.
    Returns basic service information and status.
    """
    return {
        "status": "healthy",
        "version": "3.0.0",
        "service": "Safe Tasks V3 Backend",
        "modules": [
            "commercial",
            "production",
            "scheduling",
            "financial",
            "inventory"
        ]
    }


@app.get("/")
async def root():
    """
    Root endpoint providing basic API information.
    """
    return {
        "message": "Welcome to Safe Tasks V3 API",
        "version": "3.0.0",
        "documentation": "/docs",
        "health": "/health"
    }


# Mount module routers
app.include_router(
    commercial_router,
    prefix=settings.API_V1_STR,
    tags=["commercial"]
)

app.include_router(
    production_router,
    prefix=settings.API_V1_STR,
    tags=["production"]
)

app.include_router(
    scheduling_router,
    prefix=settings.API_V1_STR,
    tags=["scheduling"]
)

app.include_router(
    financial_router,
    prefix=settings.API_V1_STR,
    tags=["financial"]
)

app.include_router(
    inventory_router,
    prefix=settings.API_V1_STR,
    tags=["inventory"]
)