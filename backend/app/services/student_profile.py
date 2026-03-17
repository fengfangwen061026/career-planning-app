"""Student profile service - assembles and manages student profiles from resume data."""

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embedding import embedding
from app.models.student import Resume, StudentProfile
from app.services.resume_parser import compute_completeness_score, generate_missing_suggestions

logger = logging.getLogger(__name__)


def _build_profile_json(parsed_data: dict[str, Any]) -> dict[str, Any]:
    """将简历解析结果组装为完整的四维学生画像 JSON。

    四维结构：
      1. basic_requirements - 基本条件（学历、城市等）
      2. professional_skills - 专业技能
      3. soft_competencies - 软素养
      4. growth_potential - 成长潜力
    """
    # Helper to convert Pydantic models to dicts
    def to_dict(item):
        if hasattr(item, "model_dump"):
            return item.model_dump()
        elif hasattr(item, "dict"):
            return item.dict()
        return item

    # Helper to convert list of items to list of dicts
    def to_dict_list(items):
        return [to_dict(item) for item in items] if items else []

    # Helper to convert dict of items to dict of dicts
    def to_dict_dict(items):
        return {k: to_dict(v) for k, v in items.items()} if items else {}

    basic_info = to_dict(parsed_data.get("basic_info", {}))
    education = to_dict_list(parsed_data.get("education", []))
    work_experience = to_dict_list(parsed_data.get("experience", []))  # LLM returns "experience"
    project_experience = to_dict_list(parsed_data.get("projects", []))  # LLM returns "projects"
    skills = to_dict_list(parsed_data.get("skills", []))
    certificates = to_dict_list(parsed_data.get("certificates", []))
    awards = to_dict_list(parsed_data.get("awards", []))
    campus_activities = to_dict_list(parsed_data.get("campus_activities", []))
    soft_skills = to_dict_dict(parsed_data.get("soft_skills", {}))
    self_evaluation = parsed_data.get("self_intro") or parsed_data.get("self_evaluation")

    # 最高学历
    degree_order = {"博士": 4, "硕士": 3, "本科": 2, "大专": 1}
    highest_edu = max(education, key=lambda e: degree_order.get(e.get("degree", ""), 0)) if education else {}

    return {
        "basic_info": {
            "name": basic_info.get("name"),
            "gender": basic_info.get("gender"),
            "location": basic_info.get("location"),
            "hometown": basic_info.get("hometown"),
            "job_intention": basic_info.get("job_intention"),
            "expected_salary": basic_info.get("expected_salary"),
            "work_years": basic_info.get("work_years"),
        },
        "dimensions": {
            "basic_requirements": {
                "degree": highest_edu.get("degree"),
                "major": highest_edu.get("major"),
                "school": highest_edu.get("school"),
                "gpa": highest_edu.get("gpa"),
                "city": basic_info.get("location"),
                "work_years": basic_info.get("work_years"),
            },
            "professional_skills": [
                {
                    "skill_name": s.get("name", ""),
                    "category": s.get("category", ""),
                    "proficiency": s.get("proficiency", "了解"),
                    "proficiency_evidence": s.get("proficiency_evidence"),
                }
                for s in skills
            ],
            "soft_competencies": soft_skills,
            "growth_potential": {
                "education_background": [
                    {
                        "school": e.get("school"),
                        "major": e.get("major"),
                        "degree": e.get("degree"),
                        "gpa": e.get("gpa"),
                        "honors": e.get("honors", []),
                    }
                    for e in education
                ],
                "awards": awards,
                "certificates": certificates,
                "campus_activities": campus_activities,
                "self_evaluation": self_evaluation,
            },
        },
        "experience": {
            "work": work_experience,
            "projects": project_experience,
        },
    }


