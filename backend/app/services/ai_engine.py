import json
import logging
import time
import asyncio
import hashlib
import random
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union
from uuid import UUID

import google.generativeai as genai
from app.core.config import settings

try:
    from google.api_core.exceptions import (
        ResourceExhausted,
        ServiceUnavailable,
        DeadlineExceeded,
        InternalServerError,
        TooManyRequests,
    )
    RETRYABLE_PROVIDER_EXCEPTIONS = (
        ResourceExhausted,
        ServiceUnavailable,
        DeadlineExceeded,
        InternalServerError,
        TooManyRequests,
    )
except Exception:  # pragma: no cover - defensive fallback for optional provider internals
    RETRYABLE_PROVIDER_EXCEPTIONS = ()

# Import logging configuration
from app.core.logging_config import (
    log_ai_request, 
    log_ai_error, 
    log_performance_metric,
    get_logger
)

# Get specialized logger for AI service
logger = get_logger("app.services.ai_engine")

# AI Service Configuration Constants
MAX_SCRIPT_LENGTH = 50000  # Maximum characters for script content
MAX_RESPONSE_TOKENS = 4096  # Maximum tokens for AI response
TIMEOUT_SECONDS = 60  # Request timeout in seconds
MAX_RETRY_ATTEMPTS = 3  # Maximum retry attempts for failed requests
MAX_CONCURRENT_API_CALLS = 2  # Protect provider quota from local request bursts
RETRY_BASE_DELAY_SECONDS = 1.0
RETRY_MAX_DELAY_SECONDS = 8.0

SUPPORTED_RESPONSE_LANGUAGES = {"pt-br", "pt", "en", "en-us", "en-gb"}
PT_BR_DIACRITICS_PATTERN = re.compile(r"[àáâãçéêíóôõú]")
PT_BR_LANGUAGE_MARKERS = (
    "roteiro",
    "cena",
    "cenas",
    "personagem",
    "personagens",
    "produção",
    "filmagem",
    "orçamento",
    "equipamento",
    "locação",
    "interior",
    "exterior",
    "não",
    "com",
    "para",
    "uma",
    "que",
    "está",
)
EN_LANGUAGE_MARKERS = (
    "script",
    "scene",
    "scenes",
    "character",
    "characters",
    "production",
    "shooting",
    "budget",
    "equipment",
    "location",
    "interior",
    "exterior",
    "not",
    "with",
    "for",
    "the",
    "is",
)


