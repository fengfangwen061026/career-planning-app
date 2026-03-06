"""Tests for resume parser service - unit tests for text extraction and normalization."""

import pytest

from app.services.resume_parser import (
    compute_completeness_score,
    generate_missing_suggestions,
    normalize_parsed_skills,
)
from app.utils.skill_normalizer import normalize_skill

# ---------------------------------------------------------------------------
# Sample parsed resume data (simulates LLM output)
# ---------------------------------------------------------------------------

SAMPLE_PARSED_DATA = {
    "basic_info": {
        "name": "张三",
        "gender": "男",
        "birth_date": "2000.06",
        "phone": "13800138000",
        "email": "zhangsan@example.com",
        "location": "北京",
        "hometown": "河北",
        "job_intention": "前端开发工程师",
        "expected_salary": "8000-12000",
        "work_years": "应届",
    },
    "education": [
        {
            "school": "北京理工大学",
            "major": "计算机科学与技术",
            "degree": "本科",
            "start_date": "2019.09",
            "end_date": "2023.06",
            "gpa": "3.6/4.0",
            "courses": ["数据结构", "操作系统", "计算机网络"],
            "honors": ["校级优秀学生"],
            "_evidence": "北京理工大学 计算机科学与技术 本科 2019.09-2023.06",
        }
    ],
    "work_experience": [
        {
            "company": "字节跳动",
            "title": "前端开发实习生",
            "start_date": "2022.06",
            "end_date": "2022.09",
            "type": "实习",
            "responsibilities": ["参与抖音电商前端开发", "使用 React 开发组件"],
            "achievements": ["优化页面加载速度提升30%"],
            "_evidence": "字节跳动 前端开发实习生 2022.06-2022.09",
        }
    ],
    "project_experience": [
        {
            "name": "个人博客系统",
            "role": "独立开发",
            "start_date": "2022.10",
            "end_date": "2023.01",
            "tech_stack": ["reactjs", "nodejs", "mongodb"],
            "description": "基于 React + Node.js 的全栈博客系统",
            "achievements": ["支持 Markdown 编辑", "日活用户 200+"],
            "_evidence": "个人博客系统项目...",
        }
    ],
    "skills": [
        {"category": "programming", "name": "js", "proficiency": "熟练", "proficiency_evidence": "多个项目使用"},
        {"category": "programming", "name": "typescript", "proficiency": "熟悉", "proficiency_evidence": "项目中使用"},
        {"category": "programming", "name": "python", "proficiency": "掌握", "proficiency_evidence": "课程学习"},
        {"category": "professional", "name": "reactjs", "proficiency": "熟练", "proficiency_evidence": "实习+项目"},
        {"category": "professional", "name": "nodejs", "proficiency": "熟悉", "proficiency_evidence": "项目使用"},
    ],
    "certificates": [
        {"name": "CET-6", "date": "2021.06", "level": "550分"},
    ],
    "awards": [
        {"name": "校级编程竞赛一等奖", "date": "2021.11", "level": "校级"},
    ],
    "campus_activities": [
        {
            "organization": "计算机学院学生会",
            "role": "技术部部长",
            "period": "2020.09-2021.06",
            "description": "组织技术分享活动",
        }
    ],
    "soft_skills": {
        "communication": {"score": 3, "evidence": ["组织技术分享活动"], "confidence": "medium"},
        "teamwork": {"score": 3, "evidence": ["参与前端开发团队"], "confidence": "medium"},
        "leadership": {"score": 3, "evidence": ["技术部部长"], "confidence": "medium"},
        "stress_tolerance": {"score": 2, "evidence": [], "confidence": "low"},
        "learning_ability": {"score": 4, "evidence": ["多个技术栈", "GPA 3.6"], "confidence": "high"},
        "responsibility": {"score": 3, "evidence": ["技术部部长"], "confidence": "medium"},
    },
    "self_evaluation": "热爱前端开发，有良好的团队协作能力",
    "_meta": {
        "parse_confidence": 0.85,
        "missing_fields": [],
        "ambiguous_fields": [],
    },
}


# ---------------------------------------------------------------------------
# Tests: skill normalization
# ---------------------------------------------------------------------------


class TestSkillNormalization:
    def test_js_to_javascript(self):
        assert normalize_skill("js") == "JavaScript"

    def test_reactjs_to_react(self):
        assert normalize_skill("reactjs") == "React"

    def test_nodejs_to_node(self):
        assert normalize_skill("nodejs") == "Node.js"

    def test_python_unchanged(self):
        assert normalize_skill("python") == "Python"

    def test_mongodb_to_mongo(self):
        assert normalize_skill("mongodb") == "MongoDB"

    def test_unknown_skill_titled(self):
        assert normalize_skill("fastapi") == "Fastapi"

    def test_normalize_parsed_skills(self):
        data = {
            "skills": [
                {"name": "js", "category": "programming"},
                {"name": "reactjs", "category": "professional"},
            ],
            "project_experience": [
                {"tech_stack": ["nodejs", "mongodb"]},
            ],
        }
        result, log = normalize_parsed_skills(data)

        assert result["skills"][0]["name"] == "JavaScript"
        assert result["skills"][1]["name"] == "React"
        assert result["project_experience"][0]["tech_stack"] == ["Node.js", "MongoDB"]
        assert len(log) == 4


# ---------------------------------------------------------------------------
# Tests: completeness score
# ---------------------------------------------------------------------------


class TestCompletenessScore:
    def test_full_resume(self):
        score = compute_completeness_score(SAMPLE_PARSED_DATA)
        # Sample has 1 entry per list dimension (0.5 fill rate each), so ~0.6-0.7
        assert 0.5 < score <= 1.0

    def test_empty_resume(self):
        score = compute_completeness_score({})
        assert score == 0.0

    def test_partial_resume(self):
        partial = {
            "basic_info": {"name": "Test", "email": "test@test.com"},
            "education": [{"school": "X", "major": "Y", "degree": "本科"}],
            "skills": [{"name": "Python"}],
        }
        score = compute_completeness_score(partial)
        assert 0.2 < score < 0.7


# ---------------------------------------------------------------------------
# Tests: missing suggestions
# ---------------------------------------------------------------------------


class TestMissingSuggestions:
    def test_full_resume_few_suggestions(self):
        suggestions = generate_missing_suggestions(SAMPLE_PARSED_DATA)
        # Full resume should have few or no critical suggestions
        assert len(suggestions) <= 3

    def test_empty_resume_many_suggestions(self):
        suggestions = generate_missing_suggestions({})
        assert len(suggestions) >= 3

    def test_missing_email(self):
        data = {"basic_info": {"name": "Test"}}
        suggestions = generate_missing_suggestions(data)
        assert any("邮箱" in s for s in suggestions)

    def test_missing_work_experience(self):
        data = {"basic_info": {"name": "Test", "email": "t@t.com", "phone": "123"}}
        suggestions = generate_missing_suggestions(data)
        assert any("工作" in s or "实习" in s for s in suggestions)

    def test_missing_quantified_achievements(self):
        data = {
            "basic_info": {"name": "T", "email": "t@t.com", "phone": "1"},
            "work_experience": [
                {"company": "X", "title": "Dev", "responsibilities": ["Coding"]},
            ],
        }
        suggestions = generate_missing_suggestions(data)
        assert any("量化成果" in s for s in suggestions)
