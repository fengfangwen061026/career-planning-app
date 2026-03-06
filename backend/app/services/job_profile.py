"""Job profile service - generates role-level AI profiles from JD data.

Pipeline:
  1. 统计抽取 - TF-IDF / 词频提取硬锚点
  2. LLM 结构化抽取 - 代表性 JD → generate_json
  3. 融合校验 - 统计 + LLM 结果合并
  4. 版本存储 - 写入 job_profiles 表（新版本不覆盖旧版本）
"""
import json
import logging
import math
import re
from collections import Counter
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embedding import embedding
from app.ai.llm_provider import llm
from app.ai.prompts.job_profile import JOB_PROFILE_SYSTEM_PROMPT, build_job_profile_prompt
from app.models.job import Job, JobProfile, Role

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 1. 统计抽取阶段
# ---------------------------------------------------------------------------

# 中文停用词（精简版）
_STOP_WORDS = frozenset(
    "的 了 在 是 我 有 和 就 不 人 都 一 一个 上 也 很 到 说 要 去 你 会 着 没有 "
    "看 好 自己 这 他 她 它 们 那 被 从 把 让 用 与 及 等 但 而 或 对 中 能 可以 "
    "以 所 因为 所以 如果 虽然 但是 然后 这个 那个 什么 怎么 如何 哪 哪些 "
    "任职 负责 熟悉 熟练 了解 掌握 具备 具有 优先 优秀 相关 经验 工作 能力 "
    "岗位 职位 要求 条件 描述 公司 以上 年 月".split()
)

# 技能/工具相关的 pattern（用于过滤纯汉字通用词）
_SKILL_PATTERN = re.compile(
    r"[A-Za-z][A-Za-z0-9+#.\-]{1,}|[\u4e00-\u9fff]{2,8}",
)


def _tokenize_jd(text: str) -> list[str]:
    """简单分词：提取英文词组和中文词。"""
    tokens: list[str] = []
    for match in _SKILL_PATTERN.finditer(text):
        token = match.group().lower().strip()
        if token and token not in _STOP_WORDS and len(token) >= 2:
            tokens.append(token)
    return tokens


def _extract_hard_anchors(jd_texts: list[str], top_n: int = 30) -> dict[str, Any]:
    """从所有 JD 文本中提取高频关键词（硬锚点）。

    Returns:
        {
            "skill_freq": {"python": 15, "java": 12, ...},
            "cert_freq": {"PMP": 3, ...},
            "tool_freq": {"git": 8, ...},
            "education_freq": {"本科": 20, "硕士": 5},
            "total_jds": 25,
        }
    """
    all_tokens: list[str] = []
    doc_freq: Counter[str] = Counter()  # 文档频率（出现该词的 JD 数量）

    for jd in jd_texts:
        tokens = _tokenize_jd(jd)
        all_tokens.extend(tokens)
        unique_tokens = set(tokens)
        for t in unique_tokens:
            doc_freq[t] += 1

    total_jds = len(jd_texts)
    if total_jds == 0:
        return {"skill_freq": {}, "total_jds": 0}

    # TF-IDF 计算
    tf = Counter(all_tokens)
    tfidf_scores: dict[str, float] = {}
    for term, count in tf.items():
        tf_val = count / len(all_tokens) if all_tokens else 0
        idf_val = math.log((total_jds + 1) / (doc_freq.get(term, 0) + 1)) + 1
        tfidf_scores[term] = tf_val * idf_val

    # 按 TF-IDF 排序取 top_n
    sorted_terms = sorted(tfidf_scores.items(), key=lambda x: x[1], reverse=True)[:top_n]

    # 按文档频率分级
    skill_freq: dict[str, int] = {}
    for term, _ in sorted_terms:
        skill_freq[term] = doc_freq[term]

    # 学历统计
    edu_pattern = re.compile(r"(大专|本科|硕士|博士|研究生)")
    education_freq: Counter[str] = Counter()
    for jd in jd_texts:
        for m in edu_pattern.finditer(jd):
            edu = m.group()
            if edu == "研究生":
                edu = "硕士"
            education_freq[edu] += 1

    return {
        "skill_freq": skill_freq,
        "education_freq": dict(education_freq),
        "total_jds": total_jds,
    }


# ---------------------------------------------------------------------------
# 2. 代表性 JD 筛选
# ---------------------------------------------------------------------------

