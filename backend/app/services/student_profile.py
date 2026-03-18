"""Student profile service - assembles and manages student profiles from resume data."""

import logging
import json
import re

from app.ai.llm_provider import llm
from app.prompts.student_profile import SOFT_SKILL_EVAL_SYSTEM_PROMPT, SOFT_SKILL_EVAL_USER_PROMPT
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embedding import embedding
from app.models.student import Resume, Student, StudentProfile
from app.schemas.profiles import ResumeParseResult
from app.services.resume_parser import compute_completeness_score, generate_missing_suggestions

logger = logging.getLogger(__name__)
DEFAULT_SOFT_SKILL_DIMENSIONS = ["学习能力", "沟通能力", "团队协作", "创新能力", "抗压能力"]


def _calculate_competitiveness_score(parse_result: ResumeParseResult) -> float:
    """Calculate a student competitiveness score on a 0-100 scale."""
    score = 35.0

    degree_bonus = {
        "博士": 25.0,
        "硕士": 20.0,
        "本科": 15.0,
        "大专": 10.0,
    }
    if parse_result.education:
        highest_degree = max(
            (item.degree or "" for item in parse_result.education),
            key=lambda degree: degree_bonus.get(degree, 0.0),
            default="",
        )
        score += degree_bonus.get(highest_degree, 8.0)

    score += min(len(parse_result.skills) * 4.0, 20.0)
    score += min(len(parse_result.projects) * 4.0, 16.0)
    score += min(len(parse_result.awards) * 5.0, 12.0)
    if parse_result.experience:
        score += min(len(parse_result.experience) * 4.0, 12.0)

    return round(min(score, 100.0), 1)


def _extract_certificate_names(raw_text: str, certificates: list[dict[str, Any]]) -> list[str]:
    names = [cert.get("name", "").strip() for cert in certificates if cert.get("name")]
    patterns = [
        r"CET-?6",
        r"CET-?4",
        r"计算机二级",
        r"计算机三级",
        r"普通话[一二三]级甲等",
        r"普通话[一二三]级乙等",
    ]
    for pattern in patterns:
        for match in re.findall(pattern, raw_text, flags=re.IGNORECASE):
            normalized = match.upper().replace("CET6", "CET-6").replace("CET4", "CET-4")
            if normalized not in names:
                names.append(normalized)
    return names


def _estimate_experience_months(items: list[dict[str, Any]]) -> int:
    month_pattern = re.compile(r"(20\d{2})[-./](\d{1,2})")
    total = 0
    for item in items:
        start = item.get("start_date")
        end = item.get("end_date")
        if not start or not end:
            continue
        start_match = month_pattern.search(start)
        end_match = month_pattern.search(end)
        if not start_match or not end_match:
            continue
        start_month = int(start_match.group(1)) * 12 + int(start_match.group(2))
        end_month = int(end_match.group(1)) * 12 + int(end_match.group(2))
        if end_month >= start_month:
            total += end_month - start_month + 1
    return total


