import json
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import status

from app.api.v1.endpoints.ai import _map_ai_error_to_http
from app.services.ai_engine import AIEngineService, MAX_RETRY_ATTEMPTS


def _valid_analysis_payload() -> str:
    return json.dumps(
        {
            "characters": [],
            "locations": [],
            "scenes": [],
            "suggested_equipment": [],
            "production_notes": [],
        }
    )


@pytest.mark.asyncio
async def test_analyze_script_retries_on_resource_exhausted(monkeypatch):
    service = AIEngineService()

    class FlakyModel:
        def __init__(self):
            self.calls = 0

        async def generate_content_async(self, prompt, generation_config):  # noqa: ARG002
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError(
                    "429 Resource exhausted. Please try again later. "
                    "Please refer to https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429 for more details."
                )
            return SimpleNamespace(text=_valid_analysis_payload())

    model = FlakyModel()
    service.model = model
    service.is_active = True

    sleep_calls: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        sleep_calls.append(seconds)

    monkeypatch.setattr("app.services.ai_engine.asyncio.sleep", fake_sleep)

    result = await service.analyze_script_content(
        organization_id=uuid4(),
        project_id=uuid4(),
        script_content="INT. OFFICE - DAY\nA short test script.",
    )

    assert "error" not in result
    assert model.calls == 2
    assert len(sleep_calls) == 1


@pytest.mark.asyncio
async def test_analyze_script_returns_error_after_retry_exhaustion(monkeypatch):
    service = AIEngineService()

    class AlwaysFailingModel:
        def __init__(self):
            self.calls = 0

        async def generate_content_async(self, prompt, generation_config):  # noqa: ARG002
            self.calls += 1
            raise RuntimeError("429 Resource exhausted. Please try again later.")

    model = AlwaysFailingModel()
    service.model = model
    service.is_active = True

    async def fake_sleep(seconds: float) -> None:  # noqa: ARG001
        return None

    monkeypatch.setattr("app.services.ai_engine.asyncio.sleep", fake_sleep)

    result = await service.analyze_script_content(
        organization_id=uuid4(),
        project_id=uuid4(),
        script_content="INT. OFFICE - DAY\nA short test script.",
    )

    assert "error" in result
    assert "Resource exhausted" in result["error"]
    assert model.calls == MAX_RETRY_ATTEMPTS


def test_map_ai_error_to_http_uses_429_for_provider_throttle():
    code, detail = _map_ai_error_to_http("Script analysis failed: 429 Resource exhausted")
    assert code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "Resource exhausted" in detail


def test_map_ai_error_to_http_uses_504_for_timeout():
    code, detail = _map_ai_error_to_http("AI request timed out after 60s")
    assert code == status.HTTP_504_GATEWAY_TIMEOUT
    assert "timed out" in detail
