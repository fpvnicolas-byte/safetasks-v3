import json
import logging
from typing import Dict, Any, List, Optional
from uuid import UUID

import google.generativeai as genai
from app.core.config import settings

logger = logging.getLogger(__name__)


class AIEngineService:
    """
    AI service for script analysis and production assistance.
    Uses Google Gemini 2.0 Flash for structured script breakdown.
    """

    def __init__(self):
        # CORREÇÃO: Inicialização segura. Verifica se a chave existe antes de configurar.
        self.model = None
        self.is_active = False
        
        if settings.GEMINI_API_KEY:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self.model = genai.GenerativeModel('gemini-2.0-flash')
                self.is_active = True
                logger.info("Gemini AI initialized successfully.")
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini AI: {e}")
        else:
            logger.warning("GEMINI_API_KEY not found in settings. AI features disabled.")

    async def analyze_script_content(
        self,
        *,
        organization_id: UUID,
        script_content: str,
        project_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Analyze script content and extract production elements.
        """
        # CORREÇÃO: Fail-fast se a IA não estiver ativa (evita erro no teste)
        if not self.is_active or not self.model:
            logger.error("Attempted to use AI service but it is not initialized")
            return {
                "error": "AI Service unavailable (Missing API Key)",
                "scenes": [], 
                "characters": [], 
                "locations": []
            }

        try:
            # Create the analysis prompt
            prompt = self._build_script_analysis_prompt(script_content, project_id)

            # Call Gemini API with JSON mode
            response = await self.model.generate_content_async(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,  # Low temperature for consistent analysis
                    max_output_tokens=4000,
                    response_mime_type="application/json"
                )
            )

            # Parse the JSON response
            result_text = response.text
            analysis_result = json.loads(result_text)

            # Add metadata
            analysis_result["metadata"] = {
                "organization_id": str(organization_id),
                "project_id": str(project_id) if project_id else None,
                "model_used": "gemini-2.0-flash",
                "analysis_type": "script_breakdown"
            }

            logger.info(f"AI script analysis completed for organization {organization_id}")
            return analysis_result

        except Exception as e:
            logger.error(f"AI script analysis failed: {str(e)}")
            # Retorna erro tratado em vez de quebrar a aplicação
            return {"error": f"Script analysis failed: {str(e)}", "scenes": []}

    async def suggest_production_elements(
        self,
        *,
        organization_id: UUID,
        script_analysis: Dict[str, Any],
        project_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate production suggestions based on script analysis.
        """
        if not self.is_active or not self.model:
            return {"error": "AI Service unavailable"}

        try:
            prompt = self._build_production_suggestions_prompt(script_analysis, project_context)

            response = await self.model.generate_content_async(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2,
                    max_output_tokens=3000,
                    response_mime_type="application/json"
                )
            )

            result_text = response.text
            suggestions = json.loads(result_text)

            logger.info(f"AI production suggestions generated for organization {organization_id}")
            return suggestions

        except Exception as e:
            logger.error(f"AI production suggestions failed: {str(e)}")
            raise Exception(f"Production suggestions failed: {str(e)}")

    def _build_script_analysis_prompt(self, script_content: str, project_id: Optional[UUID]) -> str:
        """Build the prompt for script analysis."""
        return f"""
Analyze this film script and extract key production elements. Focus on practical information needed for production planning.

Script Content:
{script_content[:10000]}  # Limit content length

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

Be specific and practical. Focus on elements that impact production scheduling, equipment needs, and logistics.
"""

    def _build_production_suggestions_prompt(self, script_analysis: Dict[str, Any], project_context: Optional[Dict[str, Any]]) -> str:
        """Build the prompt for production suggestions."""
        context_str = ""
        if project_context:
            context_str = f"\nProject Context: {json.dumps(project_context)}"

        return f"""
Based on this script analysis, provide practical production suggestions:

Script Analysis:
{json.dumps(script_analysis, indent=2)}

{context_str}

Return a JSON object with:
{{
    "call_sheet_suggestions": [
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


# Global AI engine service instance
ai_engine_service = AIEngineService()