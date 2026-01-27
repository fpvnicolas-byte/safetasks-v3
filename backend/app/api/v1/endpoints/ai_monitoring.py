"""
AI Service Monitoring Endpoints

Provides comprehensive monitoring and health check endpoints for the AI service.
These endpoints are designed for production monitoring, alerting, and debugging.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_organization, get_db
from app.core.config import settings
from app.models.organizations import Organization
from app.services.ai_engine import ai_engine_service

router = APIRouter()


@router.get("/health", response_model=dict)
async def get_ai_service_health(
    organization: Organization = Depends(get_current_organization)
):
    """
    Get comprehensive AI service health and monitoring metrics.
    
    Returns detailed service status, performance metrics, error rates,
    and actionable recommendations for production monitoring.
    
    Security: Only accessible by authenticated users with organization access.
    """
    try:
        # Verify organization has access to AI features
        if not settings.GEMINI_API_KEY:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": "AI features not configured",
                    "message": "GEMINI_API_KEY not configured in environment",
                    "service_status": "disabled",
                    "timestamp": "2024-01-01T00:00:00Z"
                }
            )
        
        # Get comprehensive health metrics
        health_metrics = ai_engine_service.get_service_health()
        
        # Add organization context
        health_metrics["organization"] = {
            "id": str(organization.id),
            "name": organization.name,
            "ai_features_enabled": bool(settings.GEMINI_API_KEY)
        }
        
        return health_metrics
        
    except Exception as e:
        # Log the error for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Health check failed: {str(e)}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Health check failed",
                "message": str(e),
                "timestamp": "2024-01-01T00:00:00Z"
            }
        )


@router.get("/status", response_model=dict)
async def get_ai_service_status(
    organization: Organization = Depends(get_current_organization)
):
    """
    Get basic AI service status for quick health checks.
    
    Returns minimal service status information for lightweight monitoring.
    Suitable for load balancers and health check probes.
    """
    try:
        health_metrics = ai_engine_service.get_service_health()
        
        return {
            "status": health_metrics["service_status"]["status"],
            "is_active": health_metrics["service_status"]["is_active"],
            "model_configured": health_metrics["service_status"]["model_configured"],
            "api_key_configured": health_metrics["service_status"]["api_key_configured"],
            "timestamp": health_metrics["service_status"]["last_health_check"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "status": "error",
                "message": str(e),
                "timestamp": "2024-01-01T00:00:00Z"
            }
        )


@router.post("/validate", response_model=dict)
async def validate_ai_configuration(
    organization: Organization = Depends(get_current_organization)
):
    """
    Validate AI service configuration and connectivity.
    
    Tests API key validity, service connectivity, and basic functionality.
    Returns detailed validation results for troubleshooting.
    """
    try:
        # Check if organization has access to AI features
        if not settings.GEMINI_API_KEY:
            return {
                "status": "failed",
                "error": "AI features not configured",
                "message": "GEMINI_API_KEY not configured in environment",
                "organization_id": str(organization.id),
                "timestamp": "2024-01-01T00:00:00Z"
            }
        
        # Perform API key validation
        validation_result = await ai_engine_service.validate_api_key()
        
        # Add organization context
        validation_result["organization_id"] = str(organization.id)
        
        return validation_result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "status": "failed",
                "error": f"Validation failed: {str(e)}",
                "organization_id": str(organization.id),
                "timestamp": "2024-01-01T00:00:00Z"
            }
        )


@router.get("/metrics", response_model=dict)
async def get_ai_service_metrics(
    organization: Organization = Depends(get_current_organization)
):
    """
    Get detailed AI service performance metrics.
    
    Returns comprehensive metrics for monitoring, alerting, and performance analysis.
    Includes request rates, error rates, processing times, and resource utilization.
    """
    try:
        health_metrics = ai_engine_service.get_service_health()
        
        # Return only performance metrics
        return {
            "performance_metrics": health_metrics["performance_metrics"],
            "service_status": health_metrics["service_status"],
            "monitoring_alerts": health_metrics["monitoring_alerts"],
            "organization_id": str(organization.id),
            "timestamp": health_metrics["service_status"]["last_health_check"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Metrics retrieval failed",
                "message": str(e),
                "organization_id": str(organization.id),
                "timestamp": "2024-01-01T00:00:00Z"
            }
        )


@router.get("/alerts", response_model=dict)
async def get_ai_service_alerts(
    organization: Organization = Depends(get_current_organization)
):
    """
    Get current monitoring alerts for the AI service.
    
    Returns active alerts that require attention, including severity levels
    and suggested actions for resolution.
    """
    try:
        health_metrics = ai_engine_service.get_service_health()
        
        return {
            "alerts": health_metrics["monitoring_alerts"],
            "recommendations": health_metrics["recommendations"],
            "service_status": health_metrics["service_status"]["status"],
            "organization_id": str(organization.id),
            "timestamp": health_metrics["service_status"]["last_health_check"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Alerts retrieval failed",
                "message": str(e),
                "organization_id": str(organization.id),
                "timestamp": "2024-01-01T00:00:00Z"
            }
        )


@router.get("/recommendations", response_model=dict)
async def get_ai_service_recommendations(
    organization: Organization = Depends(get_current_organization)
):
    """
    Get performance and configuration recommendations.
    
    Returns actionable recommendations for improving AI service performance,
    reliability, and configuration.
    """
    try:
        health_metrics = ai_engine_service.get_service_health()
        
        return {
            "recommendations": health_metrics["recommendations"],
            "service_status": health_metrics["service_status"]["status"],
            "performance_metrics": health_metrics["performance_metrics"],
            "organization_id": str(organization.id),
            "timestamp": health_metrics["service_status"]["last_health_check"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Recommendations retrieval failed",
                "message": str(e),
                "organization_id": str(organization.id),
                "timestamp": "2024-01-01T00:00:00Z"
            }
        )


# Add monitoring endpoints to the router
__all__ = [
    "router",
    "get_ai_service_health",
    "get_ai_service_status", 
    "validate_ai_configuration",
    "get_ai_service_metrics",
    "get_ai_service_alerts",
    "get_ai_service_recommendations"
]