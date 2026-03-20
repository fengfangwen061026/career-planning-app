"""Structured student profile completion helpers."""
from __future__ import annotations

from copy import deepcopy
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embedding import embedding
from app.models.student import StudentProfile
from app.schemas.student_app import ProfileCompletionQuestion
from app.services.student_profile import _build_profile_summary


def _get_missing_suggestions(profile: StudentProfile) -> list[str]:
    evidence = profile.evidence_json or {}
    suggestions = evidence.get("missing_suggestions") or []
    return [str(item) for item in suggestions if item]


def _has_numeric_text(value: str | None) -> bool:
    return bool(value and any(char.isdigit() for char in value))


def build_completion_questions(profile: StudentProfile) -> list[ProfileCompletionQuestion]:
    """Build a small set of structured completion questions."""

    profile_json = profile.profile_json or {}
    questions: list[ProfileCompletionQuestion] = []

    projects = ((profile_json.get("experience") or {}).get("projects") or [])
    for index, project in enumerate(projects):
        description = str(project.get("description") or "")
        outcome = str(project.get("outcome") or "")
        if _has_numeric_text(description) or _has_numeric_text(outcome):
            continue

        project_name = project.get("name") or f"项目 {index + 1}"
        questions.append(
            ProfileCompletionQuestion(
                question_id=f"project_quant_{index}",
                title="补充项目量化成果",
                prompt=f"“{project_name}”最值得写进简历的量化结果是什么？请尽量包含人数、时长、效率或性能变化。",
                placeholder="例如：累计服务 300+ 用户，接口响应时间下降 40%",
                options=[
                    "用户规模增长",
                    "性能/效率提升",
                    "营收/转化提升",
                    "项目交付成果",
                ],
            )
        )
        break

    work_items = ((profile_json.get("experience") or {}).get("work") or [])
    for index, item in enumerate(work_items):
        description = str(item.get("description") or "")
        if len(description.strip()) >= 30 and _has_numeric_text(description):
            continue

        company_name = item.get("company") or item.get("role") or f"实习 {index + 1}"
        questions.append(
            ProfileCompletionQuestion(
                question_id=f"experience_impact_{index}",
                title="补充实习收获",
                prompt=f"“{company_name}”这段经历里，你最核心的工作成果或影响是什么？",
                placeholder="例如：负责数据看板搭建，支持 5 个业务团队周报自动化",
                options=[
                    "搭建/优化系统",
                    "支持业务效率提升",
                    "参与跨团队协作",
                    "交付具体项目成果",
                ],
            )
        )
        break

    soft_skills = profile_json.get("soft_skills") or []
    communication = None
    teamwork = None
    if isinstance(soft_skills, list):
        communication = next((item for item in soft_skills if str(item.get("dimension")) == "沟通能力"), None)
        teamwork = next((item for item in soft_skills if str(item.get("dimension")) == "团队协作"), None)

    missing_suggestions = _get_missing_suggestions(profile)
    needs_communication = (
        communication is None
        or float(communication.get("score") or 0.0) < 0.6
        or any("沟通" in item for item in missing_suggestions)
    )
    if needs_communication:
        questions.append(
            ProfileCompletionQuestion(
                question_id="soft_skill_communication",
                title="补充沟通能力证据",
                prompt="请提供一个能体现你沟通、汇报、跨团队协作或对外表达能力的真实例子。",
                placeholder="例如：担任项目负责人，每周向导师和 4 位开发同学同步进度",
                options=[
                    "课堂/答辩表达",
                    "社团/活动组织",
                    "项目负责人协作",
                    "跨团队沟通",
                ],
            )
        )
    elif teamwork is None or float(teamwork.get("score") or 0.0) < 0.6:
        questions.append(
            ProfileCompletionQuestion(
                question_id="soft_skill_teamwork",
                title="补充团队协作证据",
                prompt="请提供一个你在团队里协作推进任务的例子。",
                placeholder="例如：与前后端 3 人协作完成校内平台上线",
                options=[
                    "团队项目协作",
                    "活动组织执行",
                    "跨角色配合",
                    "冲突协调处理",
                ],
            )
        )

    return questions[:3]


def _append_text(existing: str | None, answer: str) -> str:
    base = (existing or "").strip()
    addition = answer.strip()
    if not base:
        return addition
    if addition in base:
        return base
    if base.endswith(("。", ".", "；", ";")):
        return f"{base} {addition}"
    return f"{base}；{addition}"


def _sync_project_aliases(profile_json: dict, project_index: int, answer: str) -> None:
    experiences = profile_json.get("experiences") or []
    project_aliases = [item for item in experiences if item.get("type") == "project"]
    if project_index >= len(project_aliases):
        return
    project_alias = project_aliases[project_index]
    project_alias["description"] = _append_text(project_alias.get("description"), answer)


