"""Matching service for recommendation and deep analysis."""

from __future__ import annotations

import asyncio
import logging
import math
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embedding import embedding as embedding_provider
from app.ai.llm_provider import llm
from app.ai.prompts.matching import build_competency_prompt, build_potential_prompt
from app.models.job import JobProfile, Role
from app.models.matching import MatchResult
from app.models.student import StudentProfile
from app.schemas.matching import (
    BasicScore,
    CompetencyItem,
    CompetencyScore,
    FourDimensionScores,
    GapItem,
    PotentialItem,
    PotentialScore,
    SkillMatchItem,
    SkillScore,
    WEIGHT_PRESETS,
    WeightConfig,
)

logger = logging.getLogger(__name__)

MatchMode = Literal["recommend", "deep"]

DEGREE_ORDER: dict[str, int] = {
    "初中": 1,
    "中专": 2,
    "高中": 2,
    "大专": 3,
    "专科": 3,
    "本科": 4,
    "学士": 4,
    "硕士": 5,
    "研究生": 5,
    "博士": 6,
    "MBA": 5,
    "EMBA": 5,
}

COMPETENCY_DIMENSION_LABELS = {
    "communication": "沟通能力",
    "teamwork": "团队协作",
    "stress_tolerance": "抗压能力",
    "innovation": "创新能力",
    "learning_ability": "学习能力",
}

COMPETENCY_STUDENT_ALIASES = {
    "communication": ["沟通能力", "沟通表达", "communication"],
    "teamwork": ["团队协作", "团队合作", "teamwork"],
    "stress_tolerance": ["抗压能力", "抗压", "stress_tolerance"],
    "innovation": ["创新能力", "创新", "innovation"],
    "learning_ability": ["学习能力", "学习", "learning_ability"],
}

POTENTIAL_DIMENSION_LABELS = {
    "growth_trajectory": "成长轨迹",
    "self_driven": "自驱力",
    "learning_speed": "学习速度",
    "adaptability": "适应能力",
}

_LLM_SEMAPHORE = asyncio.Semaphore(2)
_LLM_TIMEOUT_SECONDS = 25.0


@dataclass(slots=True)
class MatchContext:
    """Loaded matching context for one student-job pair."""

    student_profile: StudentProfile
    job_profile: JobProfile
    student_profile_data: dict[str, Any]
    job_profile_data: dict[str, Any]
    role_name: str | None
    role_category: str | None


@dataclass(slots=True)
class MatchComputation:
    """Pure computation result before persistence."""

    scores: FourDimensionScores
    gaps: list[GapItem]
    reasons: list[str]
    job_info: dict[str, Any]

    def scores_payload(self) -> dict[str, Any]:
        payload = self.scores.model_dump()
        payload["match_reasons"] = self.reasons
        payload["job_info"] = self.job_info
        return payload

    def gaps_payload(self) -> list[dict[str, Any]]:
        return [gap.model_dump() for gap in self.gaps]


def _unwrap_value(value: Any, default: Any = None) -> Any:
    if isinstance(value, dict) and "value" in value:
        return value.get("value", default)
    return value if value is not None else default


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip().lower()
    return re.sub(r"\s+", "", text)


def _safe_float(value: Any, default: float = 0.0) -> float:
    raw = _unwrap_value(value, value)
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, str):
        match = re.search(r"-?\d+(?:\.\d+)?", raw)
        if match:
            return float(match.group(0))
    return default


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _parse_years(value: Any) -> float:
    return max(_safe_float(value, 0.0), 0.0)


def _degree_rank(degree: str | None) -> int:
    if not degree:
        return 0
    for key, rank in DEGREE_ORDER.items():
        if key in degree:
            return rank
    return 0


def _city_match(student_city: str, job_city: str) -> bool:
    left = student_city.replace("市", "").replace("省", "").strip()
    right = job_city.replace("市", "").replace("省", "").strip()
    if not left or not right:
        return True
    return left == right or left in right or right in left


def _extract_student_basic(student_profile: dict[str, Any]) -> dict[str, Any]:
    basic_info = student_profile.get("basic_info") or {}
    dimensions = student_profile.get("dimensions") or {}
    basic_dimensions = dimensions.get("basic_requirements") or {}
    education = _as_list(student_profile.get("education"))
    latest_education = education[0] if education else {}
    return {
        "degree": basic_dimensions.get("degree") or basic_info.get("degree") or latest_education.get("degree") or "",
        "major": basic_dimensions.get("major") or basic_info.get("major") or latest_education.get("major") or "",
        "school": basic_dimensions.get("school") or basic_info.get("school") or latest_education.get("school") or "",
        "city": basic_dimensions.get("city") or basic_info.get("location") or "",
        "work_years": basic_dimensions.get("work_years") or basic_info.get("work_years") or student_profile.get("experience_months"),
        "self_intro": student_profile.get("self_intro") or "",
    }


def _extract_job_basic(job_profile: dict[str, Any]) -> dict[str, Any]:
    basic = job_profile.get("basic_requirements") or {}
    cities = _as_list(basic.get("cities"))
    city_name = ""
    if cities:
        first_city = cities[0]
        if isinstance(first_city, dict):
            city_name = first_city.get("name") or first_city.get("city") or ""
        else:
            city_name = str(first_city)
    return {
        "education": basic.get("education") or "",
        "majors": _as_list(basic.get("majors")),
        "experience_years": basic.get("experience_years") or {},
        "city": city_name,
        "certifications": _as_list(basic.get("certifications")),
    }


