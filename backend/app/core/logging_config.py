"""
Production Logging Configuration

Configures comprehensive logging for the Produzo AI service with:
- Structured logging with JSON format
- Multiple log levels and handlers
- Performance and security monitoring
- Error tracking and alerting
- Log rotation and retention
"""

import logging
import logging.config
import os
import sys
from datetime import datetime, timezone
from typing import Dict, Any

from app.core.config import settings


def setup_logging() -> None:
    """Configure production-ready logging for the AI service."""
    
    # Determine log level from environment
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    # Create logs directory if it doesn't exist
    log_dir = "logs"
    os.makedirs(log_dir, exist_ok=True)
    
    # Generate timestamp for log files
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Logging configuration
    logging_config: Dict[str, Any] = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "detailed": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            },
            "json": {
                "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
                "format": "%(asctime)s %(name)s %(levelname)s %(filename)s %(lineno)d %(funcName)s %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            },
            "ai_service": {
                "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
                "format": "%(asctime)s %(name)s %(levelname)s %(filename)s %(lineno)d %(funcName)s %(request_id)s %(organization_id)s %(processing_time_ms)d %(characters_found)d %(scenes_found)d %(locations_found)d %(error_type)s %(error_message)s %(content_hash)s %(model)s %(analysis_type)s %(timestamp)s %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            },
            "security": {
                "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
                "format": "%(asctime)s %(name)s %(levelname)s %(filename)s %(lineno)d %(funcName)s %(organization_id)s %(user_id)s %(ip_address)s %(user_agent)s %(action)s %(resource)s %(status)s %(details)s %(timestamp)s %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            },
            "performance": {
                "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
                "format": "%(asctime)s %(name)s %(levelname)s %(filename)s %(lineno)d %(funcName)s %(request_id)s %(organization_id)s %(processing_time_ms)d %(api_response_ms)d %(prompt_build_ms)d %(parsing_ms)d %(total_requests)d %(error_rate)s %(service_status)s %(timestamp)s %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            },
            "console": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                "datefmt": "%H:%M:%S"
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": log_level,
                "formatter": "console",
                "stream": sys.stdout
            },
            "file_info": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": logging.INFO,
                "formatter": "detailed",
                "filename": os.path.join(log_dir, f"app_info_{timestamp}.log"),
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5,
                "encoding": "utf8"
            },
            "file_error": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": logging.ERROR,
                "formatter": "detailed",
                "filename": os.path.join(log_dir, f"app_error_{timestamp}.log"),
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5,
                "encoding": "utf8"
            },
            "file_ai_service": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": logging.INFO,
                "formatter": "ai_service",
                "filename": os.path.join(log_dir, f"ai_service_{timestamp}.log"),
                "maxBytes": 10485760,  # 10MB
                "backupCount": 10,
                "encoding": "utf8"
            },
            "file_security": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": logging.WARNING,
                "formatter": "security",
                "filename": os.path.join(log_dir, f"security_{timestamp}.log"),
                "maxBytes": 10485760,  # 10MB
                "backupCount": 10,
                "encoding": "utf8"
            },
            "file_performance": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": logging.INFO,
                "formatter": "performance",
                "filename": os.path.join(log_dir, f"performance_{timestamp}.log"),
                "maxBytes": 10485760,  # 10MB
                "backupCount": 10,
                "encoding": "utf8"
            }
        },
        "loggers": {
            "app": {
                "level": log_level,
                "handlers": ["console", "file_info", "file_error"],
                "propagate": False
            },
            "app.services.ai_engine": {
                "level": logging.INFO,
                "handlers": ["console", "file_ai_service"],
                "propagate": False
            },
            "app.api.v1.endpoints.ai": {
                "level": logging.INFO,
                "handlers": ["console", "file_ai_service"],
                "propagate": False
            },
            "app.api.v1.endpoints.ai_monitoring": {
                "level": logging.INFO,
                "handlers": ["console", "file_performance"],
                "propagate": False
            },
            "app.core.security": {
                "level": logging.WARNING,
                "handlers": ["console", "file_security"],
                "propagate": False
            },
            "uvicorn": {
                "level": logging.WARNING,
                "handlers": ["console"],
                "propagate": False
            },
            "uvicorn.error": {
                "level": logging.WARNING,
                "handlers": ["console", "file_error"],
                "propagate": False
            },
            "uvicorn.access": {
                "level": logging.WARNING,
                "handlers": ["console"],
                "propagate": False
            },
            "sqlalchemy": {
                "level": logging.WARNING,
                "handlers": ["console"],
                "propagate": False
            },
            "sqlalchemy.engine": {
                "level": logging.WARNING,
                "handlers": ["console"],
                "propagate": False
            }
        },
        "root": {
            "level": log_level,
            "handlers": ["console", "file_info", "file_error"]
        }
    }
    
    # Apply logging configuration
    logging.config.dictConfig(logging_config)
    
    # Set up additional loggers for specific use cases
    setup_ai_service_logger()
    setup_security_logger()
    setup_performance_logger()
    
    # Log configuration startup
    logger = logging.getLogger("app")
    logger.info(
        "Logging configuration initialized",
        extra={
            "log_level": settings.LOG_LEVEL,
            "log_directory": log_dir,
            "timestamp": timestamp,
            "ai_features_enabled": bool(settings.GEMINI_API_KEY)
        }
    )


