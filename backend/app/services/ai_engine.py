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
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-2.0-flash')

    async def analyze_script_content(
        self,
        *,
        organization_id: UUID,
        script_content: str,
        project_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Analyze script content and extract production elements.

        Args:
            organization_id: Organization that owns the script
            script_content: The script text to analyze
            project_id: Optional project context

        Returns:
            Dict with characters, locations, scenes, and equipment suggestions
        """
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
            raise Exception(f"Script analysis failed: {str(e)}")

    async def suggest_production_elements(
        self,
        *,
        organization_id: UUID,
        script_analysis: Dict[str, Any],
        project_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate production suggestions based on script analysis.

        Args:
            organization_id: Organization context
            script_analysis: Results from script analysis
            project_context: Additional project information

        Returns:
            Dict with production suggestions
        """
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
        This is a security check to ensure AI processing only happens on owned content.

        Args:
            organization_id: Organization claiming ownership
            content_hash: Hash of the content for verification
            content_type: Type of content (script, document, etc.)

        Returns:
            True if content belongs to organization
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

        Args:
            organization_id: Organization that initiated the request
            request_id: Unique request identifier

        Returns:
            Processing status and results if complete
        """
        # In a real implementation, this would check a job queue or database
        # For now, return a placeholder status
        return {
            "request_id": request_id,
            "organization_id": str(organization_id),
            "status": "completed",  # pending, processing, completed, failed
            "progress": 100,
            "result": None,  # Would contain the analysis result
            "created_at": "2024-01-01T00:00:00Z",
            "completed_at": "2024-01-01T00:05:00Z"
        }


# Global AI engine service instance
ai_engine_service = AIEngineService()
