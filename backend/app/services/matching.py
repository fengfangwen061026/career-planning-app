"""Matching service - 四维度人岗匹配引擎.

四维评分体系：
1. 基础要求评分（规则化，满分 100）
2. 职业技能评分（混合：规则 + 向量语义补偿，满分 100）
3. 职业素养评分（LLM 辅助，满分 100）
4. 发展潜力评分（LLM 辅助，满分 100）
"""
import asyncio
import logging
from typing import Any
from uuid import UUID

import numpy as np
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
    WeightConfig,
    WEIGHT_PRESETS,
)

logger = logging.getLogger(__name__)

# ── 学历映射 ─────────────────────────────────────────────────────

DEGREE_ORDER: dict[str, int] = {
    "初中": 1, "中专": 2, "高中": 2,
    "大专": 3, "专科": 3,
    "本科": 4, "学士": 4,
    "硕士": 5, "研究生": 5,
    "博士": 6, "MBA": 5, "EMBA": 5,
}


def _degree_rank(degree: str | None) -> int:
    if not degree:
        return 0
    for key, rank in DEGREE_ORDER.items():
        if key in degree:
            return rank
    return 0


# =====================================================================
# 1. 基础要求评分（规则化）
# =====================================================================

def score_basic_requirements(
    student_profile: dict,
    job_profile: dict,
) -> BasicScore:
    """规则化评分：学历、专业、经验、硬性条件."""
    s_dims = student_profile.get("dimensions", {})
    s_basic = s_dims.get("basic_requirements", {})
    j_basic = job_profile.get("basic_requirements", {})

    score = 0.0
    penalties: list[dict[str, Any]] = []

    # ── 学历匹配（40 分）──
    s_degree = s_basic.get("degree") or student_profile.get("basic_info", {}).get("degree", "")
    j_degree_str = j_basic.get("education", "")

    s_rank = _degree_rank(s_degree)
    j_rank = _degree_rank(j_degree_str)
    if j_rank == 0:
        edu_score = 40.0  # 无要求，满分
    elif s_rank >= j_rank:
        edu_score = 40.0
    elif s_rank == j_rank - 1:
        edu_score = 25.0  # 低一级
    else:
        edu_score = 10.0  # 差距较大
        penalties.append({"type": "education", "detail": f"学历不满足: 要求{j_degree_str}, 实际{s_degree}", "deduction": 30})
    education_match = {"student": s_degree, "required": j_degree_str, "score": edu_score, "max": 40}
    score += edu_score

    # ── 专业方向匹配（25 分）──
    s_major = s_basic.get("major", "")
    # job profile 的 role_name 和 majors
    j_role_name = job_profile.get("role_name", "")
    j_majors = j_basic.get("majors", [])
    j_majors_text = " ".join(j_majors) if isinstance(j_majors, list) else str(j_majors)

    major_score = 15.0  # 默认中性分
    if s_major:
        major_lower = s_major.lower()
        match_text = (j_role_name + " " + j_majors_text).lower()
        keywords = [w for w in major_lower.replace("工程", " ").replace("学", " ").split() if len(w) >= 2]
        hits = sum(1 for kw in keywords if kw in match_text)
        if hits >= 2:
            major_score = 25.0
        elif hits >= 1:
            major_score = 20.0
    major_match = {"student_major": s_major, "job_direction": j_majors_text or j_role_name, "score": major_score, "max": 25}
    score += major_score

    # ── 经验年限（20 分）──
    s_years = _parse_years(s_basic.get("work_years"))
    j_years_exp = j_basic.get("experience_years", 0)
    j_years = float(j_years_exp.get("preferred") or j_years_exp.get("min", 0)) if isinstance(j_years_exp, dict) else float(j_years_exp or 0)
    if j_years == 0:
        exp_score = 20.0
    elif s_years >= j_years:
        exp_score = 20.0
    elif s_years >= j_years * 0.5:
        exp_score = 12.0
    else:
        exp_score = 5.0
        penalties.append({"type": "experience", "detail": f"经验不足: 要求{j_years}年, 实际{s_years}年", "deduction": 15})
    experience_match = {"student_years": s_years, "required_years": j_years, "score": exp_score, "max": 20}
    score += exp_score

    # ── 其他硬性条件（15 分）──
    hard_conditions: list[dict[str, Any]] = []
    # 城市匹配（job profile 可能没有城市信息）
    s_city = s_basic.get("city", "") or student_profile.get("basic_info", {}).get("location", "")
    # job profile 的城市可能在 cities 列表里
    j_cities = j_basic.get("cities", [])
    j_city_str = ""
    if isinstance(j_cities, list) and j_cities:
        j_city_str = j_cities[0].get("name", "") if isinstance(j_cities[0], dict) else str(j_cities[0])
    elif isinstance(j_cities, str):
        j_city_str = j_cities
    city_ok = not j_city_str or not s_city or _city_match(s_city, j_city_str)
    hard_conditions.append({"condition": "city", "student": s_city, "required": j_city_str, "met": city_ok})
    score += 15.0 if city_ok else 8.0
    if not city_ok:
        penalties.append({"type": "city", "detail": f"城市不匹配: 要求{j_city_str}, 实际{s_city}", "deduction": 7})

    return BasicScore(
        score=min(score, 100.0),
        education_match=education_match,
        major_match=major_match,
        experience_match=experience_match,
        hard_conditions=hard_conditions,
        penalties=penalties,
    )