def _select_representative_jds(jobs: list[Job], max_count: int = 10) -> list[str]:
    """从 Job 列表中按信息密度筛选代表性 JD。

    策略：按 description 长度排序取中间段（避免过短无信息、过长噪声）。
    """
    with_desc = [(j, len(j.description or "")) for j in jobs if j.description]
    if not with_desc:
        return []

    # 按长度排序
    with_desc.sort(key=lambda x: x[1])

    # 移除最短 10% 和最长 10%
    n = len(with_desc)
    lo = max(0, n // 10)
    hi = max(lo + 1, n - n // 10)
    candidates = with_desc[lo:hi]

    if not candidates:
        candidates = with_desc

    # 均匀采样 max_count 条
    step = max(1, len(candidates) // max_count)
    selected = [candidates[i][0] for i in range(0, len(candidates), step)][:max_count]

    result: list[str] = []
    for job in selected:
        parts = [f"岗位: {job.title}"]
        if job.company_name:
            parts.append(f"公司: {job.company_name}")
        if job.city:
            parts.append(f"城市: {job.city}")
        if job.salary_min and job.salary_max:
            parts.append(f"薪资: {job.salary_min}-{job.salary_max}元/月")
        if job.education_req:
            parts.append(f"学历: {job.education_req}")
        if job.experience_req:
            parts.append(f"经验: {job.experience_req}")
        if job.skills:
            parts.append(f"技能标签: {', '.join(job.skills)}")
        parts.append(f"描述:\n{job.description}")
        result.append("\n".join(parts))

    return result


# ---------------------------------------------------------------------------
# 3. 融合校验
# ---------------------------------------------------------------------------

def _merge_statistical_and_llm(
    stat_anchors: dict[str, Any],
    llm_profile: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """将统计硬锚点与 LLM 结果融合，返回 (merged_profile, evidence)。"""
    total_jds = stat_anchors.get("total_jds", 0)
    skill_freq = stat_anchors.get("skill_freq", {})
    education_freq = stat_anchors.get("education_freq", {})

    evidence: dict[str, Any] = {
        "statistical_anchors": {
            "total_jds_analyzed": total_jds,
            "top_skills_by_freq": skill_freq,
            "education_distribution": education_freq,
        },
        "llm_inferred_fields": [],
    }

    # 获取 LLM 输出的 professional_skills
    dimensions = llm_profile.get("dimensions", {})
    llm_skills = dimensions.get("professional_skills", [])

    # 构建 LLM 技能名称集合（小写）
    llm_skill_names = {s.get("skill_name", "").lower() for s in llm_skills}

    # 统计高频但 LLM 遗漏的技能 → 补充
    high_freq_threshold = max(1, total_jds * 0.3) if total_jds > 0 else 1
    supplemented: list[dict[str, Any]] = []

    for term, freq in skill_freq.items():
        if freq >= high_freq_threshold and term.lower() not in llm_skill_names:
            supplemented.append({
                "skill_id": f"stat-{term.lower().replace(' ', '-')}",
                "skill_name": term,
                "category": "统计补充",
                "level": 3,
                "importance": "preferred",
                "weight": round(min(freq / total_jds, 1.0), 2) if total_jds else 0.5,
                "source_jds": [],
                "evidence": {
                    "source": "statistical",
                    "text": f"在 {total_jds} 条 JD 中出现 {freq} 次 ({freq*100//total_jds}%)"
                            if total_jds else f"出现 {freq} 次",
                },
            })

    if supplemented:
        llm_skills.extend(supplemented)
        evidence["supplemented_skills"] = [s["skill_name"] for s in supplemented]

    # LLM 输出但统计中低频的 → 标记为 "LLM推断"
    low_freq_threshold = max(1, total_jds * 0.1) if total_jds > 0 else 0
    llm_inferred: list[str] = []
    for skill in llm_skills:
        name_lower = skill.get("skill_name", "").lower()
        freq = skill_freq.get(name_lower, 0)
        if freq < low_freq_threshold and skill.get("category") != "统计补充":
            skill["category"] = skill.get("category", "") + " (LLM推断)"
            llm_inferred.append(skill.get("skill_name", ""))

    if llm_inferred:
        evidence["llm_inferred_fields"] = llm_inferred

    # 学历融合：如果统计有明确众数，校验 LLM 输出
    if education_freq:
        most_common_edu = max(education_freq, key=education_freq.get)  # type: ignore[arg-type]
        basic_req = dimensions.get("basic_requirements", {})
        degree_info = basic_req.get("degree", {})
        if degree_info and degree_info.get("value") != most_common_edu:
            evidence["education_override"] = {
                "llm_value": degree_info.get("value"),
                "statistical_mode": most_common_edu,
                "distribution": education_freq,
            }
            degree_info["value"] = most_common_edu

    # 写回
    dimensions["professional_skills"] = llm_skills
    llm_profile["dimensions"] = dimensions

    return llm_profile, evidence


# ---------------------------------------------------------------------------
# 4. 公共服务函数
# ---------------------------------------------------------------------------

async def generate_role_profile(
    role_id: UUID,
    db: AsyncSession,
) -> dict[str, Any]:
    """为指定 Role 生成岗位画像（完整 4 步流水线）。

    Returns:
        {"profile": JobProfile ORM object, "stats": {...}}
    """
    # 获取 Role
    role = await db.get(Role, role_id)
    if not role:
        raise ValueError(f"Role {role_id} not found")

    # 获取该 Role 下所有 JD
    result = await db.execute(
        select(Job).where(Job.role_id == role_id)
    )
    jobs = list(result.scalars().all())

    if not jobs:
        raise ValueError(f"Role '{role.name}' has no associated jobs")

    logger.info("Generating profile for role '%s' with %d JDs", role.name, len(jobs))

    # Step 1: 统计抽取
    all_descriptions = [j.description or "" for j in jobs if j.description]
    stat_anchors = _extract_hard_anchors(all_descriptions)
    logger.info("Statistical extraction done: %d anchor terms", len(stat_anchors.get("skill_freq", {})))

    # Step 2: LLM 结构化抽取
    representative_jds = _select_representative_jds(jobs, max_count=10)
    if not representative_jds:
        raise ValueError(f"Role '{role.name}' has no JDs with descriptions")

    messages = build_job_profile_prompt(role.name, representative_jds)
    system_prompt = messages[0]["content"]
    user_prompt = messages[1]["content"]

    llm_profile = await llm.generate_json(
        prompt=user_prompt,
        system_prompt=system_prompt,
        temperature=0.3,
        max_retries=3,
    )
    logger.info("LLM extraction done for role '%s'", role.name)

    # Step 3: 融合校验
    merged_profile, evidence = _merge_statistical_and_llm(stat_anchors, llm_profile)

    # Step 4: 版本存储
    # 获取当前最大版本号
    max_ver_result = await db.execute(
        select(func.max(JobProfile.version)).where(JobProfile.role_id == role_id)
    )
    max_ver = max_ver_result.scalar() or 0
    new_version = max_ver + 1

    # 生成 embedding（基于 profile 摘要）
    profile_summary = _build_profile_summary(merged_profile, role.name)
    profile_embedding = await embedding.embed(profile_summary)

    job_profile = JobProfile(
        role_id=role_id,
        profile_json=merged_profile,
        evidence_json=evidence,
        version=new_version,
        embedding=profile_embedding,
    )
    db.add(job_profile)
    await db.flush()
    await db.refresh(job_profile)

    logger.info("Profile v%d saved for role '%s' (id=%s)", new_version, role.name, job_profile.id)

    return {
        "profile": job_profile,
        "stats": {
            "total_jds": len(jobs),
            "jds_with_description": len(all_descriptions),
            "representative_jds_used": len(representative_jds),
            "statistical_anchor_terms": len(stat_anchors.get("skill_freq", {})),
            "supplemented_skills": len(evidence.get("supplemented_skills", [])),
            "llm_inferred_skills": len(evidence.get("llm_inferred_fields", [])),
        },
    }


def _build_profile_summary(profile: dict[str, Any], role_name: str) -> str:
    """构建画像摘要文本用于 embedding。"""
    parts = [f"岗位: {role_name}"]

    basic = profile.get("basic_info", {})
    if basic.get("industries"):
        parts.append(f"行业: {', '.join(basic['industries'])}")

    dims = profile.get("dimensions", {})
    skills = dims.get("professional_skills", [])
    skill_names = [s.get("skill_name", "") for s in skills if s.get("importance") == "required"]
    if skill_names:
        parts.append(f"核心技能: {', '.join(skill_names[:15])}")

    basic_req = dims.get("basic_requirements", {})
    degree = basic_req.get("degree", {})
    if isinstance(degree, dict) and degree.get("value"):
        parts.append(f"学历: {degree['value']}")

    return " | ".join(parts)


async def get_role_profiles(
    role_id: UUID,
    db: AsyncSession,
) -> dict[str, Any]:
    """获取指定 Role 的所有画像版本。"""
    role = await db.get(Role, role_id)
    if not role:
        raise ValueError(f"Role {role_id} not found")

    result = await db.execute(
        select(JobProfile)
        .where(JobProfile.role_id == role_id)
        .order_by(JobProfile.version.desc())
    )
    profiles = list(result.scalars().all())

    return {
        "role": role,
        "profiles": profiles,
    }


async def update_job_profile(
    profile_id: UUID,
    profile_data: dict[str, Any],
    db: AsyncSession,
) -> JobProfile:
    """人工微调画像。"""
    profile = await db.get(JobProfile, profile_id)
    if not profile:
        raise ValueError(f"JobProfile {profile_id} not found")

    profile.profile_json = profile_data
    profile.evidence_json = {
        **(profile.evidence_json or {}),
        "manual_edit": True,
    }

    # 重新生成 embedding
    role = await db.get(Role, profile.role_id)
    role_name = role.name if role else "unknown"
    summary = _build_profile_summary(profile_data, role_name)
    profile.embedding = await embedding.embed(summary)

    await db.flush()
    await db.refresh(profile)
    return profile