def _build_profile_summary(profile_json: dict[str, Any]) -> str:
    """构建画像摘要文本用于 embedding。"""
    parts: list[str] = []

    basic = profile_json.get("basic_info", {})
    if basic.get("name"):
        parts.append(f"姓名: {basic['name']}")
    if basic.get("job_intention"):
        parts.append(f"求职意向: {basic['job_intention']}")

    dims = profile_json.get("dimensions", {})

    # 学历
    basic_req = dims.get("basic_requirements", {})
    if basic_req.get("school"):
        parts.append(f"学校: {basic_req['school']}")
    if basic_req.get("major"):
        parts.append(f"专业: {basic_req['major']}")
    if basic_req.get("degree"):
        parts.append(f"学历: {basic_req['degree']}")

    # 技能
    skills = dims.get("professional_skills", [])
    skill_names = [s.get("skill_name", "") for s in skills if s.get("skill_name")]
    if skill_names:
        parts.append(f"技能: {', '.join(skill_names[:15])}")

    # 经验
    exp = profile_json.get("experience", {})
    work = exp.get("work", [])
    if work:
        titles = [w.get("title", "") for w in work if w.get("title")]
        if titles:
            parts.append(f"经历: {', '.join(titles[:5])}")

    return " | ".join(parts)


async def generate_student_profile(
    student_id: UUID,
    db: AsyncSession,
) -> dict[str, Any]:
    """从学生的主简历解析结果生成学生画像。

    Returns:
        {"profile": StudentProfile ORM, "completeness_score": float, "missing_suggestions": list}
    """
    # 获取主简历（或最新简历）
    result = await db.execute(
        select(Resume)
        .where(Resume.student_id == student_id)
        .order_by(Resume.is_primary.desc(), Resume.created_at.desc())
    )
    resume = result.scalars().first()
    if not resume:
        raise ValueError(f"No resume found for student {student_id}")
    if not resume.parsed_json:
        raise ValueError(f"Resume {resume.id} has not been parsed yet")

    parsed_data = resume.parsed_json

    # 组装画像
    profile_json = _build_profile_json(parsed_data)
    completeness_score = compute_completeness_score(parsed_data)
    missing_suggestions = generate_missing_suggestions(parsed_data)

    # 生成 embedding
    summary = _build_profile_summary(profile_json)
    profile_embedding = await embedding.embed(summary)

    # 查找是否已有画像
    existing_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    existing = existing_result.scalars().first()

    if existing:
        existing.profile_json = profile_json
        existing.completeness_score = completeness_score
        existing.evidence_json = {
            "source_resume_id": str(resume.id),
            "missing_suggestions": missing_suggestions,
        }
        existing.embedding = profile_embedding
        # 版本递增
        try:
            ver = float(existing.version)
            existing.version = f"{ver + 0.1:.1f}"
        except (ValueError, TypeError):
            existing.version = "1.1"
        profile = existing
    else:
        profile = StudentProfile(
            student_id=student_id,
            profile_json=profile_json,
            completeness_score=completeness_score,
            evidence_json={
                "source_resume_id": str(resume.id),
                "missing_suggestions": missing_suggestions,
            },
            version="1.0",
            embedding=profile_embedding,
        )
        db.add(profile)

    await db.flush()
    await db.refresh(profile)

    logger.info("Student profile generated for student %s (completeness=%.2f)", student_id, completeness_score)

    return {
        "profile": profile,
        "completeness_score": completeness_score,
        "missing_suggestions": missing_suggestions,
    }


async def update_student_profile(
    student_id: UUID,
    profile_data: dict[str, Any],
    db: AsyncSession,
) -> StudentProfile:
    """手动补充/修改学生画像。"""
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    profile = result.scalars().first()
    if not profile:
        raise ValueError(f"No profile found for student {student_id}")

    # 合并更新
    current = profile.profile_json or {}
    current.update(profile_data)
    profile.profile_json = current

    profile.evidence_json = {
        **(profile.evidence_json or {}),
        "manual_edit": True,
    }

    # 重新计算完整度（基于原始解析数据不变，画像调整不影响）
    # 重新生成 embedding
    summary = _build_profile_summary(current)
    profile.embedding = await embedding.embed(summary)

    await db.flush()
    await db.refresh(profile)
    return profile


async def get_student_embedding(student_id: UUID, db: AsyncSession) -> list[float]:
    """获取学生画像的 embedding 向量。"""
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    profile = result.scalars().first()
    if not profile:
        raise ValueError(f"No profile found for student {student_id}")

    if profile.embedding:
        return profile.embedding

    # 如果还没有 embedding，生成一个
    summary = _build_profile_summary(profile.profile_json or {})
    profile.embedding = await embedding.embed(summary)
    await db.flush()
    return profile.embedding