def _extract_student_skills(student_profile: dict[str, Any]) -> list[dict[str, Any]]:
    collected: list[dict[str, Any]] = []
    seen: set[str] = set()

    for skill in _as_list(student_profile.get("skills")):
        name = (skill.get("name") or skill.get("skill_name") or "").strip()
        normalized = _normalize_text(name)
        if normalized and normalized not in seen:
            seen.add(normalized)
            collected.append({
                "name": name,
                "proficiency": skill.get("proficiency") or skill.get("level") or "",
                "evidence": skill.get("evidence") or "",
            })

    dimensions = student_profile.get("dimensions") or {}
    for skill in _as_list(dimensions.get("professional_skills")):
        name = (skill.get("skill_name") or skill.get("name") or "").strip()
        normalized = _normalize_text(name)
        if normalized and normalized not in seen:
            seen.add(normalized)
            collected.append({
                "name": name,
                "proficiency": skill.get("proficiency") or skill.get("level") or "",
                "evidence": skill.get("proficiency_evidence") or skill.get("evidence") or "",
            })

    return collected


def _extract_job_skills(job_profile: dict[str, Any]) -> list[dict[str, Any]]:
    skills = []
    for skill in _as_list(job_profile.get("technical_skills")):
        name = (skill.get("skill_name") or skill.get("name") or "").strip()
        if not name:
            continue
        skills.append({
            "name": name,
            "importance": skill.get("importance") or "required",
            "weight": float(skill.get("weight") or 1.0),
            "evidence": skill.get("proficiency_evidence") or skill.get("evidence") or "",
        })
    return skills


def score_basic_requirements(
    student_profile: dict[str, Any],
    job_profile: dict[str, Any],
) -> BasicScore:
    """Rule-based basic requirements scoring."""
    student_basic = _extract_student_basic(student_profile)
    job_basic = _extract_job_basic(job_profile)

    score = 0.0
    penalties: list[dict[str, Any]] = []

    student_degree = student_basic["degree"]
    job_degree = str(job_basic["education"])
    student_rank = _degree_rank(student_degree)
    job_rank = _degree_rank(job_degree)
    if job_rank == 0:
        education_score = 40.0
    elif student_rank >= job_rank:
        education_score = 40.0
    elif student_rank == job_rank - 1:
        education_score = 25.0
    else:
        education_score = 10.0
        penalties.append({
            "type": "education",
            "detail": f"学历不满足: 要求{job_degree}, 实际{student_degree or '未知'}",
            "deduction": 30,
        })
    score += education_score

    student_major = str(student_basic["major"] or "")
    job_majors = [str(item) for item in job_basic["majors"]]
    role_name = str(job_profile.get("role_name") or "")
    major_target = " ".join(job_majors + [role_name]).lower()
    if not student_major:
        major_score = 15.0
    else:
        major_tokens = [
            token
            for token in re.split(r"[、/,\s]+", student_major.lower().replace("工程", " ").replace("学", " "))
            if len(token) >= 2
        ]
        hits = sum(1 for token in major_tokens if token and token in major_target)
        if hits >= 2:
            major_score = 25.0
        elif hits == 1:
            major_score = 20.0
        else:
            major_score = 12.0
    score += major_score

    student_years = _parse_years(student_basic["work_years"])
    experience_requirements = job_basic["experience_years"]
    if isinstance(experience_requirements, dict):
        required_years = _safe_float(experience_requirements.get("preferred"), _safe_float(experience_requirements.get("min")))
    else:
        required_years = _safe_float(experience_requirements)
    if required_years <= 0:
        experience_score = 20.0
    elif student_years >= required_years:
        experience_score = 20.0
    elif student_years >= required_years * 0.5:
        experience_score = 12.0
    else:
        experience_score = 5.0
        penalties.append({
            "type": "experience",
            "detail": f"经验不足: 要求{required_years:.0f}年, 实际{student_years:.1f}年",
            "deduction": 15,
        })
    score += experience_score

    job_city = str(job_basic["city"] or "")
    student_city = str(student_basic["city"] or "")
    city_ok = _city_match(student_city, job_city)
    score += 15.0 if city_ok else 8.0
    if not city_ok:
        penalties.append({
            "type": "city",
            "detail": f"城市不匹配: 要求{job_city}, 实际{student_city or '未知'}",
            "deduction": 7,
        })

    return BasicScore(
        score=round(min(score, 100.0), 2),
        education_match={
            "student": student_degree,
            "required": job_degree,
            "score": education_score,
            "max": 40,
        },
        major_match={
            "student_major": student_major,
            "job_direction": ", ".join(job_majors) or role_name,
            "score": major_score,
            "max": 25,
        },
        experience_match={
            "student_years": student_years,
            "required_years": required_years,
            "score": experience_score,
            "max": 20,
        },
        hard_conditions=[
            {
                "condition": "city",
                "student": student_city,
                "required": job_city,
                "met": city_ok,
            }
        ],
        penalties=penalties,
    )


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left:
        return 0.0
    numerator = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0
    return numerator / (left_norm * right_norm)