def _parse_years(val: Any) -> float:
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val)
    import re
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    return float(m.group(1)) if m else 0.0


def _city_match(s_city: str, j_city: str) -> bool:
    s = s_city.replace("市", "").replace("省", "").strip()
    j = j_city.replace("市", "").replace("省", "").strip()
    return s == j or s in j or j in s


# =====================================================================
# 2. 职业技能评分（规则 + 语义补偿）
# =====================================================================

async def score_skills(
    student_profile: dict,
    job_profile: dict,
) -> SkillScore:
    """技能匹配评分：逐项检查 + 向量语义补偿."""
    s_dims = student_profile.get("dimensions", {})

    s_skills_raw = s_dims.get("professional_skills", [])
    # 使用适配器获取 job profile 的技能列表（兼容新旧结构）
    j_skills_raw = job_profile.get("technical_skills", [])

    # 标准化学生技能列表
    s_skill_names: list[str] = []
    s_skill_map: dict[str, dict] = {}
    for sk in s_skills_raw:
        name = sk.get("skill_name") or sk.get("name", "")
        if name:
            s_skill_names.append(name.lower())
            s_skill_map[name.lower()] = sk

    # 遍历岗位要求技能
    items: list[SkillMatchItem] = []
    required_total = 0.0
    required_earned = 0.0
    preferred_total = 0.0
    preferred_earned = 0.0
    bonus_earned = 0.0

    # 为语义匹配准备 embeddings（批量）
    j_skill_names = [sk.get("skill_name") or sk.get("name", "") for sk in j_skills_raw if sk.get("skill_name") or sk.get("name")]
    all_names = list(set(s_skill_names + [n.lower() for n in j_skill_names]))
    embeddings_map: dict[str, list[float]] = {}
    if all_names:
        try:
            vecs = await embedding_provider.embed_batch(all_names)
            for name, vec in zip(all_names, vecs):
                embeddings_map[name] = vec
        except Exception as e:
            logger.warning("Skill embedding failed, falling back to exact match: %s", e)

    for j_sk in j_skills_raw:
        j_name = (j_sk.get("skill_name") or j_sk.get("name", "")).strip()
        if not j_name:
            continue
        importance = j_sk.get("importance", "required")
        weight = float(j_sk.get("weight", 1.0))

        # 精确匹配
        exact_match = j_name.lower() in s_skill_map
        matched_by = "none"
        item_score = 0.0
        evidence = ""
        semantic_sim: float | None = None

        if exact_match:
            matched_by = "exact"
            item_score = 100.0
            sk_data = s_skill_map[j_name.lower()]
            evidence = sk_data.get("proficiency_evidence") or sk_data.get("evidence", "") or f"简历中明确提及 {j_name}"
        else:
            # 语义补偿：找最相似的学生技能
            best_sim = 0.0
            best_name = ""
            j_vec = embeddings_map.get(j_name.lower())
            if j_vec is not None:
                for s_name in s_skill_names:
                    s_vec = embeddings_map.get(s_name)
                    if s_vec is not None:
                        sim = _cosine_similarity(j_vec, s_vec)
                        if sim > best_sim:
                            best_sim = sim
                            best_name = s_name

            semantic_sim = best_sim if best_sim > 0 else None
            if best_sim >= 0.80:
                matched_by = "semantic"
                item_score = best_sim * 100  # 按相似度给部分分
                sk_data = s_skill_map.get(best_name, {})
                evidence = f"语义相近技能 '{best_name}' (相似度 {best_sim:.2f}). {sk_data.get('proficiency_evidence', '')}"
            elif best_sim >= 0.60:
                matched_by = "semantic"
                item_score = best_sim * 70  # 更保守
                evidence = f"部分相关技能 '{best_name}' (相似度 {best_sim:.2f})"

        item = SkillMatchItem(
            skill_name=j_name,
            importance=importance,
            weight=weight,
            matched=matched_by != "none",
            score=item_score,
            semantic_similarity=semantic_sim,
            evidence=evidence,
            matched_by=matched_by,
        )
        items.append(item)

        # 按 importance 分组统计
        if importance == "required":
            required_total += weight
            required_earned += weight * (item_score / 100.0)
        elif importance == "preferred":
            preferred_total += weight
            preferred_earned += weight * (item_score / 100.0)
        else:  # bonus
            bonus_earned += weight * (item_score / 100.0)

    # 汇总技能分
    # required 占 60 分, preferred 占 25 分, bonus 最多 15 分
    req_score = (required_earned / required_total * 60) if required_total > 0 else 60.0
    pref_score = (preferred_earned / preferred_total * 25) if preferred_total > 0 else 12.5
    bon_score = min(bonus_earned * 5, 15.0)  # bonus 封顶 15 分

    # 缺失必备技能强扣分
    missing_required = sum(1 for it in items if it.importance == "required" and not it.matched)
    penalty = missing_required * 8  # 每缺一项必备技能扣 8 分
    total = max(0, min(req_score + pref_score + bon_score - penalty, 100.0))

    return SkillScore(
        score=total,
        required_score=req_score,
        preferred_score=pref_score,
        bonus_score=bon_score,
        items=items,
    )


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.array(a)
    vb = np.array(b)
    dot = np.dot(va, vb)
    norm = np.linalg.norm(va) * np.linalg.norm(vb)
    if norm == 0:
        return 0.0
    return float(dot / norm)


