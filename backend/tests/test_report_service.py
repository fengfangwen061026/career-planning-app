from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

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


class _PolishSession:
    def __init__(self, report_obj):
        self.report_obj = report_obj
        self.added = []
        self.committed = False

    async def get(self, _model, _report_id):
        return self.report_obj

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True


@pytest.mark.asyncio
async def test_generate_full_report_uses_deep_match_for_explicit_jobs(monkeypatch) -> None:
    student_id = uuid4()
    job_profile_id = uuid4()
    seen_modes: list[str] = []
    captured_report_data: dict[str, object] = {}
    db = _FakeSession([])

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

    async def fake_load_student_profile(_student_id, _db):
        return SimpleNamespace(id=student_id, name="Student"), {"basic_info": {"name": "Student"}}

    monkeypatch.setattr(report, "_load_student_profile", fake_load_student_profile)
    monkeypatch.setattr(report, "match_student_job", fake_match_student_job)
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
    result = await report.generate_outline({"basic_info": {}}, [], {})

    assert result.get("generated_by") == "template"
    assert result["chapters"][0]["chapter_id"] == 1


@pytest.mark.asyncio
async def test_generate_chapters_uses_llm_and_extracts_structured_data(monkeypatch) -> None:
    student_profile = {
        "basic_info": {
            "name": "张明远",
            "school": "华东理工大学",
            "major": "软件工程",
        },
        "competitiveness_score": 76,
        "skills": ["Python", "SQL", "数据分析", "可视化", "机器学习"],
        "experience": {
            "projects": [{"project_name": "用户流失预测平台"}],
            "work": [{"company": "某科技公司", "title": "数据分析实习生"}],
        },
    }
    matching_results = [
        {
            "job_profile_id": str(uuid4()),
            "total_score": 0.78,
            "scores_json": {
                "job_info": {"role": "数据分析师", "title": "数据分析师"},
                "basic": {"score": 85},
                "skill": {"score": 81},
                "competency": {"score": 74},
                "potential": {"score": 69},
                "match_reasons": ["有数据分析项目经历", "SQL 能力较匹配"],
            },
            "gaps_json": [
                {
                    "gap_item": "必备技能: Tableau",
                    "current_level": "基础薄弱",
                    "required_level": "可独立完成报表",
                    "priority": "high",
                    "suggestion": "通过官方文档和实战项目补齐 Tableau 看板能力",
                }
            ],
        }
    ]
    seen_prompts: list[str] = []

    async def fake_generate(*, prompt, system_prompt, max_tokens, **kwargs):
        del max_tokens, kwargs
        seen_prompts.append(prompt)
        assert system_prompt == report.REPORT_SYSTEM_PROMPT
        if "目标岗位分析" in prompt:
            return """该岗位强调数据处理、业务理解与结果表达的结合，你当前具备较好的切入基础，但仍需补齐部分工具化输出能力。

```json
{
  "overall_score": 78,
  "dimensions": {
    "basic": {"score": 85, "reason": "专业背景与岗位方向较贴近"},
    "skills": {"score": 81, "reason": "SQL 与分析项目支撑度较高"},
    "competency": {"score": 74, "reason": "结果表达仍有强化空间"},
    "potential": {"score": 69, "reason": "具备继续成长的学习曲线"}
  }
}
```"""
        if "差距与行动计划" in prompt:
            return """当前主要差距集中在报表工具与分析结果交付层面，若先补齐核心工具能力，综合匹配分还有较明确的上升空间。

```json
{
  "short_term": [
    {
      "priority": "必须补齐",
      "item": "Tableau 看板搭建",
      "gap_desc": "缺少完整仪表盘交付经验",
      "score_impact": -10,
      "action": "通过 Tableau 官方文档和一个业务分析实战项目完成 1 套作品",
      "timeline": "3周内",
      "resources": ["Tableau 官方学习路径", "Kaggle 商业分析项目"]
    }
  ],
  "medium_term": [
    {
      "priority": "建议提升",
      "item": "业务汇报表达",
      "gap_desc": "分析结论的业务化表达仍需强化",
      "score_impact": 4,
      "action": "每月复盘 1 次项目结论输出并沉淀汇报模板",
      "timeline": "6个月内",
      "resources": ["STAR 复盘模板"]
    }
  ]
}
```"""
        if "评估周期" in prompt:
            return """建议按月检查技能补齐进展，在第 3 个月和第 6 个月分别做一次量化复盘，确保能力提升能反映到新的匹配结果中。

```json
{
  "review_checkpoints": [
    {"month": 1, "goal": "完成 Tableau 入门", "kpi": "完成 1 套可展示仪表盘", "action": "提交作品集链接"},
    {"month": 3, "goal": "综合分提升至 83 分", "kpi": "重新运行匹配后达到 83 分", "action": "更新简历并重跑匹配"},
    {"month": 6, "goal": "完成中期表达提升", "kpi": "完成 2 次业务分析汇报", "action": "补充项目汇报材料"}
  ]
}
```"""
        return "这是 LLM 生成的章节正文。"

    monkeypatch.setattr(report.llm, "generate", fake_generate)

    chapters = await report.generate_chapters({}, student_profile, matching_results, None, SimpleNamespace())

    assert len(chapters) == 5
    assert len(seen_prompts) == 5
    assert chapters[0]["text"] == "这是 LLM 生成的章节正文。"
    assert chapters[1]["data"]["overall_score"] == 78
    assert chapters[1]["data"]["dimensions"][0]["key"] == "basic"
    assert chapters[1]["data"]["dimensions"][0]["score"] == 85
    assert chapters[2]["data"]["short_term"][0]["item"] == "Tableau 看板搭建"
    assert chapters[4]["data"]["review_checkpoints"][1]["month"] == 3


