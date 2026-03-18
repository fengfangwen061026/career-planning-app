import pytest

from app.ai.llm_provider import _parse_json_tolerant


def test_parse_json_tolerant_accepts_trailing_text() -> None:
    payload = '{"skills": [{"name": "Python"}]}\n\n补充说明：以上为解析结果。'
    assert _parse_json_tolerant(payload) == {"skills": [{"name": "Python"}]}


def test_parse_json_tolerant_accepts_code_fence() -> None:
    payload = '```json\n{"parse_confidence": 0.8, "missing_fields": []}\n```'
    assert _parse_json_tolerant(payload) == {
        "parse_confidence": 0.8,
        "missing_fields": [],
    }


def test_parse_json_tolerant_accepts_trailing_commas() -> None:
    payload = '{"education": [{"school": "X",}], "missing_fields": [],}'
    assert _parse_json_tolerant(payload) == {
        "education": [{"school": "X"}],
        "missing_fields": [],
    }


def test_parse_json_tolerant_raises_without_json() -> None:
    with pytest.raises(ValueError):
        _parse_json_tolerant("not json")