async def score_skills(
    student_profile: dict[str, Any],
    job_profile: dict[str, Any],
) -> SkillScore:
    """Skill scoring with exact match and semantic compensation."""
    student_skills = _extract_student_skills(student_profile)
    job_skills = _extract_job_skills(job_profile)

    student_skill_map = {_normalize_text(skill["name"]): skill for skill in student_skills}
    student_names = [skill["name"] for skill in student_skills]

    embeddings_map: dict[str, list[float]] = {}
    embedding_failed = False
    embedding_inputs: list[str] = []
    for skill in job_skills:
        embedding_inputs.append(skill["name"])
    for skill_name in student_names:
        embedding_inputs.append(skill_name)

    unique_inputs = []
    seen_inputs: set[str] = set()
    for skill_name in embedding_inputs:
        normalized = _normalize_text(skill_name)
        if normalized and normalized not in seen_inputs:
            seen_inputs.add(normalized)
            unique_inputs.append(skill_name)

    if unique_inputs:
        try:
            vectors = await embedding_provider.embed_batch(unique_inputs)
            embeddings_map = {
                _normalize_text(skill_name): vector
                for skill_name, vector in zip(unique_inputs, vectors)
            }
        except Exception as exc:
            embedding_failed = True
            logger.warning("Skill embedding failed, falling back to exact matching only: %s", exc)

    items: list[SkillMatchItem] = []
    required_total = 0.0
    required_earned = 0.0
    preferred_total = 0.0
    preferred_earned = 0.0
    bonus_earned = 0.0

    for job_skill in job_skills:
        name = job_skill["name"]
        normalized_name = _normalize_text(name)
        importance = str(job_skill["importance"] or "required")
        weight = float(job_skill["weight"] or 1.0)
        exact = normalized_name in student_skill_map
        matched_by = "none"
        item_score = 0.0
        evidence = ""
        semantic_similarity: float | None = None

        if exact:
            matched_by = "exact"
            item_score = 100.0
            evidence = student_skill_map[normalized_name].get("evidence") or f"简历明确提及 {name}"
        elif not embedding_failed:
            job_embedding = embeddings_map.get(normalized_name)
            best_similarity = 0.0
            best_skill: dict[str, Any] | None = None
            for student_skill in student_skills:
                student_embedding = embeddings_map.get(_normalize_text(student_skill["name"]))
                if job_embedding is None or student_embedding is None:
                    continue
                similarity = _cosine_similarity(job_embedding, student_embedding)
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_skill = student_skill
            if best_skill and best_similarity >= 0.8:
                matched_by = "semantic"
                item_score = round(best_similarity * 100, 2)
                semantic_similarity = round(best_similarity, 4)
                evidence = (
                    f"与学生技能“{best_skill['name']}”语义相近"
                    f"（相似度 {best_similarity:.2f}）"
                )
            elif best_skill and best_similarity >= 0.6:
                matched_by = "semantic"
                item_score = round(best_similarity * 70, 2)
                semantic_similarity = round(best_similarity, 4)
                evidence = f"与学生技能“{best_skill['name']}”存在部分语义相关"

        items.append(
            SkillMatchItem(
                skill_name=name,
                importance=importance,
                weight=weight,
                matched=matched_by != "none",
                score=item_score,
                semantic_similarity=semantic_similarity,
                evidence=evidence or job_skill["evidence"],
                matched_by=matched_by,
            )
        )

        bucket_score = weight * (item_score / 100.0)
        if importance == "required":
            required_total += weight
            required_earned += bucket_score
        elif importance == "preferred":
            preferred_total += weight
            preferred_earned += bucket_score
        else:
            bonus_earned += bucket_score

    required_score = (required_earned / required_total * 60.0) if required_total else 60.0
    preferred_score = (preferred_earned / preferred_total * 25.0) if preferred_total else 12.5
    bonus_score = min(bonus_earned * 5.0, 15.0)
    missing_required = sum(1 for item in items if item.importance == "required" and not item.matched)
    total = max(0.0, min(required_score + preferred_score + bonus_score - missing_required * 8.0, 100.0))

    return SkillScore(
        score=round(total, 2),
        required_score=round(required_score, 2),
        preferred_score=round(preferred_score, 2),
        bonus_score=round(bonus_score, 2),
        items=items,
    )


def score_skills_heuristic(
    student_profile: dict[str, Any],
    job_profile: dict[str, Any],
) -> SkillScore:
    """Lightweight skill scoring for recommendation mode."""
    student_skill_map = {
        _normalize_text(skill["name"]): skill
        for skill in _extract_student_skills(student_profile)
        if _normalize_text(skill["name"])
    }
    job_skills = _extract_job_skills(job_profile)

    if not job_skills:
        return SkillScore(score=60.0, required_score=60.0)

    items: list[SkillMatchItem] = []
    required_total = 0.0
    required_earned = 0.0
    preferred_total = 0.0
    preferred_earned = 0.0
    bonus_earned = 0.0

    for job_skill in job_skills:
        name = job_skill["name"]
        normalized_name = _normalize_text(name)
        matched_skill = student_skill_map.get(normalized_name)
        matched = matched_skill is not None
        item_score = 100.0 if matched else 0.0
        importance = str(job_skill["importance"] or "required")
        weight = float(job_skill["weight"] or 1.0)

        items.append(
            SkillMatchItem(
                skill_name=name,
                importance=importance,
                weight=weight,
                matched=matched,
                score=item_score,
                evidence=matched_skill.get("evidence") or name if matched_skill else job_skill["evidence"],
                matched_by="exact" if matched else "none",
            )
        )

        bucket_score = weight * (item_score / 100.0)
        if importance == "required":
            required_total += weight
            required_earned += bucket_score
        elif importance == "preferred":
            preferred_total += weight
            preferred_earned += bucket_score
        else:
            bonus_earned += bucket_score

    required_score = (required_earned / required_total * 60.0) if required_total else 60.0
    preferred_score = (preferred_earned / preferred_total * 25.0) if preferred_total else 12.5
    bonus_score = min(bonus_earned * 5.0, 15.0)
    missing_required = sum(1 for item in items if item.importance == "required" and not item.matched)
    total = max(0.0, min(required_score + preferred_score + bonus_score - missing_required * 8.0, 100.0))

    return SkillScore(
        score=round(total, 2),
        required_score=round(required_score, 2),
        preferred_score=round(preferred_score, 2),
        bonus_score=round(bonus_score, 2),
        items=items,
    )


