import json
from typing import Dict, List, Optional, Any
import google.generativeai as genai

from app.core.config import settings


class GeminiScriptAnalyzer:
    """
    AI adapter for analyzing scripts using Google Gemini.
    Handles script text processing and structured data extraction.
    """

    def __init__(self):
        """Initialize Gemini client with API key."""
        genai.configure(api_key=settings.GOOGLE_API_KEY)
        self.model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.1,  # Low temperature for consistent structured output
                "top_p": 0.8,
                "top_k": 40,
                "max_output_tokens": 8192,
            }
        )

    async def analyze_script_text(self, text: str) -> Dict[str, Any]:
        """
        Analyze script text and extract structured scene and breakdown data.

        Args:
            text: The full script text content

        Returns:
            Dict containing structured scene and breakdown data

        Raises:
            Exception: If AI analysis fails
        """
        prompt = self._build_analysis_prompt(text)

        try:
            response = await self.model.generate_content_async(prompt)
            result_text = response.text.strip()

            # Parse JSON response
            try:
                parsed_data = json.loads(result_text)
                return self._validate_and_clean_response(parsed_data)
            except json.JSONDecodeError as e:
                raise Exception(f"Failed to parse AI response as JSON: {e}")

        except Exception as e:
            raise Exception(f"Gemini API error: {str(e)}")

    def _build_analysis_prompt(self, script_text: str) -> str:
        """
        Build the analysis prompt for Gemini.

        Args:
            script_text: The script text to analyze

        Returns:
            Formatted prompt string
        """
        return f"""
Analyze this film/TV script and extract structured information for production breakdown.

SCRIPT TEXT:
{script_text[:50000]}  # Limit text length for API constraints

INSTRUCTIONS:
Return a JSON object with the following structure:
{{
  "scenes": [
    {{
      "number": "scene number (e.g., '1', '1A', 'EXT-001')",
      "heading": "INT/EXT LOCATION - TIME (e.g., 'INT. LIVING ROOM - DAY')",
      "description": "brief summary of what happens in the scene",
      "time": "time of day (DAY, NIGHT, DAWN, DUSK, MORNING, EVENING, etc.)",
      "location": "specific location description",
      "breakdown_items": [
        {{
          "category": "CAST|CREW|PROPS|WARDROBE|EQUIPMENT|LOCATIONS|VEHICLES|ANIMALS|SPECIAL_EFFECTS",
          "name": "specific item name (character name, prop description, etc.)",
          "description": "additional details if needed",
          "quantity": 1,
          "usage_type": "HERO|BACKGROUND|STUNT|ATMOSPHERE|etc."
        }}
      ]
    }}
  ]
}}

GUIDELINES:
- Extract ALL scenes from the script
- For CAST category: include all characters mentioned
- For PROPS: include any objects, furniture, or items specifically mentioned
- For LOCATIONS: include specific places or sets
- For VEHICLES: include any cars, transportation mentioned
- For ANIMALS: include any animals mentioned
- For SPECIAL_EFFECTS: include any effects, weather, or technical requirements
- Be comprehensive but avoid duplicates
- Use exact names from the script when possible

Ensure the response is valid JSON only.
"""

    def _validate_and_clean_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate and clean the AI response data.

        Args:
            data: Raw AI response data

        Returns:
            Validated and cleaned data

        Raises:
            ValueError: If data structure is invalid
        """
        if not isinstance(data, dict) or "scenes" not in data:
            raise ValueError("Invalid response structure: missing 'scenes' key")

        scenes = data["scenes"]
        if not isinstance(scenes, list):
            raise ValueError("Invalid scenes data: must be a list")

        # Validate and clean each scene
        cleaned_scenes = []
        for scene_data in scenes:
            if not isinstance(scene_data, dict):
                continue

            # Ensure required fields
            required_fields = ["number", "heading", "description"]
            if not all(field in scene_data for field in required_fields):
                continue

            # Clean breakdown items
            breakdown_items = scene_data.get("breakdown_items", [])
            if not isinstance(breakdown_items, list):
                breakdown_items = []

            cleaned_items = []
            for item in breakdown_items:
                if isinstance(item, dict) and "category" in item and "name" in item:
                    # Ensure category is valid
                    category = item.get("category", "").upper()
                    if category not in ["CAST", "CREW", "PROPS", "WARDROBE", "EQUIPMENT",
                                      "LOCATIONS", "VEHICLES", "ANIMALS", "SPECIAL_EFFECTS"]:
                        category = "PROPS"  # Default fallback

                    cleaned_items.append({
                        "category": category,
                        "name": item.get("name", ""),
                        "description": item.get("description", ""),
                        "quantity": item.get("quantity", 1),
                        "usage_type": item.get("usage_type", "ATMOSPHERE")
                    })

            cleaned_scenes.append({
                "number": str(scene_data.get("number", "")),
                "heading": scene_data.get("heading", ""),
                "description": scene_data.get("description", ""),
                "time": scene_data.get("time", ""),
                "location": scene_data.get("location", ""),
                "breakdown_items": cleaned_items
            })

        return {"scenes": cleaned_scenes}


# Global analyzer instance
script_analyzer = GeminiScriptAnalyzer()