# =====================================================================
# 3. 职业素养评分（LLM 辅助）
# =====================================================================

async def score_competency(
    student_profile: dict,
    job_profile: dict,
) -> CompetencyScore:
    """LLM 评估职业素养: 沟通/团队/抗压/创新/学习."""
    # 使用适配器获取软素养（兼容新旧结构）
    j_comp = job_profile.get("soft_competencies", {})
    messages = build_competency_prompt(student_profile, j_comp)
    try:
        result = await llm.generate_json(
            prompt=messages[-1]["content"],
            system_prompt=messages[0]["content"],
            temperature=0.3,
        )
        raw_items = result.get("items", [])
        items = [
            CompetencyItem(
                dimension=it.get("dimension", ""),
                score=float(it.get("score", 0)),
                evidence=it.get("evidence", ""),
                confidence=float(it.get("confidence", 0)),
            )
            for it in raw_items
            if it.get("dimension")
        ]
    except Exception as e:
        logger.error("Competency LLM evaluation failed: %s", e)
        items = [
            CompetencyItem(dimension=d, score=50, evidence="评估失败，给予中性分", confidence=0.2)
            for d in ("communication", "teamwork", "stress_tolerance", "innovation", "learning_ability")
        ]

    # 加权汇总（根据岗位要求的权重）
    total = 0.0
    weight_sum = 0.0
    for item in items:
        # 岗位要求中对应维度的值作为权重参考
        j_weight = _get_competency_weight(j_comp, item.dimension)
        w = j_weight * item.confidence  # confidence 降权
        total += item.score * w
        weight_sum += w
    avg = total / weight_sum if weight_sum > 0 else 50.0

    return CompetencyScore(score=min(avg, 100.0), items=items)