def _get_competency_weight(job_competencies: dict[str, Any], dimension: str) -> float:
    entry = job_competencies.get(dimension, {})
    raw = _unwrap_value(entry, entry)
    if isinstance(raw, (int, float)):
        value = float(raw)
    elif isinstance(entry, dict):
        importance = str(entry.get("importance") or "").strip().lower()
        value = {
            "核心要求": 5,
            "核心素养": 5,
            "重要": 4,
            "较重要": 4,
            "一般": 3,
            "了解": 2,
            "低": 1,
        }.get(importance, 3)
    else:
        value = 3
    return max(1.0, min(value, 5.0)) / 5.0


def _extract_student_soft_competencies(student_profile: dict[str, Any]) -> dict[str, dict[str, Any]]:
    extracted: dict[str, dict[str, Any]] = {}

    for item in _as_list(student_profile.get("soft_skills")):
        dimension = str(item.get("dimension") or "").strip()
        if not dimension:
            continue
        extracted[dimension] = {
            "score": _safe_float(item.get("score"), 0.0),
            "evidence": item.get("evidence") or "",
        }

    dimensions = student_profile.get("dimensions") or {}
    soft_dimensions = dimensions.get("soft_competencies") or {}
    if isinstance(soft_dimensions, dict):
        for key, value in soft_dimensions.items():
            extracted[str(key)] = {
                "score": _safe_float(value, extracted.get(str(key), {}).get("score", 0.0)),
                "evidence": extracted.get(str(key), {}).get("evidence", ""),
            }

    return extracted


def _normalize_student_competency_score(value: float) -> float:
    if value <= 1.0:
        return max(0.0, min(value * 100.0, 100.0))
    return max(0.0, min(value, 100.0))


def score_competency_heuristic(
    student_profile: dict[str, Any],
    job_profile: dict[str, Any],
) -> CompetencyScore:
    """Stable heuristic competency scoring for recommendation mode."""
    student_competencies = _extract_student_soft_competencies(student_profile)
    job_competencies = job_profile.get("soft_competencies") or {}

    items: list[CompetencyItem] = []
    weighted_total = 0.0
    weighted_sum = 0.0

    for dimension, label in COMPETENCY_DIMENSION_LABELS.items():
        student_entry = None
        for alias in COMPETENCY_STUDENT_ALIASES[dimension]:
            if alias in student_competencies:
                student_entry = student_competencies[alias]
                break

        weight = _get_competency_weight(job_competencies, dimension)
        evidence = ""
        if student_entry:
            score = _normalize_student_competency_score(_safe_float(student_entry.get("score"), 0.0))
            evidence = str(student_entry.get("evidence") or f"画像中存在{label}相关信息")
            confidence = 0.7
        else:
            score = 45.0 + weight * 10.0
            evidence = f"画像中缺少明确的{label}证据，按启发式中性分处理"
            confidence = 0.35

        items.append(
            CompetencyItem(
                dimension=dimension,
                score=round(score, 2),
                evidence=evidence,
                confidence=confidence,
            )
        )
        weighted_total += score * weight
        weighted_sum += weight

    total_score = weighted_total / weighted_sum if weighted_sum else 55.0
    return CompetencyScore(score=round(total_score, 2), items=items)


async def _run_llm_json(
    prompt: str,
    system_prompt: str,
) -> dict[str, Any]:
    async with _LLM_SEMAPHORE:
        return await asyncio.wait_for(
            llm.generate_json(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=0.3,
            ),
            timeout=_LLM_TIMEOUT_SECONDS,
        )


async def score_competency_llm(
    student_profile: dict[str, Any],
    job_profile: dict[str, Any],
) -> CompetencyScore:
    """Deep competency scoring with LLM and heuristic fallback."""
    messages = build_competency_prompt(student_profile, job_profile.get("soft_competencies") or {})
    try:
        result = await _run_llm_json(messages[-1]["content"], messages[0]["content"])
        raw_items = result.get("items", [])
        items = [
            CompetencyItem(
                dimension=str(item.get("dimension") or ""),
                score=round(_safe_float(item.get("score"), 0.0), 2),
                evidence=str(item.get("evidence") or ""),
                confidence=max(0.0, min(_safe_float(item.get("confidence"), 0.0), 1.0)),
            )
            for item in raw_items
            if item.get("dimension")
        ]
        if not items:
            raise ValueError("LLM returned no competency items")
        weighted_total = 0.0
        weighted_sum = 0.0
        job_competencies = job_profile.get("soft_competencies") or {}
        for item in items:
            weight = _get_competency_weight(job_competencies, item.dimension)
            adjusted_weight = max(item.confidence, 0.2) * weight
            weighted_total += item.score * adjusted_weight
            weighted_sum += adjusted_weight
        total_score = weighted_total / weighted_sum if weighted_sum else 55.0
        return CompetencyScore(score=round(total_score, 2), items=items)
    except Exception as exc:
        logger.warning("Competency LLM scoring failed, using heuristic fallback: %s", exc)
        return score_competency_heuristic(student_profile, job_profile)