@pytest.mark.asyncio
async def test_generate_chapters_falls_back_to_template_for_failed_chapter(monkeypatch) -> None:
    student_profile = {
        "basic_info": {"name": "李婷", "school": "上海大学", "major": "市场营销"},
        "skills": ["内容策划", "数据分析"],
    }
    matching_results = [
        {
            "job_profile_id": str(uuid4()),
            "total_score": 0.66,
            "scores_json": {
                "job_info": {"role": "运营专员", "title": "运营专员"},
                "basic": {"score": 72},
                "skill": {"score": 68},
                "competency": {"score": 61},
                "potential": {"score": 63},
            },
            "gaps_json": [],
        }
    ]

    async def fake_generate(*, prompt, **kwargs):
        del kwargs
        if "目标岗位分析" in prompt:
            raise RuntimeError("LLM unavailable")
        return "这是成功生成的正文。"

    monkeypatch.setattr(report.llm, "generate", fake_generate)

    template_chapters = report._build_report_content(student_profile, matching_results, None)[0]["chapters"]
    chapters = await report.generate_chapters({}, student_profile, matching_results, None, SimpleNamespace())

    assert chapters[0]["text"] == "这是成功生成的正文。"
    assert chapters[1]["text"] == template_chapters[1]["text"]
    assert chapters[1]["data"] == template_chapters[1]["data"]
    assert chapters[2]["text"] == "这是成功生成的正文。"


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


def test_build_actions_translates_raw_gap_keys_into_user_facing_copy() -> None:
    actions = report._build_actions({
        "gaps_json": [
            {
                "gap_item": "major_relevance",
                "current_level": "不足",
                "required_level": "未知",
                "priority": "high",
                "suggestion": "建议针对该项短板制定补齐计划",
            }
        ]
    })

    assert actions[0]["item"] == "专业与岗位方向匹配度"
    assert "专业背景" in actions[0]["gap_desc"]
    assert "转向理由" in actions[0]["action"]


def test_build_report_content_uses_target_role_centered_primary_path() -> None:
    content, _, _ = report._build_report_content(
        {"basic_info": {"name": "张明远", "major": "计算机科学与技术"}},
        [
            {
                "job_profile_id": str(uuid4()),
                "total_score": 0.58,
                "scores_json": {
                    "job_info": {"role": "推广专员", "title": "推广专员"},
                    "basic": {"score": 52},
                    "skill": {"score": 61},
                    "competency": {"score": 55},
                    "potential": {"score": 64},
                },
                "gaps_json": [
                    {
                        "gap_item": "major_relevance",
                        "current_level": "不足",
                        "required_level": "未知",
                        "priority": "high",
                    }
                ],
            }
        ],
        {
            "main_path": [{"name": "后端开发工程师", "level": "entry"}],
            "alternative_paths": [{"intermediate_role": "商务拓展"}],
            "action_plan": [{"action": "补齐岗位核心技能"}],
        },
    )

    primary_path = content["paths"]["primary_path"]
    assert primary_path[0]["title"] == "推广专员 准备期"
    assert primary_path[1]["title"] == "推广专员（初级）"
    assert "后端开发工程师" not in primary_path[0]["title"]


@pytest.mark.asyncio
async def test_polish_report_uses_llm_to_rewrite_summary_and_chapters(monkeypatch) -> None:
    report_obj = SimpleNamespace(
        id=uuid4(),
        content_json={
            "title": "张明远 - 推广专员职业发展报告",
            "summary": "原摘要。",
            "target_job": {"role_name": "推广专员"},
            "dimensions": [],
            "actions": [],
            "paths": {"primary_path": [], "alt_paths": []},
            "chapters": [
                {"chapter_id": 1, "title": "一、个人优势总结", "text": "原第一章。", "status": "done"},
                {"chapter_id": 2, "title": "二、目标岗位分析", "text": "原第二章。", "status": "done"},
                {"chapter_id": 3, "title": "三、差距与行动计划", "text": "原第三章。", "status": "done"},
                {"chapter_id": 4, "title": "四、职业路径规划", "text": "原第四章。", "status": "done"},
                {"chapter_id": 5, "title": "五、评估周期", "text": "原第五章。", "status": "done"},
            ],
            "metadata": {},
        },
        summary="原摘要。",
        version="1.0",
    )
    db = _PolishSession(report_obj)

    async def fake_generate_json(**kwargs):
        assert "推广专员" in kwargs["prompt"]
        return {
            "summary": "这是 AI 改写后的摘要",
            "chapters": [
                {"chapter_id": 1, "text": "这是 AI 改写后的第一章"},
                {"chapter_id": 2, "text": "这是 AI 改写后的第二章"},
                {"chapter_id": 3, "text": "这是 AI 改写后的第三章"},
                {"chapter_id": 4, "text": "这是 AI 改写后的第四章"},
                {"chapter_id": 5, "text": "这是 AI 改写后的第五章"},
            ],
        }

    monkeypatch.setattr(report.llm, "generate_json", fake_generate_json)

    result = await report.polish_report(report_obj.id, db)

    assert result["polished"] is True
    assert report_obj.summary == "这是 AI 改写后的摘要。"
    assert report_obj.content_json["chapters"][0]["text"] == "这是 AI 改写后的第一章。"
    assert result["changes"][0] == "AI 改写了报告摘要"
    assert db.committed is True
    assert db.added