def _get_competency_weight(j_comp: dict, dimension: str) -> float:
    """从岗位画像的 soft_competencies 中获取维度权重."""
    entry = j_comp.get(dimension, {})
    if isinstance(entry, dict):
        val = entry.get("value")
        if val is None:
            legacy_importance = str(entry.get("importance", "")).strip().lower()
            legacy_map = {
                "核心要求": 5,
                "核心素养": 5,
                "重要": 4,
                "较重要": 4,
                "一般": 3,
                "了解": 2,
                "低": 1,
            }
            val = legacy_map.get(legacy_importance, 3)
    elif isinstance(entry, (int, float)):
        val = entry
    elif isinstance(entry, str) and entry.strip().isdigit():
        val = int(entry.strip())
    else:
        val = 3
    val = max(1, min(int(val), 5))
    return float(val) / 5.0  # 归一化到 0-1


# =====================================================================
# 4. 发展潜力评分（LLM 辅助）
# =====================================================================

async def score_potential(
    student_profile: dict,
) -> PotentialScore:
    """LLM 评估发展潜力: 成长轨迹/自驱力/学习速度/适应能力."""
    messages = build_potential_prompt(student_profile)
    try:
        result = await llm.generate_json(
            prompt=messages[-1]["content"],
            system_prompt=messages[0]["content"],
            temperature=0.3,
        )
        raw_items = result.get("items", [])
        items = [
            PotentialItem(
                dimension=it.get("dimension", ""),
                score=float(it.get("score", 0)),
                evidence=it.get("evidence", ""),
                confidence=float(it.get("confidence", 0)),
            )
            for it in raw_items
            if it.get("dimension")
        ]
    except Exception as e:
        logger.error("Potential LLM evaluation failed: %s", e)
        items = [
            PotentialItem(dimension=d, score=50, evidence="评估失败，给予保守分", confidence=0.2)
            for d in ("growth_trajectory", "self_driven", "learning_speed", "adaptability")
        ]

    # 简单加权平均（confidence 降权）
    total = 0.0
    weight_sum = 0.0
    for item in items:
        w = max(item.confidence, 0.2)  # 最低权重 0.2，避免除零
        total += item.score * w
        weight_sum += w
    avg = total / weight_sum if weight_sum > 0 else 50.0

    return PotentialScore(score=min(avg, 100.0), items=items)


# =====================================================================
# 差距分析
# =====================================================================

def analyze_gaps(scores: FourDimensionScores) -> list[GapItem]:
    """对每个不满分维度，输出差距清单（按优先级排序）."""
    gaps: list[GapItem] = []

    # 基础维度差距
    basic = scores.basic
    for pen in basic.penalties:
        gaps.append(GapItem(
            gap_item=pen["type"],
            dimension="basic",
            current_level=pen.get("detail", "").split("实际")[-1] if "实际" in pen.get("detail", "") else "不足",
            required_level=pen.get("detail", "").split("要求")[-1].split(",")[0] if "要求" in pen.get("detail", "") else "未知",
            priority="high",
            suggestion=_basic_suggestion(pen["type"]),
        ))

    # 技能差距
    for item in scores.skill.items:
        if not item.matched and item.importance == "required":
            gaps.append(GapItem(
                gap_item=f"必备技能: {item.skill_name}",
                dimension="skill",
                current_level="缺失" if item.matched_by == "none" else f"部分匹配 ({item.score:.0f}分)",
                required_level="熟练掌握",
                priority="high",
                suggestion=f"建议系统学习 {item.skill_name}，可通过在线课程、项目实践等方式提升",
            ))
        elif not item.matched and item.importance == "preferred":
            gaps.append(GapItem(
                gap_item=f"优选技能: {item.skill_name}",
                dimension="skill",
                current_level="缺失",
                required_level="了解或掌握",
                priority="medium",
                suggestion=f"建议了解 {item.skill_name} 基础知识，可提升竞争力",
            ))

    # 素养差距
    for item in scores.competency.items:
        if item.score < 60:
            gaps.append(GapItem(
                gap_item=f"职业素养: {_dimension_label(item.dimension)}",
                dimension="competency",
                current_level=f"{item.score:.0f}分",
                required_level="60分以上",
                priority="medium" if item.score >= 40 else "high",
                suggestion=_competency_suggestion(item.dimension),
            ))

    # 潜力差距
    for item in scores.potential.items:
        if item.score < 50 and item.confidence >= 0.5:
            gaps.append(GapItem(
                gap_item=f"发展潜力: {_dimension_label(item.dimension)}",
                dimension="potential",
                current_level=f"{item.score:.0f}分",
                required_level="50分以上",
                priority="low",
                suggestion=_potential_suggestion(item.dimension),
            ))

    # 按优先级排序
    priority_order = {"high": 0, "medium": 1, "low": 2}
    gaps.sort(key=lambda g: priority_order.get(g.priority, 3))
    return gaps