def _growth_signal_counts(student_profile: dict[str, Any]) -> dict[str, int]:
    experiences = _as_list(student_profile.get("experiences")) or _as_list(student_profile.get("experience"))
    awards = _as_list(student_profile.get("awards"))
    certificates = _as_list(student_profile.get("certificates")) or _as_list(student_profile.get("certificate_names"))
    skills = _extract_student_skills(student_profile)
    education = _as_list(student_profile.get("education"))
    intro = str(student_profile.get("self_intro") or "")
    return {
        "experience_count": len(experiences),
        "award_count": len(awards),
        "certificate_count": len(certificates),
        "skill_count": len(skills),
        "education_count": len(education),
        "has_intro": 1 if intro else 0,
    }


def score_potential_heuristic(student_profile: dict[str, Any]) -> PotentialScore:
    """Stable heuristic potential scoring for recommendation mode."""
    counts = _growth_signal_counts(student_profile)
    experiences = counts["experience_count"]
    awards = counts["award_count"]
    certificates = counts["certificate_count"]
    skills = counts["skill_count"]
    intro_bonus = counts["has_intro"] * 5.0

    items = [
        PotentialItem(
            dimension="growth_trajectory",
            score=round(min(45.0 + experiences * 8.0 + awards * 6.0, 95.0), 2),
            evidence=f"项目/实习 {experiences} 项，奖项 {awards} 项",
            confidence=0.65 if experiences or awards else 0.35,
        ),
        PotentialItem(
            dimension="self_driven",
            score=round(min(40.0 + awards * 8.0 + experiences * 6.0 + intro_bonus, 95.0), 2),
            evidence=f"奖项 {awards} 项，自我介绍{'存在' if intro_bonus else '缺失'}",
            confidence=0.6 if awards or intro_bonus else 0.35,
        ),
        PotentialItem(
            dimension="learning_speed",
            score=round(min(42.0 + skills * 6.0 + certificates * 5.0, 96.0), 2),
            evidence=f"技能 {skills} 项，证书 {certificates} 项",
            confidence=0.65 if skills else 0.4,
        ),
        PotentialItem(
            dimension="adaptability",
            score=round(min(40.0 + experiences * 7.0 + skills * 4.0, 94.0), 2),
            evidence=f"项目/实习 {experiences} 项，技能覆盖 {skills} 项",
            confidence=0.6 if experiences else 0.35,
        ),
    ]
    weighted_total = sum(item.score * max(item.confidence, 0.3) for item in items)
    weight_sum = sum(max(item.confidence, 0.3) for item in items)
    return PotentialScore(score=round(weighted_total / weight_sum, 2), items=items)


async def score_potential_llm(student_profile: dict[str, Any]) -> PotentialScore:
    """Deep potential scoring with LLM and heuristic fallback."""
    messages = build_potential_prompt(student_profile)
    try:
        result = await _run_llm_json(messages[-1]["content"], messages[0]["content"])
        raw_items = result.get("items", [])
        items = [
            PotentialItem(
                dimension=str(item.get("dimension") or ""),
                score=round(_safe_float(item.get("score"), 0.0), 2),
                evidence=str(item.get("evidence") or ""),
                confidence=max(0.0, min(_safe_float(item.get("confidence"), 0.0), 1.0)),
            )
            for item in raw_items
            if item.get("dimension")
        ]
        if not items:
            raise ValueError("LLM returned no potential items")
        weighted_total = sum(item.score * max(item.confidence, 0.2) for item in items)
        weight_sum = sum(max(item.confidence, 0.2) for item in items)
        return PotentialScore(score=round(weighted_total / weight_sum, 2), items=items)
    except Exception as exc:
        logger.warning("Potential LLM scoring failed, using heuristic fallback: %s", exc)
        return score_potential_heuristic(student_profile)


def _basic_suggestion(penalty_type: str) -> str:
    suggestions = {
        "education": "可通过深造、辅修或专业认证补足学历门槛差距",
        "experience": "建议优先补充实习、项目或兼职经历，提高可迁移经验",
        "city": "可结合求职意愿评估异地机会，或优先选择同城岗位",
    }
    return suggestions.get(penalty_type, "建议针对该项短板制定补齐计划")


def _competency_suggestion(dimension: str) -> str:
    suggestions = {
        "communication": "可通过汇报、演讲和跨团队协作强化表达与说服能力",
        "teamwork": "建议增加团队项目和组织活动经历，沉淀协作案例",
        "stress_tolerance": "可在高节奏项目中训练优先级管理和压力承受能力",
        "innovation": "建议通过竞赛、开源和产品优化训练创新思维",
        "learning_ability": "可建立周期性学习计划，强化新知识吸收与迁移速度",
    }
    return suggestions.get(dimension, "建议围绕该项素养进行专项提升")