def setup_ai_service_logger() -> None:
    """Set up specialized logger for AI service operations."""
    ai_logger = logging.getLogger("app.services.ai_engine")
    
    # Add custom fields for AI service logging
    class AIServiceFilter(logging.Filter):
        def filter(self, record):
            # Add default values for AI service fields
            record.request_id = getattr(record, 'request_id', 'N/A')
            record.organization_id = getattr(record, 'organization_id', 'N/A')
            record.processing_time_ms = getattr(record, 'processing_time_ms', 0)
            record.characters_found = getattr(record, 'characters_found', 0)
            record.scenes_found = getattr(record, 'scenes_found', 0)
            record.locations_found = getattr(record, 'locations_found', 0)
            record.error_type = getattr(record, 'error_type', 'N/A')
            record.error_message = getattr(record, 'error_message', 'N/A')
            record.content_hash = getattr(record, 'content_hash', 'N/A')
            record.model = getattr(record, 'model', 'gemini-2.0-flash')
            record.analysis_type = getattr(record, 'analysis_type', 'N/A')
            record.timestamp = getattr(record, 'timestamp', datetime.now(timezone.utc).isoformat())
            return True
    
    ai_logger.addFilter(AIServiceFilter())


def setup_security_logger() -> None:
    """Set up specialized logger for security events."""
    security_logger = logging.getLogger("app.core.security")
    
    class SecurityFilter(logging.Filter):
        def filter(self, record):
            # Add default values for security fields
            record.organization_id = getattr(record, 'organization_id', 'N/A')
            record.user_id = getattr(record, 'user_id', 'N/A')
            record.ip_address = getattr(record, 'ip_address', 'N/A')
            record.user_agent = getattr(record, 'user_agent', 'N/A')
            record.action = getattr(record, 'action', 'N/A')
            record.resource = getattr(record, 'resource', 'N/A')
            record.status = getattr(record, 'status', 'N/A')
            record.details = getattr(record, 'details', 'N/A')
            record.timestamp = getattr(record, 'timestamp', datetime.now(timezone.utc).isoformat())
            return True
    
    security_logger.addFilter(SecurityFilter())


def setup_performance_logger() -> None:
    """Set up specialized logger for performance monitoring."""
    perf_logger = logging.getLogger("app.api.v1.endpoints.ai_monitoring")
    
    class PerformanceFilter(logging.Filter):
        def filter(self, record):
            # Add default values for performance fields
            record.request_id = getattr(record, 'request_id', 'N/A')
            record.organization_id = getattr(record, 'organization_id', 'N/A')
            record.processing_time_ms = getattr(record, 'processing_time_ms', 0)
            record.api_response_ms = getattr(record, 'api_response_ms', 0)
            record.prompt_build_ms = getattr(record, 'prompt_build_ms', 0)
            record.parsing_ms = getattr(record, 'parsing_ms', 0)
            record.total_requests = getattr(record, 'total_requests', 0)
            record.error_rate = getattr(record, 'error_rate', '0.00%')
            record.service_status = getattr(record, 'service_status', 'unknown')
            record.timestamp = getattr(record, 'timestamp', datetime.now(timezone.utc).isoformat())
            return True
    
    perf_logger.addFilter(PerformanceFilter())


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the specified name."""
    return logging.getLogger(name)


def log_ai_request(
    logger: logging.Logger,
    organization_id: str,
    request_id: str,
    processing_time_ms: int,
    characters_found: int = 0,
    scenes_found: int = 0,
    locations_found: int = 0,
    content_hash: str = "",
    model: str = "gemini-2.0-flash",
    analysis_type: str = "script_breakdown",
    **kwargs
) -> None:
    """Log AI service request with structured data."""
    logger.info(
        "AI service request completed",
        extra={
            "request_id": request_id,
            "organization_id": organization_id,
            "processing_time_ms": processing_time_ms,
            "characters_found": characters_found,
            "scenes_found": scenes_found,
            "locations_found": locations_found,
            "content_hash": content_hash[:16] if content_hash else "N/A",
            "model": model,
            "analysis_type": analysis_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **kwargs
        }
    )


def log_ai_error(
    logger: logging.Logger,
    organization_id: str,
    request_id: str,
    error_type: str,
    error_message: str,
    processing_time_ms: int = 0,
    content_hash: str = "",
    model: str = "gemini-2.0-flash",
    **kwargs
) -> None:
    """Log AI service error with structured data."""
    logger.error(
        "AI service request failed",
        extra={
            "request_id": request_id,
            "organization_id": organization_id,
            "error_type": error_type,
            "error_message": error_message,
            "processing_time_ms": processing_time_ms,
            "content_hash": content_hash[:16] if content_hash else "N/A",
            "model": model,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **kwargs
        }
    )


def log_performance_metric(
    logger: logging.Logger,
    organization_id: str,
    metric_name: str,
    metric_value: Any,
    request_id: str = "",
    **kwargs
) -> None:
    """Log performance metrics."""
    logger.info(
        f"Performance metric: {metric_name}",
        extra={
            "organization_id": organization_id,
            "metric_name": metric_name,
            "metric_value": metric_value,
            "request_id": request_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **kwargs
        }
    )


def log_security_event(
    logger: logging.Logger,
    organization_id: str,
    action: str,
    resource: str,
    status: str,
    user_id: str = "",
    ip_address: str = "",
    user_agent: str = "",
    details: str = "",
    **kwargs
) -> None:
    """Log security events."""
    logger.warning(
        f"Security event: {action}",
        extra={
            "organization_id": organization_id,
            "user_id": user_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "action": action,
            "resource": resource,
            "status": status,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **kwargs
        }
    )


# Initialize logging when module is imported
setup_logging()