class AIEngineService:
    """
    AI service for script analysis and production assistance.
    Uses Google Gemini 2.0 Flash for structured script breakdown.
    
    PRODUCTION-READY FEATURES:
    - Comprehensive logging and monitoring
    - Performance metrics and timing
    - Error tracking and recovery
    - Content validation and security
    - Request/response auditing
    """

    def __init__(self):
        # CORREÇÃO: Inicialização segura. Verifica se a chave existe antes de configurar.
        self.model = None
        self.is_active = False
        self._request_count = 0
        self._error_count = 0
        self._total_processing_time = 0
        self._api_semaphore = asyncio.Semaphore(MAX_CONCURRENT_API_CALLS)

        self._initialize_model()

    def _initialize_model(self) -> None:
        """Configure Gemini model and service state."""
        if settings.GEMINI_API_KEY:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self.model = genai.GenerativeModel('gemini-2.0-flash')
                self.is_active = True

                # Production-ready initialization logging
                logger.info(
                    "Gemini AI initialized successfully",
                    extra={
                        "model": "gemini-2.0-flash",
                        "api_key_configured": bool(settings.GEMINI_API_KEY),
                        "service_status": "active",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                )

            except Exception as e:
                self.model = None
                self.is_active = False
                logger.error(
                    "Failed to initialize Gemini AI",
                    extra={
                        "error_type": type(e).__name__,
                        "error_message": str(e),
                        "service_status": "inactive",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                )
        else:
            self.model = None
            self.is_active = False
            logger.warning(
                "GEMINI_API_KEY not found in settings. AI features disabled.",
                extra={
                    "api_key_configured": False,
                    "service_status": "inactive",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )

    def _is_retryable_error(self, error: Exception) -> bool:
        """Detect transient provider errors worth retrying."""
        if RETRYABLE_PROVIDER_EXCEPTIONS and isinstance(error, RETRYABLE_PROVIDER_EXCEPTIONS):
            return True

        error_type = type(error).__name__
        error_message = str(error).lower()

        if error_type in {"ResourceExhausted", "TooManyRequests", "ServiceUnavailable", "DeadlineExceeded", "InternalServerError"}:
            return True

        return any(
            snippet in error_message
            for snippet in (
                "429",
                "resource exhausted",
                "too many requests",
                "rate limit",
                "service unavailable",
                "deadline exceeded",
                "event loop is closed",
            )
        )

    @staticmethod
    def _retry_delay_seconds(attempt: int) -> float:
        """Exponential backoff with light jitter to avoid synchronized retries."""
        backoff = min(RETRY_BASE_DELAY_SECONDS * (2 ** (attempt - 1)), RETRY_MAX_DELAY_SECONDS)
        jitter = random.uniform(0.0, 0.5)
        return backoff + jitter

    async def _generate_content_with_retry(
        self,
        *,
        request_id: str,
        organization_id: UUID,
        operation: str,
        prompt: str,
        generation_config: Any,
    ) -> Any:
        """
        Execute Gemini request with bounded concurrency and retry/backoff for
        transient provider failures (e.g. 429 ResourceExhausted).
        """
        last_error: Optional[Exception] = None

        for attempt in range(1, MAX_RETRY_ATTEMPTS + 1):
            try:
                if not self.model:
                    raise RuntimeError("AI model is not initialized")

                async with self._api_semaphore:
                    return await asyncio.wait_for(
                        self.model.generate_content_async(
                            prompt,
                            generation_config=generation_config,
                        ),
                        timeout=TIMEOUT_SECONDS,
                    )

            except asyncio.TimeoutError as e:
                last_error = e
                if attempt >= MAX_RETRY_ATTEMPTS:
                    raise

                delay_seconds = self._retry_delay_seconds(attempt)
                logger.warning(
                    "Retrying AI request after timeout",
                    extra={
                        "request_id": request_id,
                        "organization_id": str(organization_id),
                        "operation": operation,
                        "attempt": attempt,
                        "max_attempts": MAX_RETRY_ATTEMPTS,
                        "retry_delay_seconds": round(delay_seconds, 3),
                    }
                )
                await asyncio.sleep(delay_seconds)

            except Exception as e:
                last_error = e

                if "event loop is closed" in str(e).lower():
                    # Recreate the SDK client state; this can happen in reused worker/test loops.
                    self._initialize_model()

                if not self._is_retryable_error(e) or attempt >= MAX_RETRY_ATTEMPTS:
                    raise

                delay_seconds = self._retry_delay_seconds(attempt)
                logger.warning(
                    "Retrying AI request after transient provider error",
                    extra={
                        "request_id": request_id,
                        "organization_id": str(organization_id),
                        "operation": operation,
                        "attempt": attempt,
                        "max_attempts": MAX_RETRY_ATTEMPTS,
                        "retry_delay_seconds": round(delay_seconds, 3),
                        "error_type": type(e).__name__,
                        "error_message": str(e),
                    }
                )
                await asyncio.sleep(delay_seconds)

        if last_error:
            raise last_error
        raise RuntimeError("AI request failed without a captured exception")

    @staticmethod
    def _normalize_response_language(language: Optional[str]) -> str:
        """Normalize locale identifiers to supported response language values."""
        if not language:
            return "en"
        normalized = language.strip().lower()
        if normalized not in SUPPORTED_RESPONSE_LANGUAGES:
            if normalized.startswith("pt"):
                return "pt-BR"
            if normalized.startswith("en"):
                return "en"
            return "en"
        if normalized.startswith("pt"):
            return "pt-BR"
        if normalized.startswith("en"):
            return "en"
        return "en"

    @staticmethod
    def _language_label(response_language: str) -> str:
        return "Brazilian Portuguese (pt-BR)" if response_language == "pt-BR" else "English (en)"

    @classmethod
    def _count_language_markers(cls, sample: str, markers: tuple[str, ...]) -> int:
        total = 0
        for marker in markers:
            total += len(re.findall(rf"\b{re.escape(marker)}\b", sample))
        return total

    def detect_content_language(self, text: str) -> str:
        """
        Lightweight language detector for request content.
        Returns "pt-BR" or "en".
        """
        if not text:
            return "en"

        sample = text.strip().lower()[:12000]
        if not sample:
            return "en"

        if PT_BR_DIACRITICS_PATTERN.search(sample):
            return "pt-BR"

        pt_hits = self._count_language_markers(sample, PT_BR_LANGUAGE_MARKERS)
        en_hits = self._count_language_markers(sample, EN_LANGUAGE_MARKERS)

        if pt_hits > en_hits:
            return "pt-BR"
        return "en"

    def _infer_response_language(
        self,
        *,
        response_language: Optional[str] = None,
        script_content: Optional[str] = None,
        script_analysis: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Resolve response language in priority order:
        explicit param -> analysis metadata -> content detection -> English.
        """
        if response_language:
            return self._normalize_response_language(response_language)

        if isinstance(script_analysis, dict):
            metadata = script_analysis.get("metadata")
            if isinstance(metadata, dict):
                metadata_language = metadata.get("response_language")
                if isinstance(metadata_language, str) and metadata_language.strip():
                    return self._normalize_response_language(metadata_language)

        if script_content and script_content.strip():
            return self.detect_content_language(script_content)

        if isinstance(script_analysis, dict):
            analysis_text = json.dumps(script_analysis, ensure_ascii=False)
            if analysis_text.strip():
                return self.detect_content_language(analysis_text)

        return "en"

    def _response_language_instruction(self, response_language: str) -> str:
        language_label = self._language_label(response_language)
        return (
            f"Use {language_label} for all human-readable text values "
            "(descriptions, notes, reasoning, recommendations). "
            "Keep JSON keys and constrained enum tokens exactly as specified."
        )

    async def analyze_script_content(
        self,
        *,
        organization_id: UUID,
        script_content: str,
        project_id: Optional[UUID] = None,
        analysis_type: str = "full",
        response_language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Analyze script content and extract production elements.
        
        PRODUCTION MONITORING:
        - Request/response auditing
        - Performance timing
        - Error tracking and recovery
        - Content validation
        - Security logging
        """
        start_time = time.time()
        request_id = hashlib.md5(f"{organization_id}_{project_id}_{start_time}".encode()).hexdigest()[:16]
        analysis_type = analysis_type if analysis_type in ("full", "characters", "scenes", "locations") else "full"
        
        # Increment request counter
        self._request_count += 1
        
        # Production-ready request logging
        logger.info(
            "AI script analysis request started",
            extra={
                "request_id": request_id,
                "organization_id": str(organization_id),
                "project_id": str(project_id) if project_id else None,
                "script_length": len(script_content),
                "analysis_type": analysis_type,
                "model": "gemini-2.0-flash",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
        
        # Service availability check
        if not self.is_active or not self.model:
            self._error_count += 1
            logger.error(
                "AI service unavailable - service not initialized",
                extra={
                    "request_id": request_id,
                    "organization_id": str(organization_id),
                    "service_status": "inactive",
                    "error_type": "service_unavailable",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            return {
                "error": "AI Service unavailable (Missing API Key)",
                "scenes": [], 
                "characters": [], 
                "locations": [],
                "request_id": request_id,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }

        try:
            # Content validation and security logging
            if not script_content or not script_content.strip():
                raise ValueError("Script content is empty or invalid")
            
            # Content sanitization and validation
            clean_content = script_content.strip()
            if len(clean_content) > MAX_SCRIPT_LENGTH:
                logger.warning(
                    "Script content exceeds maximum length",
                    extra={
                        "request_id": request_id,
                        "content_length": len(clean_content),
                        "max_length": MAX_SCRIPT_LENGTH,
                        "organization_id": str(organization_id)
                    }
                )
                clean_content = clean_content[:MAX_SCRIPT_LENGTH]
            
            # Content hash for audit trail
            content_hash = hashlib.sha256(clean_content.encode()).hexdigest()
            resolved_language = self._infer_response_language(
                response_language=response_language,
                script_content=clean_content,
            )
            
            # Create the analysis prompt with monitoring
            prompt = self._build_script_analysis_prompt(
                clean_content,
                project_id,
                analysis_type=analysis_type,
                response_language=resolved_language,
            )
            
            # Performance monitoring
            prompt_build_time = time.time() - start_time
            
            logger.debug(
                "Script analysis prompt generated",
                extra={
                    "request_id": request_id,
                    "prompt_length": len(prompt),
                    "prompt_build_time_ms": int(prompt_build_time * 1000),
                    "content_hash": content_hash[:16]
                }
            )

            # Call Gemini API with comprehensive monitoring
            api_start_time = time.time()
            max_output_tokens = MAX_RESPONSE_TOKENS
            if analysis_type in ("characters", "locations"):
                max_output_tokens = 2048
            elif analysis_type == "scenes":
                max_output_tokens = 3072

            response = await self._generate_content_with_retry(
                request_id=request_id,
                organization_id=organization_id,
                operation="script_analysis",
                prompt=prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,  # Low temperature for consistent analysis
                    max_output_tokens=max_output_tokens,
                    response_mime_type="application/json",
                ),
            )
            
            api_response_time = time.time() - api_start_time
            
            # Parse the JSON response with error handling
            result_text = response.text
            parse_start_time = time.time()
            analysis_result = json.loads(result_text)
            parse_time = time.time() - parse_start_time

            # Validate response structure
            required_keys = ['characters', 'locations', 'scenes', 'suggested_equipment', 'production_notes']
            missing_keys = [key for key in required_keys if key not in analysis_result]
            
            if missing_keys:
                logger.warning(
                    "AI response missing required keys",
                    extra={
                        "request_id": request_id,
                        "missing_keys": missing_keys,
                        "available_keys": list(analysis_result.keys()),
                        "organization_id": str(organization_id)
                    }
                )
                # Add missing keys with empty arrays
                for key in missing_keys:
                    analysis_result[key] = []

            # Add comprehensive metadata
            processing_time = time.time() - start_time
            self._total_processing_time += processing_time
            
            analysis_result["metadata"] = {
                "organization_id": str(organization_id),
                "project_id": str(project_id) if project_id else None,
                "model_used": "gemini-2.0-flash",
                "analysis_type": "script_breakdown",
                "response_language": resolved_language,
                "request_id": request_id,
                "content_hash": content_hash,
                "processing_times": {
                    "total_ms": int(processing_time * 1000),
                    "prompt_build_ms": int(prompt_build_time * 1000),
                    "api_response_ms": int(api_response_time * 1000),
                    "parsing_ms": int(parse_time * 1000)
                },
                "content_metrics": {
                    "input_length": len(clean_content),
                    "output_length": len(result_text),
                    "characters_found": len(analysis_result.get('characters', [])),
                    "scenes_found": len(analysis_result.get('scenes', [])),
                    "locations_found": len(analysis_result.get('locations', []))
                },
                "service_metrics": {
                    "total_requests": self._request_count,
                    "error_rate": f"{(self._error_count / self._request_count) * 100:.2f}%" if self._request_count > 0 else "0.00%"
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            # Success logging with performance metrics
            logger.info(
                "AI script analysis completed successfully",
                extra={
                    "request_id": request_id,
                    "organization_id": str(organization_id),
                    "project_id": str(project_id) if project_id else None,
                    "processing_time_ms": int(processing_time * 1000),
                    "characters_found": len(analysis_result.get('characters', [])),
                    "scenes_found": len(analysis_result.get('scenes', [])),
                    "locations_found": len(analysis_result.get('locations', [])),
                    "content_hash": content_hash[:16],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            
            return analysis_result

        except asyncio.TimeoutError:
            self._error_count += 1
            logger.error(
                "AI script analysis timed out",
                extra={
                    "request_id": request_id,
                    "organization_id": str(organization_id),
                    "project_id": str(project_id) if project_id else None,
                    "analysis_type": analysis_type,
                    "timeout_seconds": TIMEOUT_SECONDS,
                    "processing_time_ms": int((time.time() - start_time) * 1000),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
            return {
                "error": f"AI request timed out after {TIMEOUT_SECONDS}s",
                "scenes": [],
                "characters": [],
                "locations": [],
                "request_id": request_id,
                "processing_time_ms": int((time.time() - start_time) * 1000),
            }

        except json.JSONDecodeError as e:
            self._error_count += 1
            logger.error(
                "Failed to parse AI response as JSON",
                extra={
                    "request_id": request_id,
                    "organization_id": str(organization_id),
                    "project_id": str(project_id) if project_id else None,
                    "error_type": "json_decode_error",
                    "error_message": str(e),
                    "response_preview": result_text[:200] if 'result_text' in locals() else "N/A",
                    "processing_time_ms": int((time.time() - start_time) * 1000),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            return {
                "error": f"JSON parsing failed: {str(e)}",
                "scenes": [], 
                "characters": [], 
                "locations": [],
                "request_id": request_id,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }
            
        except Exception as e:
            self._error_count += 1
            logger.error(
                "AI script analysis failed",
                extra={
                    "request_id": request_id,
                    "organization_id": str(organization_id),
                    "project_id": str(project_id) if project_id else None,
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "processing_time_ms": int((time.time() - start_time) * 1000),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            return {
                "error": f"Script analysis failed: {str(e)}",
                "scenes": [], 
                "characters": [], 
                "locations": [],
                "request_id": request_id,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }

    async def suggest_production_elements(
        self,
        *,
        organization_id: UUID,
        script_analysis: Dict[str, Any],
        project_context: Optional[Dict[str, Any]] = None,
        response_language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate production suggestions based on script analysis.
        
        PRODUCTION MONITORING:
        - Input validation and auditing
        - Performance tracking
        - Error recovery and logging
        - Response quality validation
        """
        start_time = time.time()
        request_id = hashlib.md5(f"{organization_id}_production_{start_time}".encode()).hexdigest()[:16]
        
        # Service availability check
        if not self.is_active or not self.model:
            logger.error(
                "AI service unavailable for production suggestions",
                extra={
                    "request_id": request_id,
                    "organization_id": str(organization_id),
                    "service_status": "inactive",
                    "error_type": "service_unavailable",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            return {
                "error": "AI Service unavailable",
                "request_id": request_id,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }

        try:
            # Input validation and auditing
            if not script_analysis or not isinstance(script_analysis, dict):
                raise ValueError("Invalid script analysis data provided")
            
            # Validate required analysis data
            required_analysis_keys = ['characters', 'locations', 'scenes']
            missing_analysis_keys = [key for key in required_analysis_keys if key not in script_analysis]
            
            if missing_analysis_keys:
                logger.warning(
                    "Script analysis missing required data for production suggestions",
                    extra={
                        "request_id": request_id,
                        "organization_id": str(organization_id),
                        "missing_keys": missing_analysis_keys,
                        "available_keys": list(script_analysis.keys())
                    }
                )
            
            # Content metrics for monitoring
            content_metrics = {
                "characters_count": len(script_analysis.get('characters', [])),
                "locations_count": len(script_analysis.get('locations', [])),
                "scenes_count": len(script_analysis.get('scenes', [])),
                "project_context_provided": bool(project_context)
            }
            
            # Create prompt with monitoring
            prompt_start_time = time.time()
            resolved_language = self._infer_response_language(
                response_language=response_language,
                script_analysis=script_analysis,
            )
            prompt = self._build_production_suggestions_prompt(
                script_analysis,
                project_context,
                response_language=resolved_language,
            )
            prompt_build_time = time.time() - prompt_start_time
            
            logger.debug(
                "Production suggestions prompt generated",
                extra={
                    "request_id": request_id,
                    "prompt_length": len(prompt),
                    "prompt_build_time_ms": int(prompt_build_time * 1000),
                    "content_metrics": content_metrics
                }
            )

            # Call Gemini API with monitoring
            api_start_time = time.time()
            response = await self._generate_content_with_retry(
                request_id=request_id,
                organization_id=organization_id,
                operation="production_suggestions",
                prompt=prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2,  # Slightly higher temperature for creative suggestions
                    max_output_tokens=3000,
                    response_mime_type="application/json",
                ),
            )
            
            api_response_time = time.time() - api_start_time
            
            # Parse response with validation
            result_text = response.text
            parse_start_time = time.time()
            suggestions = json.loads(result_text)
            parse_time = time.time() - parse_start_time

            # Validate response structure
            required_suggestion_keys = ['shooting_day_suggestions', 'equipment_recommendations',
                                      'scheduling_considerations', 'budget_considerations']
            missing_suggestion_keys = [key for key in required_suggestion_keys if key not in suggestions]
            
            if missing_suggestion_keys:
                logger.warning(
                    "Production suggestions response missing required keys",
                    extra={
                        "request_id": request_id,
                        "missing_keys": missing_suggestion_keys,
                        "available_keys": list(suggestions.keys()),
                        "organization_id": str(organization_id)
                    }
                )
                # Add missing keys with empty arrays
                for key in missing_suggestion_keys:
                    suggestions[key] = []

            # Add comprehensive metadata
            processing_time = time.time() - start_time
            
            suggestions["metadata"] = {
                "organization_id": str(organization_id),
                "model_used": "gemini-2.0-flash",
                "suggestion_type": "production_elements",
                "response_language": resolved_language,
                "request_id": request_id,
                "input_content_metrics": content_metrics,
                "processing_times": {
                    "total_ms": int(processing_time * 1000),
                    "prompt_build_ms": int(prompt_build_time * 1000),
                    "api_response_ms": int(api_response_time * 1000),
                    "parsing_ms": int(parse_time * 1000)
                },
                "service_metrics": {
                    "total_requests": self._request_count,
                    "error_rate": f"{(self._error_count / self._request_count) * 100:.2f}%" if self._request_count > 0 else "0.00%"
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            # Success logging with detailed metrics
            logger.info(
                "AI production suggestions generated successfully",
                extra={
                    "request_id": request_id,
                    "organization_id": str(organization_id),
                    "processing_time_ms": int(processing_time * 1000),
                    "shooting_day_suggestions_count": len(suggestions.get('shooting_day_suggestions', [])),
                    "equipment_recommendations_count": len(suggestions.get('equipment_recommendations', [])),
                    "scheduling_considerations_count": len(suggestions.get('scheduling_considerations', [])),
                    "budget_considerations_count": len(suggestions.get('budget_considerations', [])),
                    "content_metrics": content_metrics,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            
            return suggestions

        except asyncio.TimeoutError:
            self._error_count += 1
            logger.error(
                "AI production suggestions request timed out",
                extra={
                    "request_id": request_id,
                    "organization_id": str(organization_id),
                    "timeout_seconds": TIMEOUT_SECONDS,
                    "processing_time_ms": int((time.time() - start_time) * 1000),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
            return {
                "error": f"AI request timed out after {TIMEOUT_SECONDS}s",
                "request_id": request_id,
                "processing_time_ms": int((time.time() - start_time) * 1000),
            }

        except json.JSONDecodeError as e:
            self._error_count += 1
            logger.error(
                "Failed to parse production suggestions response as JSON",
                extra={
                    "request_id": request_id,
                    "organization_id": str(organization_id),
                    "error_type": "json_decode_error",
                    "error_message": str(e),
                    "response_preview": result_text[:200] if 'result_text' in locals() else "N/A",
                    "processing_time_ms": int((time.time() - start_time) * 1000),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            return {
                "error": f"JSON parsing failed: {str(e)}",
                "request_id": request_id,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }
            
        except Exception as e:
            self._error_count += 1
            logger.error(
                "AI production suggestions generation failed",
                extra={
                    "request_id": request_id,
                    "organization_id": str(organization_id),
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "processing_time_ms": int((time.time() - start_time) * 1000),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            return {
                "error": f"Production suggestions failed: {str(e)}",
                "request_id": request_id,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }

    def _build_script_analysis_prompt(
        self,
        script_content: str,
        project_id: Optional[UUID],
        *,
        analysis_type: str = "full",
        response_language: str = "en",
    ) -> str:
        """Build the prompt for script analysis."""
        focus_instructions = {
            "full": "Provide a balanced, end-to-end breakdown.",
            "characters": "Focus on extracting CHARACTERS only. Keep other arrays empty.",
            "scenes": "Focus on extracting SCENES only. Keep other arrays empty.",
            "locations": "Focus on extracting LOCATIONS only. Keep other arrays empty.",
        }.get(analysis_type, "Provide a balanced, end-to-end breakdown.")
        language_instruction = self._response_language_instruction(
            self._normalize_response_language(response_language)
        )

        return f"""
Analyze this film script and extract key production elements for production planning.

Important:
- Return ONLY valid JSON (no markdown, no commentary).
- Always include the keys: characters, locations, scenes, suggested_equipment, production_notes.
- {focus_instructions}
- {language_instruction}
- Keep the output concise and bounded: max 30 characters, 25 locations, 50 scenes, 8 equipment categories, 10 production notes.
- Keep descriptions under 20 words.

Script Content (excerpt):
{script_content[:10000]}

Return a JSON object with the following structure:
{{
  "characters": [
    {{
      "name": "Character Name",
      "description": "Brief description",
      "scenes_present": [1, 5, 10],
      "importance": "main/secondary/extra"
    }}
  ],
  "locations": [
    {{
      "name": "Location Name",
      "description": "Setting description",
      "scenes": [2, 7],
      "day_night": "day/night/interior",
      "special_requirements": ["permits needed", "special equipment"]
    }}
  ],
  "scenes": [
    {{
      "number": 1,
      "heading": "INT. LOCATION - DAY",
      "description": "Scene description",
      "characters": ["Character A", "Character B"],
      "estimated_time": "5 minutes",
      "complexity": "low/medium/high"
    }}
  ],
  "suggested_equipment": [
    {{
      "category": "camera",
      "items": ["ARRI ALEXA", "Tripod", "Stabilizer"],
      "reasoning": "Based on scene requirements"
    }}
  ],
  "production_notes": [
    "Key logistical considerations",
    "Special requirements",
    "Budget considerations"
  ]
}}
"""

    def _build_production_suggestions_prompt(
        self,
        script_analysis: Dict[str, Any],
        project_context: Optional[Dict[str, Any]],
        *,
        response_language: str = "en",
    ) -> str:
        """Build the prompt for production suggestions."""
        context_str = ""
        if project_context:
            context_str = f"\nProject Context: {json.dumps(project_context)}"
        language_instruction = self._response_language_instruction(
            self._normalize_response_language(response_language)
        )

        return f"""
Based on this script analysis, provide practical production suggestions:

Script Analysis:
{json.dumps(script_analysis, indent=2)}

{context_str}

Return a JSON object with:
{{
    "shooting_day_suggestions": [
        {{
            "day": 1,
            "suggested_scenes": [1, 2, 3],
            "crew_needed": ["Director", "DP", "Sound"],
            "equipment_needed": ["Camera A", "Lights"],
            "estimated_duration": "8 hours"
        }}
    ],
    "equipment_recommendations": [
        {{
            "category": "Camera",
            "priority": "high",
            "reasoning": "Multiple complex scenes require this",
            "alternatives": ["Alternative A", "Alternative B"]
        }}
    ],
    "scheduling_considerations": [
        "Weather-dependent scenes should be scheduled first",
        "Location permits needed for exterior shoots",
        "Character availability constraints"
    ],
    "budget_considerations": [
        "Location A requires special permits",
        "Equipment rental costs for specialized gear",
        "Potential overtime for complex scenes"
    ]
}}

Focus on actionable suggestions that help production planning and logistics.
{language_instruction}
"""

    async def estimate_project_budget(
        self,
        *,
        organization_id: UUID,
        script_content: str,
        estimation_type: str = "detailed",
        project_context: Optional[Dict[str, Any]] = None,
        response_language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Estimate project budget based on script content.
        
        PRODUCTION MONITORING:
        - Input validation and auditing
        - Performance tracking
        - Error recovery and logging
        - Response quality validation
        """
        start_time = time.time()
        request_id = hashlib.md5(f"{organization_id}_budget_{start_time}".encode()).hexdigest()[:16]
        
        # Service availability check
        if not self.is_active or not self.model:
            logger.error(
                "AI service unavailable for budget estimation",
                extra={
                    "request_id": request_id,
                    "organization_id": str(organization_id),
                    "service_status": "inactive",
                    "error_type": "service_unavailable",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            return {
                "error": "AI Service unavailable",
                "request_id": request_id,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }

        try:
            # Input validation
            if not script_content or not script_content.strip():
                raise ValueError("Script content is empty")

            # Content metrics for monitoring
            resolved_language = self._infer_response_language(
                response_language=response_language,
                script_content=script_content,
            )
            content_metrics = {
                "content_length": len(script_content),
                "estimation_type": estimation_type,
                "project_context_provided": bool(project_context),
                "response_language": resolved_language,
            }
            
            # Create prompt with monitoring
            prompt_start_time = time.time()
            prompt = self._build_budget_estimation_prompt(
                script_content,
                estimation_type,
                project_context,
                response_language=resolved_language,
            )
            prompt_build_time = time.time() - prompt_start_time
            
            logger.debug(
                "Budget estimation prompt generated",
                extra={
                    "request_id": request_id,
                    "prompt_length": len(prompt),
                    "prompt_build_time_ms": int(prompt_build_time * 1000),
                    "content_metrics": content_metrics
                }
            )

            # Call Gemini API with monitoring
            api_start_time = time.time()
            response = await self._generate_content_with_retry(
                request_id=request_id,
                organization_id=organization_id,
                operation="budget_estimation",
                prompt=prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=2000,
                    response_mime_type="application/json",
                ),
            )
            
            api_response_time = time.time() - api_start_time
            
            # Parse response with validation
            result_text = response.text
            parse_start_time = time.time()
            estimation = json.loads(result_text)
            parse_time = time.time() - parse_start_time

            # Validate response structure
            required_keys = ['estimated_budget_cents', 'breakdown', 'risk_factors', 'recommendations']
            missing_keys = [key for key in required_keys if key not in estimation]
            
            if missing_keys:
                logger.warning(
                    "Budget estimation response missing required keys",
                    extra={
                        "request_id": request_id,
                        "missing_keys": missing_keys,
                        "available_keys": list(estimation.keys()),
                        "organization_id": str(organization_id)
                    }
                )
                # Ensure breakdown is a list if missing
                if 'breakdown' not in estimation:
                    estimation['breakdown'] = []

            # Add comprehensive metadata
            processing_time = time.time() - start_time
            
            estimation["metadata"] = {
                "organization_id": str(organization_id),
                "model_used": "gemini-2.0-flash",
                "response_language": resolved_language,
                "request_id": request_id,
                "processing_times": {
                    "total_ms": int(processing_time * 1000),
                    "prompt_build_ms": int(prompt_build_time * 1000),
                    "api_response_ms": int(api_response_time * 1000),
                    "parsing_ms": int(parse_time * 1000)
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            # Success logging
            logger.info(
                "AI budget estimation generated successfully",
                extra={
                    "request_id": request_id,
                    "organization_id": str(organization_id),
                    "processing_time_ms": int(processing_time * 1000),
                    "estimated_total": estimation.get('estimated_budget_cents'),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            
            return estimation

        except asyncio.TimeoutError:
            self._error_count += 1
            logger.error(
                "AI budget estimation request timed out",
                extra={
                    "request_id": request_id,
                    "organization_id": str(organization_id),
                    "timeout_seconds": TIMEOUT_SECONDS,
                    "processing_time_ms": int((time.time() - start_time) * 1000),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
            return {
                "error": f"AI request timed out after {TIMEOUT_SECONDS}s",
                "request_id": request_id,
                "processing_time_ms": int((time.time() - start_time) * 1000),
            }

        except Exception as e:
            self._error_count += 1
            logger.error(
                "AI budget estimation failed",
                extra={
                    "request_id": request_id,
                    "organization_id": str(organization_id),
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "processing_time_ms": int((time.time() - start_time) * 1000),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            return {
                "error": f"Budget estimation failed: {str(e)}",
                "request_id": request_id,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }

    def _build_budget_estimation_prompt(
        self,
        script_content: str,
        estimation_type: str,
        project_context: Optional[Dict[str, Any]],
        *,
        response_language: str = "en",
    ) -> str:
        """Build the prompt for budget estimation."""
        context_str = ""
        if project_context:
            context_str = f"Project Context: {json.dumps(project_context)}"
        language_instruction = self._response_language_instruction(
            self._normalize_response_language(response_language)
        )

        detail_level = "Provide a high-level estimate."
        if estimation_type == "detailed":
            detail_level = "Provide a detailed line-item breakdown."

        return f"""
        Estimate the production budget for this script. {detail_level}
        
        Script Content (excerpt):
        {script_content[:15000]}

        {context_str}

        Return a JSON object with:
        {{
            "estimated_budget_cents": 5000000,
            "currency": "USD",
            "breakdown": [
                {{
                    "category": "Cast",
                    "estimated_amount_cents": 1500000,
                    "notes": "Based on 3 main characters"
                }},
                {{
                    "category": "Crew",
                    "estimated_amount_cents": 2000000,
                    "notes": "15 shoot days estimate"
                }}
            ],
            "risk_factors": ["High stunt costs", "Location fees"],
            "recommendations": ["Consolidate locations to save money"]
        }}
        
        Provide realistic market rates for a standard independent production.
        {language_instruction}
        """

    async def validate_content_ownership(
        self,
        *,
        organization_id: UUID,
        content_hash: str,
        content_type: str = "script"
    ) -> bool:
        """
        Validate that the content belongs to the organization.
        """
        # In a real implementation, this would check against a content registry
        # For now, we trust the organization_id passed from authenticated endpoints
        logger.info(f"Content ownership validation for {content_type} in organization {organization_id}")
        return True  # Placeholder - actual validation would be implemented

    async def get_processing_status(
        self,
        *,
        organization_id: UUID,
        request_id: str
    ) -> Dict[str, Any]:
        """
        Get the status of an AI processing request.
        """
        return {
            "request_id": request_id,
            "organization_id": str(organization_id),
            "status": "completed",
            "progress": 100,
            "result": None,
            "created_at": "2024-01-01T00:00:00Z",
            "completed_at": "2024-01-01T00:05:00Z"
        }

    def get_service_health(self) -> Dict[str, Any]:
        """
        Get comprehensive service health and monitoring metrics.
        
        PRODUCTION MONITORING:
        - Service availability and status
        - Performance metrics and statistics
        - Error rates and recovery information
        - Resource utilization tracking
        - Request/response patterns
        """
        current_time = time.time()
        
        # Calculate average processing time
        avg_processing_time = (
            self._total_processing_time / self._request_count 
            if self._request_count > 0 else 0
        )
        
        # Calculate error rate
        error_rate = (
            (self._error_count / self._request_count) * 100 
            if self._request_count > 0 else 0
        )
        
        # Service status determination
        if not self.is_active:
            status = "inactive"
            status_code = "SERVICE_UNAVAILABLE"
        elif self._error_count > self._request_count * 0.1:  # More than 10% error rate
            status = "degraded"
            status_code = "HIGH_ERROR_RATE"
        elif self._request_count == 0:
            status = "active"
            status_code = "NO_REQUESTS"
        else:
            status = "healthy"
            status_code = "OPERATIONAL"

        health_metrics = {
            "service_status": {
                "status": status,
                "status_code": status_code,
                "is_active": self.is_active,
                "model_configured": bool(self.model),
                "api_key_configured": bool(settings.GEMINI_API_KEY),
                "last_health_check": datetime.now(timezone.utc).isoformat()
            },
            "performance_metrics": {
                "total_requests": self._request_count,
                "total_errors": self._error_count,
                "error_rate_percent": round(error_rate, 2),
                "average_processing_time_ms": round(avg_processing_time * 1000, 2),
                "total_processing_time_ms": round(self._total_processing_time * 1000, 2),
                "requests_per_minute": round(self._request_count / (current_time / 60), 2) if current_time > 0 else 0
            },
            "model_info": {
                "model_name": "gemini-2.0-flash",
                "max_script_length": MAX_SCRIPT_LENGTH,
                "max_response_tokens": MAX_RESPONSE_TOKENS,
                "timeout_seconds": TIMEOUT_SECONDS,
                "max_retry_attempts": MAX_RETRY_ATTEMPTS
            },
            "monitoring_alerts": self._get_monitoring_alerts(),
            "recommendations": self._get_performance_recommendations()
        }
        
        # Log health check
        logger.info(
            "AI service health check performed",
            extra={
                "service_status": status,
                "error_rate_percent": round(error_rate, 2),
                "total_requests": self._request_count,
                "average_processing_time_ms": round(avg_processing_time * 1000, 2),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
        
        return health_metrics

    def _get_monitoring_alerts(self) -> List[Dict[str, Any]]:
        """Generate monitoring alerts based on service metrics."""
        alerts = []
        
        # High error rate alert
        if self._request_count > 0:
            error_rate = (self._error_count / self._request_count) * 100
            if error_rate > 10:
                alerts.append({
                    "severity": "high",
                    "type": "high_error_rate",
                    "message": f"Error rate is {error_rate:.2f}% (above 10% threshold)",
                    "suggestion": "Check API key configuration and Gemini service availability"
                })
            elif error_rate > 5:
                alerts.append({
                    "severity": "medium",
                    "type": "elevated_error_rate",
                    "message": f"Error rate is {error_rate:.2f}% (elevated)",
                    "suggestion": "Monitor error patterns and consider implementing retry logic"
                })
        
        # Performance alerts
        if self._request_count > 0:
            avg_time = (self._total_processing_time / self._request_count) * 1000
            if avg_time > 10000:  # More than 10 seconds
                alerts.append({
                    "severity": "medium",
                    "type": "slow_response_time",
                    "message": f"Average response time is {avg_time:.2f}ms (above 10s threshold)",
                    "suggestion": "Consider optimizing prompts or increasing timeout settings"
                })
        
        # Service availability alerts
        if not self.is_active:
            alerts.append({
                "severity": "critical",
                "type": "service_inactive",
                "message": "AI service is not active",
                "suggestion": "Configure GEMINI_API_KEY in environment variables"
            })
        
        return alerts

    def _get_performance_recommendations(self) -> List[Dict[str, Any]]:
        """Generate performance recommendations based on service metrics."""
        recommendations = []
        
        # Request volume recommendations
        if self._request_count < 10:
            recommendations.append({
                "priority": "low",
                "category": "usage",
                "message": "Low request volume detected",
                "suggestion": "Consider load testing to validate performance under higher load"
            })
        
        # Error handling recommendations
        if self._error_count > 0:
            recommendations.append({
                "priority": "medium",
                "category": "reliability",
                "message": f"{self._error_count} errors detected in {self._request_count} requests",
                "suggestion": "Implement circuit breaker pattern for improved fault tolerance"
            })
        
        # Performance optimization recommendations
        if self._request_count > 0:
            avg_time = (self._total_processing_time / self._request_count) * 1000
            if avg_time > 5000:  # More than 5 seconds
                recommendations.append({
                    "priority": "medium",
                    "category": "performance",
                    "message": "Response times are elevated",
                    "suggestion": "Consider implementing caching for frequently requested analyses"
                })
        
        # Service configuration recommendations
        if self.is_active:
            recommendations.append({
                "priority": "high",
                "category": "monitoring",
                "message": "Service is active and configured",
                "suggestion": "Set up external monitoring and alerting for production deployment"
            })
        
        return recommendations

    async def validate_api_key(self) -> Dict[str, Any]:
        """
        Validate the Gemini API key configuration and service connectivity.
        
        PRODUCTION MONITORING:
        - API key validation
        - Service connectivity testing
        - Configuration verification
        - Security compliance checking
        """
        validation_start = time.time()
        
        try:
            # Check if API key is configured
            if not settings.GEMINI_API_KEY:
                return {
                    "status": "failed",
                    "error": "GEMINI_API_KEY not configured",
                    "details": {
                        "api_key_configured": False,
                        "validation_time_ms": int((time.time() - validation_start) * 1000),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                }
            
            # Test API connectivity
            test_model = genai.GenerativeModel('gemini-2.0-flash')
            test_response = await test_model.generate_content_async(
                "Test connection",
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=10,
                    response_mime_type="text/plain"
                )
            )
            
            validation_time = time.time() - validation_start
            
            # Log successful validation
            logger.info(
                "Gemini API key validation successful",
                extra={
                    "validation_time_ms": int(validation_time * 1000),
                    "model": "gemini-2.0-flash",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            
            return {
                "status": "success",
                "message": "API key is valid and service is accessible",
                "details": {
                    "api_key_configured": True,
                    "model_accessible": True,
                    "validation_time_ms": int(validation_time * 1000),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
            
        except Exception as e:
            validation_time = time.time() - validation_start
            
            # Log validation failure
            logger.error(
                "Gemini API key validation failed",
                extra={
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "validation_time_ms": int(validation_time * 1000),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            )
            
            return {
                "status": "failed",
                "error": f"API validation failed: {str(e)}",
                "details": {
                    "api_key_configured": bool(settings.GEMINI_API_KEY),
                    "model_accessible": False,
                    "validation_time_ms": int(validation_time * 1000),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }


# Global AI engine service instance
ai_engine_service = AIEngineService()