def _potential_suggestion(dimension: str) -> str:
    suggestions = {
        "growth_trajectory": "建议持续累积连续性的成长记录，形成可复述的进步轨迹",
        "self_driven": "可主动发起项目、比赛或作品集建设，体现行动驱动",
        "learning_speed": "建议尝试快速上手新工具并输出成果，证明学习效率",
        "adaptability": "可通过跨角色或跨领域协作强化环境适应能力",
    }
    return suggestions.get(dimension, "建议持续补充可验证的成长证据")


def _dimension_label(dimension: str) -> str:
    return COMPETENCY_DIMENSION_LABELS.get(dimension) or POTENTIAL_DIMENSION_LABELS.get(dimension) or dimension


def analyze_gaps(scores: FourDimensionScores) -> list[GapItem]:
    """Generate prioritized gap items from four-dimensional scores."""
    gaps: list[GapItem] = []

    for penalty in scores.basic.penalties:
        detail = str(penalty.get("detail") or "")
        gaps.append(
            GapItem(
                gap_item=str(penalty.get("type") or "basic"),
                dimension="basic",
                current_level=detail.split("实际")[-1] if "实际" in detail else "不足",
                required_level=detail.split("要求")[-1].split(",")[0] if "要求" in detail else "未知",
                priority="high",
                suggestion=_basic_suggestion(str(penalty.get("type") or "")),
            )
        )

    for item in scores.skill.items:
        if item.importance == "required" and not item.matched:
            gaps.append(
                GapItem(
                    gap_item=f"必备技能: {item.skill_name}",
                    dimension="skill",
                    current_level="缺失",
                    required_level="熟练掌握",
                    priority="high",
                    suggestion=f"建议优先补齐 {item.skill_name}，并用项目或作品证明掌握程度",
                )
            )
        elif item.importance == "preferred" and not item.matched:
            gaps.append(
                GapItem(
                    gap_item=f"优选技能: {item.skill_name}",
                    dimension="skill",
                    current_level="缺失",
                    required_level="了解或掌握",
                    priority="medium",
                    suggestion=f"建议补充 {item.skill_name} 基础认知，提高竞争力",
                )
            )

    for item in scores.competency.items:
        if item.score < 60:
            gaps.append(
                GapItem(
                    gap_item=f"职业素养: {_dimension_label(item.dimension)}",
                    dimension="competency",
                    current_level=f"{item.score:.0f}分",
                    required_level="60分以上",
                    priority="high" if item.score < 45 else "medium",
                    suggestion=_competency_suggestion(item.dimension),
                )
            )

    for item in scores.potential.items:
        if item.score < 50:
            gaps.append(
                GapItem(
                    gap_item=f"发展潜力: {_dimension_label(item.dimension)}",
                    dimension="potential",
                    current_level=f"{item.score:.0f}分",
                    required_level="50分以上",
                    priority="medium" if item.confidence >= 0.5 else "low",
                    suggestion=_potential_suggestion(item.dimension),
                )
            )

    priority_order = {"high": 0, "medium": 1, "low": 2}
    gaps.sort(key=lambda item: priority_order.get(item.priority, 3))
    return gaps


def _get_weight_for_role(role_category: str | None) -> WeightConfig:
    if role_category and role_category in WEIGHT_PRESETS:
        return WEIGHT_PRESETS[role_category].normalized()
    return WEIGHT_PRESETS["default"].normalized()


def _extract_job_info(
    job_profile: dict[str, Any],
    role_name: str | None,
    role_category: str | None,
) -> dict[str, Any]:
    basic_requirements = job_profile.get("basic_requirements") or {}
    title = (
        job_profile.get("role_name")
        or job_profile.get("title")
        or basic_requirements.get("title")
        or role_name
        or "目标岗位"
    )
    return {
        "title": title,
        "role": role_name or job_profile.get("role_name") or title,
        "role_category": role_category,
        "summary": job_profile.get("summary") or "",
    }


def _generate_match_reasons(
    scores: FourDimensionScores,
    job_info: dict[str, Any],
) -> list[str]:
    reasons: list[str] = []
    if scores.basic.score >= 80:
        reasons.append("基础门槛与岗位要求整体契合")
    if scores.skill.score >= 75:
        matched = [item.skill_name for item in scores.skill.items if item.matched][:5]
        if matched:
            reasons.append(f"已覆盖岗位核心技能: {', '.join(matched)}")
    strong_competencies = [
        _dimension_label(item.dimension)
        for item in scores.competency.items
        if item.score >= 75
    ]
    if strong_competencies:
        reasons.append(f"职业素养优势集中在 {', '.join(strong_competencies[:3])}")
    strong_potential = [
        _dimension_label(item.dimension)
        for item in scores.potential.items
        if item.score >= 75
    ]
    if strong_potential:
        reasons.append(f"成长潜力侧重 {', '.join(strong_potential[:3])}")
    if not reasons:
        reasons.append(f"与 {job_info.get('title', '目标岗位')} 存在基础适配空间")
    return reasons[:6]