def _sync_work_aliases(profile_json: dict, work_index: int, answer: str) -> None:
    experiences = profile_json.get("experiences") or []
    work_aliases = [item for item in experiences if item.get("type") in {"internship", "work"}]
    if work_index >= len(work_aliases):
        return
    work_alias = work_aliases[work_index]
    work_alias["description"] = _append_text(work_alias.get("description"), answer)


def apply_answers_to_profile(profile_json: dict, answers: list[dict[str, str]]) -> tuple[dict, list[str]]:
    """Apply structured answers to profile JSON."""

    updated = deepcopy(profile_json)
    applied_updates: list[str] = []
    experience = updated.setdefault("experience", {})
    project_items = experience.setdefault("projects", [])
    work_items = experience.setdefault("work", [])
    soft_skills = updated.setdefault("soft_skills", [])
    dimensions = updated.setdefault("dimensions", {})
    soft_competencies = dimensions.setdefault("soft_competencies", {})

    for answer_item in answers:
        question_id = answer_item.get("question_id", "")
        answer = answer_item.get("answer", "").strip()
        if not answer:
            continue

        if question_id.startswith("project_quant_"):
            index = int(question_id.rsplit("_", 1)[-1])
            if index < len(project_items):
                project_items[index]["outcome"] = answer
                project_items[index]["description"] = _append_text(project_items[index].get("description"), answer)
                _sync_project_aliases(updated, index, answer)
                applied_updates.append(f"已补充项目成果：{project_items[index].get('name') or f'项目 {index + 1}'}")
        elif question_id.startswith("experience_impact_"):
            index = int(question_id.rsplit("_", 1)[-1])
            if index < len(work_items):
                work_items[index]["description"] = _append_text(work_items[index].get("description"), answer)
                _sync_work_aliases(updated, index, answer)
                applied_updates.append(f"已补充实习成果：{work_items[index].get('company') or f'经历 {index + 1}'}")
        elif question_id == "soft_skill_communication":
            existing = next((item for item in soft_skills if item.get("dimension") == "沟通能力"), None)
            if existing:
                existing["evidence"] = answer
                existing["score"] = max(float(existing.get("score") or 0.0), 0.72)
            else:
                soft_skills.append({"dimension": "沟通能力", "score": 0.72, "evidence": answer})
            soft_competencies["沟通能力"] = max(float(soft_competencies.get("沟通能力") or 0.0), 0.72)
            applied_updates.append("已补充沟通能力证据")
        elif question_id == "soft_skill_teamwork":
            existing = next((item for item in soft_skills if item.get("dimension") == "团队协作"), None)
            if existing:
                existing["evidence"] = answer
                existing["score"] = max(float(existing.get("score") or 0.0), 0.72)
            else:
                soft_skills.append({"dimension": "团队协作", "score": 0.72, "evidence": answer})
            soft_competencies["团队协作"] = max(float(soft_competencies.get("团队协作") or 0.0), 0.72)
            applied_updates.append("已补充团队协作证据")

    return updated, applied_updates


async def apply_profile_completion(
    student_id: UUID,
    answers: list[dict[str, str]],
    db: AsyncSession,
) -> tuple[StudentProfile, list[str]]:
    """Apply structured completion answers and persist them."""

    result = await db.execute(select(StudentProfile).where(StudentProfile.student_id == student_id))
    profile = result.scalars().first()
    if not profile:
        raise ValueError(f"Student profile not found for student_id={student_id}")

    updated_profile_json, applied_updates = apply_answers_to_profile(profile.profile_json or {}, answers)
    if not applied_updates:
        return profile, []

    profile.profile_json = updated_profile_json
    current_score = float(profile.completeness_score or 0.0)
    profile.completeness_score = min(100.0, current_score + len(applied_updates) * 4.0)

    evidence = dict(profile.evidence_json or {})
    suggestions = [str(item) for item in evidence.get("missing_suggestions") or [] if item]
    if any(item.startswith("已补充项目成果") for item in applied_updates):
        suggestions = [item for item in suggestions if "项目" not in item and "量化" not in item]
    if any(item.startswith("已补充实习成果") for item in applied_updates):
        suggestions = [item for item in suggestions if "实习" not in item]
    if any("沟通能力" in item for item in applied_updates):
        suggestions = [item for item in suggestions if "沟通" not in item]
    if any("团队协作" in item for item in applied_updates):
        suggestions = [item for item in suggestions if "团队" not in item]
    evidence["missing_suggestions"] = suggestions
    evidence["manual_edit"] = True
    evidence["completion_updates"] = applied_updates
    profile.evidence_json = evidence

    profile.embedding = await embedding.embed(_build_profile_summary(updated_profile_json))
    await db.flush()
    await db.refresh(profile)
    return profile, applied_updates