def _basic_suggestion(pen_type: str) -> str:
    suggestions = {
        "education": "可考虑继续深造或获取相关专业认证弥补学历差距",
        "experience": "建议通过实习、兼职或项目实践积累相关工作经验",
        "city": "可考虑是否愿意迁移至目标城市工作",
    }
    return suggestions.get(pen_type, "建议针对性提升")


def _competency_suggestion(dim: str) -> str:
    suggestions = {
        "communication": "建议多参与团队项目汇报、社团活动等锻炼沟通表达能力",
        "teamwork": "建议参与团队项目、社团组织等活动提升协作能力",
        "stress_tolerance": "建议通过竞赛、限时项目等场景锻炼抗压能力",
        "innovation": "建议参与创新创业大赛、开源项目等培养创新思维",
        "learning_ability": "建议主动学习新技能，参与跨领域项目提升学习能力",
    }
    return suggestions.get(dim, "建议针对性提升相关素养")


def _potential_suggestion(dim: str) -> str:
    suggestions = {
        "growth_trajectory": "建议制定清晰的学习计划，定期复盘成长轨迹",
        "self_driven": "建议主动参与开源项目、竞赛等，展现自驱力",
        "learning_speed": "建议尝试快速学习新工具/框架，积累跨领域经验",
        "adaptability": "建议通过实习、项目等拓宽视野，提升环境适应能力",
    }
    return suggestions.get(dim, "建议持续自我提升")


def _dimension_label(dim: str) -> str:
    labels = {
        "communication": "沟通能力",
        "teamwork": "团队协作",
        "stress_tolerance": "抗压能力",
        "innovation": "创新能力",
        "learning_ability": "学习能力",
        "growth_trajectory": "成长轨迹",
        "self_driven": "自驱力",
        "learning_speed": "学习速度",
        "adaptability": "适应能力",
    }
    return labels.get(dim, dim)


# =====================================================================
# 汇总与主函数
# =====================================================================

def _get_weight_for_role(role_category: str | None) -> WeightConfig:
    """根据岗位类别返回权重配置."""
    if role_category and role_category in WEIGHT_PRESETS:
        return WEIGHT_PRESETS[role_category]
    return WEIGHT_PRESETS["default"]


def _generate_match_reasons(scores: FourDimensionScores) -> list[str]:
    """根据四维评分生成匹配理由."""
    reasons: list[str] = []
    if scores.basic.score >= 80:
        reasons.append("基础条件（学历/专业/经验）与岗位要求高度匹配")
    if scores.skill.score >= 75:
        matched_skills = [it.skill_name for it in scores.skill.items if it.matched]
        if matched_skills:
            reasons.append(f"掌握岗位核心技能: {', '.join(matched_skills[:5])}")
    for item in scores.competency.items:
        if item.score >= 80 and item.confidence >= 0.6:
            reasons.append(f"{_dimension_label(item.dimension)}突出: {item.evidence[:60]}")
    for item in scores.potential.items:
        if item.score >= 80 and item.confidence >= 0.6:
            reasons.append(f"{_dimension_label(item.dimension)}优秀: {item.evidence[:60]}")
    if not reasons:
        reasons.append("综合条件基本满足岗位要求")
    return reasons[:6]