async def compute_match(
    student_profile_data: dict[str, Any],
    job_profile_data: dict[str, Any],
    role_category: str | None = None,
    *,
    mode: MatchMode = "deep",
    role_name: str | None = None,
) -> MatchComputation:
    """Pure computation entrypoint without database writes."""
    basic_score = score_basic_requirements(student_profile_data, job_profile_data)
    if mode == "deep":
        skill_task = score_skills(student_profile_data, job_profile_data)
        competency_task = score_competency_llm(student_profile_data, job_profile_data)
        potential_task = score_potential_llm(student_profile_data)
    else:
        skill_task = asyncio.sleep(0, result=score_skills_heuristic(student_profile_data, job_profile_data))
        competency_task = asyncio.sleep(0, result=score_competency_heuristic(student_profile_data, job_profile_data))
        potential_task = asyncio.sleep(0, result=score_potential_heuristic(student_profile_data))

    skill_score, competency_score, potential_score = await asyncio.gather(
        skill_task,
        competency_task,
        potential_task,
    )

    weights = _get_weight_for_role(role_category)
    total_score = (
        weights.basic * basic_score.score
        + weights.skill * skill_score.score
        + weights.competency * competency_score.score
        + weights.potential * potential_score.score
    )
    scores = FourDimensionScores(
        basic=basic_score,
        skill=skill_score,
        competency=competency_score,
        potential=potential_score,
        weights={
            "basic": weights.basic,
            "skill": weights.skill,
            "competency": weights.competency,
            "potential": weights.potential,
        },
        total_score=round(total_score, 2),
    )
    gaps = analyze_gaps(scores)
    job_info = _extract_job_info(job_profile_data, role_name, role_category)
    reasons = _generate_match_reasons(scores, job_info)
    return MatchComputation(scores=scores, gaps=gaps, reasons=reasons, job_info=job_info)


async def calculate_match(
    student_profile_data: dict[str, Any],
    job_profile_data: dict[str, Any],
    role_category: str | None = None,
) -> tuple[FourDimensionScores, list[GapItem], list[str]]:
    """Backward-compatible wrapper returning the legacy tuple."""
    computation = await compute_match(
        student_profile_data,
        job_profile_data,
        role_category=role_category,
        mode="deep",
        role_name=job_profile_data.get("role_name"),
    )
    return computation.scores, computation.gaps, computation.reasons


async def _load_match_context(
    db: AsyncSession,
    student_id: UUID,
    job_profile_id: UUID,
) -> MatchContext:
    student_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    student_profile = student_result.scalar_one_or_none()
    if student_profile is None:
        raise ValueError(f"Student profile not found for student_id={student_id}")

    job_result = await db.execute(
        select(JobProfile, Role)
        .join(Role, JobProfile.role_id == Role.id)
        .where(JobProfile.id == job_profile_id)
    )
    job_row = job_result.first()
    if job_row is None:
        raise ValueError(f"Job profile not found: id={job_profile_id}")

    job_profile, role = job_row
    return MatchContext(
        student_profile=student_profile,
        job_profile=job_profile,
        student_profile_data=student_profile.profile_json or {},
        job_profile_data=job_profile.profile_json or {},
        role_name=role.name if role else None,
        role_category=role.category if role else None,
    )


async def upsert_match_result(
    db: AsyncSession,
    student_profile: StudentProfile,
    job_profile: JobProfile,
    computation: MatchComputation,
) -> MatchResult:
    """Create or update one persisted match result."""
    result = await db.execute(
        select(MatchResult).where(
            MatchResult.student_profile_id == student_profile.id,
            MatchResult.job_profile_id == job_profile.id,
        )
    )
    match_result = result.scalar_one_or_none()
    scores_payload = computation.scores_payload()
    gaps_payload = computation.gaps_payload()
    normalized_total = round(computation.scores.total_score / 100.0, 6)

    if match_result is None:
        match_result = MatchResult(
            student_profile_id=student_profile.id,
            job_profile_id=job_profile.id,
            total_score=normalized_total,
            scores_json=scores_payload,
            gaps_json=gaps_payload,
        )
        db.add(match_result)
    else:
        match_result.total_score = normalized_total
        match_result.scores_json = scores_payload
        match_result.gaps_json = gaps_payload

    await db.flush()
    await db.refresh(match_result)
    return match_result


async def match_student_job(
    db: AsyncSession,
    student_id: UUID,
    job_profile_id: UUID,
    *,
    mode: MatchMode = "deep",
) -> MatchResult:
    """Run matching for one student-job pair and persist the result."""
    context = await _load_match_context(db, student_id, job_profile_id)
    computation = await compute_match(
        context.student_profile_data,
        context.job_profile_data,
        role_category=context.role_category,
        mode=mode,
        role_name=context.role_name,
    )
    return await upsert_match_result(db, context.student_profile, context.job_profile, computation)


def _quick_skill_overlap(student_profile: dict[str, Any], job_profile: dict[str, Any]) -> float:
    student_skills = {
        _normalize_text(skill["name"])
        for skill in _extract_student_skills(student_profile)
        if _normalize_text(skill["name"])
    }
    job_skills = _extract_job_skills(job_profile)
    if not job_skills:
        return 60.0
    weighted_total = 0.0
    weighted_hit = 0.0
    for skill in job_skills:
        weight = float(skill["weight"] or 1.0)
        weighted_total += weight
        if _normalize_text(skill["name"]) in student_skills:
            weighted_hit += weight
    if weighted_total == 0.0:
        return 60.0
    return round(weighted_hit / weighted_total * 100.0, 2)


