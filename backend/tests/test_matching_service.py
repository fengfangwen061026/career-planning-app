from datetime import UTC, datetime, timedelta

import pytest

from app.services import matching


STUDENT_PROFILE = {
    "basic_info": {
        "degree": "本科",
        "major": "计算机科学",
        "location": "广州",
        "work_years": 0,
    },
    "skills": [
        {"name": "Python", "proficiency": "熟练", "evidence": "课程项目"},
        {"name": "Office", "proficiency": "熟练", "evidence": "日常使用"},
    ],
    "soft_skills": [
        {"dimension": "沟通能力", "score": 0.75, "evidence": "多次项目汇报"},
        {"dimension": "团队协作", "score": 0.7, "evidence": "多人协作项目"},
        {"dimension": "学习能力", "score": 0.8, "evidence": "持续自学新工具"},
    ],
    "experiences": [
        {"type": "project", "title": "校园项目"},
        {"type": "internship", "title": "暑期实习"},
    ],
    "awards": [{"name": "创新大赛一等奖"}],
    "self_intro": "学习快，愿意主动解决问题。",
    "dimensions": {
        "basic_requirements": {
            "degree": "本科",
            "major": "计算机科学",
            "city": "广州",
            "work_years": 0,
        },
        "professional_skills": [
            {"skill_name": "Python", "proficiency": "熟练", "proficiency_evidence": "课程项目"},
            {"skill_name": "Office", "proficiency": "熟练", "proficiency_evidence": "日常使用"},
        ],
        "soft_competencies": {
            "沟通能力": {"value": 0.75},
            "团队协作": {"value": 0.7},
            "学习能力": {"value": 0.8},
        },
    },
}

JOB_PROFILE = {
    "role_name": "数据分析师",
    "summary": "负责数据整理与分析，支撑业务决策。",
    "basic_requirements": {
        "education": "本科",
        "majors": ["计算机", "统计学"],
        "experience_years": {"min": 0, "preferred": 1},
        "cities": ["广州"],
    },
    "technical_skills": [
        {"skill_name": "Python", "importance": "required", "weight": 1.0},
        {"skill_name": "Excel", "importance": "preferred", "weight": 0.7},
    ],
    "soft_competencies": {
        "communication": {"value": 4},
        "teamwork": {"value": 4},
        "learning_ability": {"value": 5},
        "stress_tolerance": {"value": 3},
        "innovation": {"value": 3},
    },
}


@pytest.mark.asyncio
async def test_compute_match_recommend_mode_returns_complete_structure(monkeypatch) -> None:
    async def fail_if_called(*args, **kwargs):
        raise AssertionError("LLM should not be called in recommend mode")

    async def fake_embed_batch(texts: list[str]) -> list[list[float]]:
        return [[float(index + 1), 1.0] for index, _ in enumerate(texts)]

    monkeypatch.setattr(matching.llm, "generate_json", fail_if_called)
    monkeypatch.setattr(matching.embedding_provider, "embed_batch", fake_embed_batch)

    result = await matching.compute_match(
        STUDENT_PROFILE,
        JOB_PROFILE,
        role_category="技术类",
        mode="recommend",
        role_name="数据分析师",
    )

    assert result.scores.total_score > 0
    assert result.scores.basic.score > 0
    assert result.scores.skill.score > 0
    assert result.scores.competency.items
    assert result.scores.potential.items
    assert result.reasons
    assert result.job_info["title"] == "数据分析师"


@pytest.mark.asyncio
async def test_score_skills_returns_exact_match_result_when_embedding_fails(monkeypatch) -> None:
    async def fail_embed_batch(texts: list[str]) -> list[list[float]]:
        raise RuntimeError("embedding provider unavailable")

    monkeypatch.setattr(matching.embedding_provider, "embed_batch", fail_embed_batch)

    score = await matching.score_skills(STUDENT_PROFILE, JOB_PROFILE)

    python_item = next(item for item in score.items if item.skill_name == "Python")
    excel_item = next(item for item in score.items if item.skill_name == "Excel")

    assert python_item.matched is True
    assert python_item.matched_by == "exact"
    assert excel_item.matched is False
    assert score.score >= 0


def test_cached_match_freshness_tracks_job_and_role_updates() -> None:
    now = datetime.now(UTC)

    assert matching._is_cached_match_fresh(
        now,
        now - timedelta(minutes=5),
        now - timedelta(minutes=1),
        now - timedelta(minutes=2),
    )
    assert not matching._is_cached_match_fresh(
        now,
        now - timedelta(minutes=5),
        now + timedelta(minutes=1),
        now - timedelta(minutes=2),
    )
    assert not matching._is_cached_match_fresh(
        now,
        now - timedelta(minutes=5),
        now - timedelta(minutes=1),
        now + timedelta(minutes=1),
    )