async def calculate_match(
    student_profile_data: dict,
    job_profile_data: dict,
    role_category: str | None = None,
) -> tuple[FourDimensionScores, list[GapItem], list[str]]:
    """核心匹配函数：计算四维评分 + 差距分析.

    Args:
        student_profile_data: 学生画像 profile_json
        job_profile_data: 岗位画像 profile_json
        role_category: 岗位类别（用于选择权重预设）

    Returns:
        (四维评分, 差距清单, 匹配理由)
    """
    # 1. 基础要求评分（同步，规则化）
    basic = score_basic_requirements(student_profile_data, job_profile_data)

    # 2. 技能评分 + 3. 素养评分 + 4. 潜力评分 并行
    skill_task = score_skills(student_profile_data, job_profile_data)
    comp_task = score_competency(student_profile_data, job_profile_data)
    potential_task = score_potential(student_profile_data)

    skill, comp, potential = await asyncio.gather(skill_task, comp_task, potential_task)

    # 加权汇总
    weights = _get_weight_for_role(role_category)
    weights = weights.normalized()

    total = (
        weights.basic * basic.score
        + weights.skill * skill.score
        + weights.competency * comp.score
        + weights.potential * potential.score
    )

    scores = FourDimensionScores(
        basic=basic,
        skill=skill,
        competency=comp,
        potential=potential,
        weights={
            "basic": weights.basic,
            "skill": weights.skill,
            "competency": weights.competency,
            "potential": weights.potential,
        },
        total_score=round(total, 2),
    )

    gaps = analyze_gaps(scores)
    reasons = _generate_match_reasons(scores)

    return scores, gaps, reasons


# =====================================================================
# DB 操作封装
# =====================================================================

async def match_student_job(
    db: AsyncSession,
    student_id: UUID,
    job_profile_id: UUID,
) -> MatchResult:
    """指定学生和岗位画像，执行匹配并持久化结果."""
    # 查询学生画像
    stmt = select(StudentProfile).where(StudentProfile.student_id == student_id)
    result = await db.execute(stmt)
    sp = result.scalar_one_or_none()
    if sp is None:
        raise ValueError(f"Student profile not found for student_id={student_id}")

    # 查询岗位画像
    stmt = select(JobProfile).where(JobProfile.id == job_profile_id)
    result = await db.execute(stmt)
    jp = result.scalar_one_or_none()
    if jp is None:
        raise ValueError(f"Job profile not found: id={job_profile_id}")

    # 获取 role category（用于权重选择）
    role_category: str | None = None
    if jp.role_id:
        stmt = select(Role.category).where(Role.id == jp.role_id)
        result = await db.execute(stmt)
        role_category = result.scalar_one_or_none()

    # 执行匹配
    scores, gaps, reasons = await calculate_match(
        sp.profile_json, jp.profile_json, role_category,
    )

    # 写入 / 更新 match_results
    stmt = select(MatchResult).where(
        MatchResult.student_profile_id == sp.id,
        MatchResult.job_profile_id == jp.id,
    )
    result = await db.execute(stmt)
    mr = result.scalar_one_or_none()

    scores_dict = scores.model_dump()
    gaps_list = [g.model_dump() for g in gaps]

    if mr is None:
        mr = MatchResult(
            student_profile_id=sp.id,
            job_profile_id=jp.id,
            total_score=scores.total_score / 100.0,  # DB 存 0-1
            scores_json={**scores_dict, "match_reasons": reasons},
            gaps_json=gaps_list,
        )
        db.add(mr)
    else:
        mr.total_score = scores.total_score / 100.0
        mr.scores_json = {**scores_dict, "match_reasons": reasons}
        mr.gaps_json = gaps_list

    await db.flush()
    return mr


# 并发控制信号量（避免 LLM 限流）
_MATCH_SEMAPHORE = asyncio.Semaphore(5)  # 最多同时处理 5 个岗位
# 预筛选阈值：basic * 0.3（不含 LLM 部分），低于此值则跳过 LLM 评分
_PRE_FILTER_BASIC_WEIGHT = 0.3
_PRE_FILTER_THRESHOLD = 20.0  # basic * 0.3 < 20 => basic < 67 分的岗位跳过