def _prefilter_candidates(
    student_profile_data: dict[str, Any],
    candidates: list[tuple[JobProfile, str | None, str | None]],
) -> list[tuple[JobProfile, str | None, str | None]]:
    ranked: list[tuple[tuple[JobProfile, str | None, str | None], float]] = []
    weights = _get_weight_for_role(None)
    for job_profile, role_name, role_category in candidates:
        job_data = job_profile.profile_json or {}
        basic_score = score_basic_requirements(student_profile_data, job_data).score
        skill_overlap = _quick_skill_overlap(student_profile_data, job_data)
        heuristic_total = (
            weights.basic * basic_score
            + weights.skill * skill_overlap
            + weights.competency * 55.0
            + weights.potential * 55.0
        )
        if role_category in WEIGHT_PRESETS:
            role_weights = _get_weight_for_role(role_category)
            heuristic_total = (
                role_weights.basic * basic_score
                + role_weights.skill * skill_overlap
                + role_weights.competency * 55.0
                + role_weights.potential * 55.0
            )
        ranked.append(((job_profile, role_name, role_category), heuristic_total))
    ranked.sort(key=lambda item: item[1], reverse=True)
    return [item[0] for item in ranked]


async def _compute_recommendation_candidate(
    student_profile_data: dict[str, Any],
    job_profile: JobProfile,
    role_name: str | None,
    role_category: str | None,
    semaphore: asyncio.Semaphore,
) -> tuple[JobProfile, MatchComputation] | None:
    async with semaphore:
        try:
            computation = await compute_match(
                student_profile_data,
                job_profile.profile_json or {},
                role_category=role_category,
                mode="recommend",
                role_name=role_name,
            )
            return job_profile, computation
        except Exception as exc:
            logger.warning("Recommendation scoring failed for job_profile %s: %s", job_profile.id, exc)
            return None


def _is_cached_match_fresh(
    match_updated_at: datetime | None,
    student_updated_at: datetime | None,
    job_profile_updated_at: datetime | None,
    role_updated_at: datetime | None,
) -> bool:
    """Check whether a cached match is newer than every dependent record."""

    if match_updated_at is None:
        return False

    dependencies = [
        timestamp
        for timestamp in (student_updated_at, job_profile_updated_at, role_updated_at)
        if timestamp is not None
    ]
    if not dependencies:
        return False

    return match_updated_at >= max(dependencies)


async def recommend_jobs(
    db: AsyncSession,
    student_id: UUID,
    top_k: int = 10,
    role_category: str | None = None,
) -> list[MatchResult]:
    """Recommend jobs with pure-compute ranking and sequential persistence."""
    student_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    student_profile = student_result.scalar_one_or_none()
    if student_profile is None:
        raise ValueError(f"Student profile not found for student_id={student_id}")

    cached_query = (
        select(MatchResult, JobProfile, Role)
        .join(JobProfile, MatchResult.job_profile_id == JobProfile.id)
        .join(Role, JobProfile.role_id == Role.id)
        .where(MatchResult.student_profile_id == student_profile.id)
        .order_by(MatchResult.total_score.desc())
    )
    if role_category:
        cached_query = cached_query.where(Role.category == role_category)

    cached_result = await db.execute(cached_query)
    cached_rows = list(cached_result.all())
    cache_is_fresh = all(
        _is_cached_match_fresh(
            match.updated_at,
            student_profile.updated_at,
            job_profile.updated_at if job_profile else None,
            role.updated_at if role else None,
        )
        for match, job_profile, role in cached_rows[:top_k]
    )
    if len(cached_rows) >= top_k and cache_is_fresh:
        return [match for match, _, _ in cached_rows[:top_k]]

    query = select(JobProfile, Role).join(Role, JobProfile.role_id == Role.id)
    if role_category:
        query = query.where(Role.category == role_category)
    result = await db.execute(query)
    rows = list(result.all())
    if not rows:
        return []

    candidates = [
        (job_profile, role.name if role else None, role.category if role else None)
        for job_profile, role in rows
    ]
    ranked_candidates = _prefilter_candidates(student_profile.profile_json or {}, candidates)
    shortlist_size = min(len(ranked_candidates), max(top_k + 2, min(top_k * 2, 15)))
    shortlist = ranked_candidates[:shortlist_size]

    compute_semaphore = asyncio.Semaphore(min(4, max(1, len(shortlist))))
    computed_results = await asyncio.gather(
        *[
            _compute_recommendation_candidate(
                student_profile.profile_json or {},
                job_profile,
                current_role_name,
                current_role_category,
                compute_semaphore,
            )
            for job_profile, current_role_name, current_role_category in shortlist
        ]
    )
    computed = [item for item in computed_results if item is not None]

    computed.sort(key=lambda item: item[1].scores.total_score, reverse=True)
    selected = computed[:top_k]

    persisted_results: list[MatchResult] = []
    for job_profile, computation in selected:
        persisted = await upsert_match_result(db, student_profile, job_profile, computation)
        persisted_results.append(persisted)

    return persisted_results


async def get_match_result(db: AsyncSession, match_id: UUID) -> MatchResult | None:
    result = await db.execute(select(MatchResult).where(MatchResult.id == match_id))
    return result.scalar_one_or_none()


async def get_student_matches(db: AsyncSession, student_id: UUID) -> list[MatchResult]:
    student_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    student_profile = student_result.scalar_one_or_none()
    if student_profile is None:
        return []

    result = await db.execute(
        select(MatchResult)
        .where(MatchResult.student_profile_id == student_profile.id)
        .order_by(MatchResult.total_score.desc())
    )
    return list(result.scalars().all())