def _build_soft_skill_items(
    parse_result: ResumeParseResult,
    raw_soft_skills: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, float]]:
    alias_map = {
        "learning_ability": "学习能力",
        "communication": "沟通能力",
        "teamwork": "团队协作",
        "innovation": "创新能力",
        "stress_tolerance": "抗压能力",
        "responsibility": "抗压能力",
    }
    items: list[dict[str, Any]] = []
    scores: dict[str, float] = {}

    for key, value in (raw_soft_skills or {}).items():
        dimension = alias_map.get(key, key)
        if isinstance(value, dict):
            raw_score = value.get("score", 0.0)
            score = raw_score / 100 if raw_score > 1 else raw_score
            evidence = value.get("evidence") or "来自简历原文"
            if isinstance(evidence, list):
                evidence = "；".join(str(item) for item in evidence if item)
        else:
            score = value / 100 if isinstance(value, (int, float)) and value > 1 else float(value or 0)
            evidence = "来自简历原文"
        score = round(max(0.0, min(score, 1.0)), 2)
        items.append({"dimension": dimension, "score": score, "evidence": evidence or "来自简历原文"})
        scores[dimension] = score

    if not items:
        self_intro = parse_result.self_intro or ""
        project_count = len(parse_result.projects)
        award_count = len(parse_result.awards)
        skill_count = len(parse_result.skills)
        intro_has_team = "团队" in self_intro or "负责人" in self_intro
        intro_has_innovation = "创新" in self_intro or "新鲜事物" in self_intro
        intro_has_pressure = "管理" in self_intro or "答辩" in self_intro or "负责人" in self_intro
        heuristics = {
            "学习能力": (
                min(0.55 + skill_count * 0.04 + (0.08 if "学习能力强" in self_intro else 0.0), 0.95),
                "简历自述学习能力强，且具备多项技能与项目经历" if self_intro else "根据技能与项目经历推断",
            ),
            "沟通能力": (
                min(0.5 + (0.1 if "沟通" in self_intro or "热情" in self_intro else 0.0) + award_count * 0.03, 0.9),
                "自我评价提到待人热情、沟通表达，且有竞赛答辩经历" if self_intro else "根据项目协作经历推断",
            ),
            "团队协作": (
                min(0.52 + project_count * 0.04 + (0.08 if intro_has_team else 0.0), 0.92),
                "担任负责人/参与者并参与多项团队项目" if project_count else "暂无明显团队项目证据",
            ),
            "创新能力": (
                min(0.5 + award_count * 0.05 + (0.08 if intro_has_innovation else 0.0), 0.9),
                "竞赛获奖与创新项目经历体现创新能力" if award_count or project_count else "根据自我评价推断",
            ),
            "抗压能力": (
                min(0.48 + project_count * 0.03 + (0.1 if intro_has_pressure else 0.0), 0.88),
                "长期项目推进、竞赛答辩和负责人经历体现一定抗压能力" if project_count else "根据自我评价推断",
            ),
        }
        for dimension in DEFAULT_SOFT_SKILL_DIMENSIONS:
            score, evidence = heuristics[dimension]
            score = round(score, 2)
            items.append({"dimension": dimension, "score": score, "evidence": evidence})
            scores[dimension] = score

    for dimension in DEFAULT_SOFT_SKILL_DIMENSIONS:
        if dimension not in scores:
            items.append({"dimension": dimension, "score": 0.0, "evidence": "暂无数据"})
            scores[dimension] = 0.0

    items.sort(key=lambda item: DEFAULT_SOFT_SKILL_DIMENSIONS.index(item["dimension"]) if item["dimension"] in DEFAULT_SOFT_SKILL_DIMENSIONS else 99)
    return items, scores

async def _evaluate_soft_skills(parsed_data: dict) -> dict:
    """使用 LLM 评估学生软技能五个维度（沟通/团队/抗压/创新/学习）。

    返回格式：
    {
        "沟通能力": {"score": 0.7, "evidence": "..."},
        "团队协作": {"score": 0.5, "evidence": "..."},
        ...
    }
    失败时返回各维度 0.3 的默认值。
    """
    education = parsed_data.get("education", [])
    experience = parsed_data.get("experience", [])
    projects = parsed_data.get("projects", [])
    self_intro = parsed_data.get("self_intro") or ""

    prompt = SOFT_SKILL_EVAL_USER_PROMPT.format(
        education=json.dumps(education, ensure_ascii=False),
        experience=json.dumps(experience, ensure_ascii=False),
        projects=json.dumps(projects, ensure_ascii=False),
        self_intro=self_intro,
    )

    default = {
        "沟通能力": {"score": 0.3, "evidence": ""},
        "团队协作": {"score": 0.3, "evidence": ""},
        "抗压能力": {"score": 0.3, "evidence": ""},
        "创新能力": {"score": 0.3, "evidence": ""},
        "学习能力": {"score": 0.3, "evidence": ""},
    }

    try:
        result = await llm.generate_json(
            prompt=prompt,
            system_prompt=SOFT_SKILL_EVAL_SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=2048,
            max_retries=1,
            disable_reasoning=True,
            provider="profile",
        )
        # 校验：必须包含五个维度且 score 在合法范围
        required = {"沟通能力", "团队协作", "抗压能力", "创新能力", "学习能力"}
        if not required.issubset(result.keys()):
            logger.warning("soft skill eval missing dimensions: %s", result.keys())
            return default
        return result
    except Exception as e:
        logger.error("soft skill LLM eval failed: %s", e)
        return default