async def _match_single_job(
    db: AsyncSession,
    student_id: UUID,
    jp: JobProfile,
) -> MatchResult | None:
    """对单个岗位执行匹配（带并发控制信号量）."""
    async with _MATCH_SEMAPHORE:
        try:
            return await match_student_job(db, student_id, jp.id)
        except Exception as e:
            logger.warning("Match failed for job_profile %s: %s", jp.id, e)
            return None


def _prefilter_candidates(
    student_profile_json: dict,
    job_profiles: list[JobProfile],
) -> list[tuple[JobProfile, float]]:
    """用纯规则（无 LLM）快速预筛选岗位，返回 (job_profile, basic_score) 列表.

    只用 score_basic_requirements（同步，无 LLM），只做快速过滤。
    """
    results: list[tuple[JobProfile, float]] = []
    for jp in job_profiles:
        try:
            basic = score_basic_requirements(student_profile_json, jp.profile_json)
            results.append((jp, basic.score))
        except Exception as e:
            logger.debug("Pre-filter failed for job %s: %s", jp.id, e)
    # 按 basic_score 降序
    results.sort(key=lambda x: x[1], reverse=True)
    return results


async def recommend_jobs(
    db: AsyncSession,
    student_id: UUID,
    top_k: int = 10,
    role_category: str | None = None,
) -> list[MatchResult]:
    """为学生推荐 Top-N 匹配岗位.

    步骤：
    1. 纯规则预筛选（basic，无 LLM）：从所有岗位中取 basic_score 最高的 top_k*3 候选
    2. 并发执行四维评分（受信号量控制，最多同时 5 个）
    3. 按总分排序，返回 top_k
    """
    # 查询学生画像
    stmt = select(StudentProfile).where(StudentProfile.student_id == student_id)
    result = await db.execute(stmt)
    sp = result.scalar_one_or_none()
    if sp is None:
        raise ValueError(f"Student profile not found for student_id={student_id}")

    # 查询候选岗位画像
    jp_query = select(JobProfile)
    if role_category:
        jp_query = jp_query.join(Role).where(Role.category == role_category)
    result = await db.execute(jp_query)
    all_jps: list[JobProfile] = list(result.scalars().all())

    if not all_jps:
        return []

    # 第一轮：纯规则快速预筛选（无 LLM，毫秒级）
    prefilt = _prefilter_candidates(sp.profile_json, all_jps)
    # 严格限制候选数量：只取 basic_score 最高的 top_k+2 个，再由阈值过滤
    cap = top_k + 2  # 最多候选数
    threshold = _PRE_FILTER_THRESHOLD
    candidates = [jp for jp, score in prefilt[:cap] if score >= threshold]
    # 兜底：若过滤后少于 top_k，补入最高分的
    if len(candidates) < top_k:
        for jp, score in prefilt[cap:]:
            if jp not in candidates:
                candidates.append(jp)
            if len(candidates) >= top_k:
                break

    if not candidates:
        # 兜底：直接返回 basic_score 最高的前 top_k（即使分数低）
        candidates = [jp for jp, _ in prefilt[:top_k]]

    # 第二轮：只对候选岗位并发做 LLM 评分
    tasks = [_match_single_job(db, student_id, jp) for jp in candidates]
    results = await asyncio.gather(*tasks)

    # 过滤失败结果并按总分排序
    match_results = [mr for mr in results if mr is not None]
    match_results.sort(key=lambda m: m.total_score, reverse=True)
    return match_results[:top_k]


async def get_match_result(db: AsyncSession, match_id: UUID) -> MatchResult | None:
    """查询匹配结果."""
    stmt = select(MatchResult).where(MatchResult.id == match_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_student_matches(db: AsyncSession, student_id: UUID) -> list[MatchResult]:
    """查询学生所有匹配结果."""
    stmt = select(StudentProfile).where(StudentProfile.student_id == student_id)
    result = await db.execute(stmt)
    sp = result.scalar_one_or_none()
    if sp is None:
        return []

    stmt = select(MatchResult).where(
        MatchResult.student_profile_id == sp.id,
    ).order_by(MatchResult.total_score.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())
