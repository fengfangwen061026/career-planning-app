import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

import app.services.matching as matching_service
from app.services import report


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalars(self):
        return self

    def first(self):
        return self._value


class _FakeSession:
    def __init__(self, execute_results):
        self._execute_results = list(execute_results)

    async def execute(self, _statement):
        if not self._execute_results:
            raise AssertionError("unexpected execute call")
        return _ScalarResult(self._execute_results.pop(0))


@pytest.mark.asyncio
async def test_generate_full_report_uses_deep_match_for_explicit_jobs(monkeypatch) -> None:
    student_id = uuid4()
    job_profile_id = uuid4()
    seen_modes: list[str] = []
    captured_report_data: dict[str, object] = {}
    db = _FakeSession([
        SimpleNamespace(id=uuid4(), profile_json={"basic_info": {"name": "Student"}}),
    ])

    async def fake_match_student_job(_db, called_student_id, called_job_profile_id, *, mode="deep"):
        seen_modes.append(mode)
        assert called_student_id == student_id
        assert called_job_profile_id == job_profile_id
        return SimpleNamespace(
            job_profile_id=called_job_profile_id,
            total_score=0.82,
            scores_json={
                "job_info": {"role": "Data Analyst", "title": "Data Analyst"},
                "basic": {"score": 91},
                "skill": {"score": 82},
                "competency": {"score": 73},
                "potential": {"score": 64},
            },
            gaps_json=[],
        )

    async def fake_find_path(*_args, **_kwargs):
        return {"action_plan": []}

    async def fake_generate_outline(*_args, **_kwargs):
        return {"chapters": []}

    async def fake_generate_chapters(*_args, **_kwargs):
        return []

    async def fake_merge_and_save(_student_id, report_data, _db):
        captured_report_data.update(report_data)
        return SimpleNamespace(
            id=uuid4(),
            student_id=student_id,
            version="1.0",
            summary="summary",
            status="completed",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    monkeypatch.setattr(matching_service, "match_student_job", fake_match_student_job)
    monkeypatch.setattr(report, "find_path_with_student_profile", fake_find_path)
    monkeypatch.setattr(report, "generate_outline", fake_generate_outline)
    monkeypatch.setattr(report, "generate_chapters", fake_generate_chapters)
    monkeypatch.setattr(report, "merge_and_save", fake_merge_and_save)

    generated = await report.generate_full_report(student_id, db, [job_profile_id])

    assert generated.student_id == student_id
    assert seen_modes == ["deep"]
    assert captured_report_data["matching_results"][0]["job_id"] == str(job_profile_id)


@pytest.mark.asyncio
async def test_generate_outline_tolerates_provider_latency_above_two_seconds(monkeypatch) -> None:
    async def slow_generate_json(**_kwargs):
        await asyncio.sleep(2.1)
        return {"title": "report", "chapters": [{"chapter_id": 1, "title": "A"}]}

    monkeypatch.setattr(report.llm, "generate_json", slow_generate_json)

    result = await report.generate_outline({"basic_info": {}}, [], {})

    assert result.get("generated_by") != "fallback"
    assert result["chapters"][0]["chapter_id"] == 1


def test_build_export_chart_html_uses_matching_result_scores() -> None:
    html = report._build_export_chart_html({
        "matching_results": [
            {
                "scores_json": {
                    "basic": {"score": 91},
                    "skill": {"score": 82},
                    "competency": {"score": 73},
                    "potential": {"score": 64},
                }
            }
        ]
    })

    assert "width: 91%" in html
    assert "width: 82%" in html
    assert "width: 73%" in html
    assert "width: 64%" in html