def _build_profile_json(parsed_data: dict[str, Any], student: Student | None = None, soft_skills_override: dict | None = None) -> dict[str, Any]:
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
    # 优先使用 LLM 评估结果，否则 fallback 到解析字段
    soft_skills = soft_skills_override or to_dict_dict(parsed_data.get("soft_skills", {}))
    self_evaluation = parsed_data.get("self_intro") or parsed_data.get("self_evaluation")
    raw_text = parsed_data.get("raw_text", "")
    parse_result = (
        parsed_data
        if isinstance(parsed_data, ResumeParseResult)
        else ResumeParseResult.model_validate(parsed_data)
    )

    # 最高学历
    degree_order = {"博士": 4, "硕士": 3, "本科": 2, "大专": 1}
    highest_edu = max(education, key=lambda e: degree_order.get(e.get("degree", ""), 0)) if education else {}

    skill_aliases = [
        {
            "name": s.get("name", ""),
            "category": s.get("category", ""),
            "level": s.get("proficiency", "了解"),
            "proficiency": s.get("proficiency", "了解"),
            "evidence": s.get("evidence"),
        }
        for s in skills
        if s.get("name")
    ]
    experience_aliases = [
        {
            "type": "internship" if e.get("is_internship", True) else "work",
            "title": e.get("role") or e.get("company") or "",
            "company": e.get("company"),
            "duration": " - ".join(filter(None, [e.get("start_date"), e.get("end_date")])),
            "description": e.get("description"),
        }
        for e in work_experience
    ] + [
        {
            "type": "project",
            "title": p.get("name") or "",
            "company": p.get("role"),
            "duration": p.get("duration"),
            "description": p.get("description") or p.get("outcome"),
        }
        for p in project_experience
    ]
    soft_skill_items, soft_skill_scores = _build_soft_skill_items(parse_result, soft_skills)
    certificate_names = _extract_certificate_names(raw_text, certificates)
    experience_months = _estimate_experience_months(work_experience)

    competitiveness_score = _calculate_competitiveness_score(parse_result)

    return {
        "competitiveness_score": competitiveness_score,
        "experience_months": experience_months,
        "basic_info": {
            "name": basic_info.get("name") or getattr(student, "name", None),
            "email": getattr(student, "email", None),
            "phone": getattr(student, "phone", None),
            "gender": basic_info.get("gender"),
            "location": basic_info.get("location") or getattr(student, "location", None),
            "hometown": basic_info.get("hometown"),
            "job_intention": basic_info.get("job_intention") or getattr(student, "job_intention", None),
            "expected_salary": basic_info.get("expected_salary"),
            "work_years": basic_info.get("work_years"),
            "school": highest_edu.get("school"),
            "degree": highest_edu.get("degree"),
            "major": highest_edu.get("major"),
        },
        "education": education,
        "skills": skill_aliases,
        "experiences": experience_aliases,
        "certificate_names": certificate_names,
        "certificates": certificates,
        "awards": awards,
        "soft_skills": soft_skill_items,
        "self_intro": self_evaluation,
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
            "soft_competencies": soft_skill_scores,
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
    resume_id: UUID | None = None,
) -> dict[str, Any]:
    """从学生的主简历解析结果生成学生画像。

    Returns:
        {"profile": StudentProfile ORM, "completeness_score": float, "missing_suggestions": list}
    """
    # 获取主简历（或最新简历）
    student = await db.get(Student, student_id)
    if not student:
        raise ValueError(f"Student {student_id} not found")

    if resume_id:
        resume = await db.get(Resume, resume_id)
        if not resume or resume.student_id != student_id:
            raise ValueError(f"Resume {resume_id} not found for student {student_id}")
    else:
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
    parse_result = (
        parsed_data
        if isinstance(parsed_data, ResumeParseResult)
        else ResumeParseResult.model_validate(parsed_data)
    )

    # LLM 软技能评估（异步，失败时使用默认值）
    soft_skills_eval = await _evaluate_soft_skills(
        parsed_data if isinstance(parsed_data, dict) else parsed_data.model_dump()
    )

    # 组装画像
    profile_json = _build_profile_json(parsed_data, student, soft_skills_override=soft_skills_eval)
    completeness_score = compute_completeness_score(parse_result)
    missing_suggestions = generate_missing_suggestions(parse_result)

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
