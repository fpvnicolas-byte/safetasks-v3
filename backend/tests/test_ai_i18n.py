from app.api.v1.endpoints.ai import (
    _equipment_recommendation_copy,
    is_post_production_note,
    infer_suggestion_priority_confidence,
    infer_suggestion_type,
    _localized_text,
    _resolve_response_language,
    _schedule_recommendation_copy,
)
from app.services.ai_engine import AIEngineService


def test_detect_content_language_pt_br():
    service = AIEngineService()

    language = service.detect_content_language(
        "INT. CASA - DIA\nNao, este roteiro tem 3 cenas e personagens principais."
    )

    assert language == "pt-BR"


def test_detect_content_language_en():
    service = AIEngineService()

    language = service.detect_content_language(
        "INT. HOUSE - DAY\nThis script has 3 scenes and key characters."
    )

    assert language == "en"


def test_infer_response_language_prioritizes_script_content_over_analysis_payload():
    service = AIEngineService()

    language = service._infer_response_language(
        script_content="EXT. RUA - NOITE\nEste roteiro precisa de locacao e equipe.",
        script_analysis={
            "characters": [],
            "locations": [],
            "scenes": [],
        },
    )

    assert language == "pt-BR"


def test_script_prompt_includes_requested_response_language():
    service = AIEngineService()

    prompt = service._build_script_analysis_prompt(
        "EXT. RUA - NOITE\nUma cena simples.",
        None,
        response_language="pt-BR",
    )

    assert "Use Brazilian Portuguese (pt-BR)" in prompt


def test_resolve_response_language_prefers_metadata_when_present():
    language = _resolve_response_language(
        script_content="EXT. RUA - NOITE\nEste roteiro esta em portugues.",
        analysis_result={"metadata": {"response_language": "en"}},
    )

    assert language == "en"


def test_resolve_response_language_detects_script_language():
    language = _resolve_response_language(
        script_content="INT. APARTAMENTO - DIA\nEste roteiro tem cenas e personagens.",
    )

    assert language == "pt-BR"


def test_localized_text_returns_pt_br_copy():
    text = _localized_text(
        "pt-BR",
        pt_br="Mensagem em portugues",
        en="English message",
    )

    assert text == "Mensagem em portugues"


def test_equipment_recommendation_copy_is_localized():
    title, description = _equipment_recommendation_copy("pt-BR", ["Camera", "Tripod"])

    assert title == "Recomendações de Equipamentos"
    assert "análise do roteiro" in description


def test_schedule_recommendation_copy_is_localized():
    title, description, action_items = _schedule_recommendation_copy("pt-BR", 5, 2)

    assert title == "Recomendações de Cronograma de Produção"
    assert "Seu roteiro contém 5 cenas em 2 locações." in description
    assert action_items[0] == "Planejar 5 cenas"


def test_infer_suggestion_type_handles_portuguese_keywords():
    assert infer_suggestion_type("Seguranca chuva.") == "schedule"
    assert infer_suggestion_type("Efeitos visuais no set.") == "other"
    assert infer_suggestion_type("Min. cenario e locacao.") == "logistics"


def test_infer_suggestion_priority_confidence_varies_by_content():
    high_priority, high_confidence = infer_suggestion_priority_confidence(
        "Seguranca chuva.",
        "schedule",
    )
    low_priority, low_confidence = infer_suggestion_priority_confidence(
        "UI na pos.",
        "other",
    )

    assert high_priority == "high"
    assert high_confidence > 0.8
    assert low_priority == "low"
    assert low_confidence < 0.7


def test_is_post_production_note_detects_pt_br_terms():
    assert is_post_production_note("Efeitos visuais.")
    assert is_post_production_note("Alto contraste.")
    assert not is_post_production_note("Seguranca chuva.")
