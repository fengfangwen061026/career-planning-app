"""Job profile service - generates role-level AI profiles from JD data.

Pipeline:
  1. 统计抽取 - TF-IDF / 词频提取硬锚点（带黑名单过滤）
  2. LLM 结构化抽取 - 代表性 JD → generate_json（按新7类Schema）
  3. 融合校验 - 统计 + LLM 结果合并
  4. 版本存储 - 写入 job_profiles 表（新版本不覆盖旧版本）
"""
import json
import logging
import math
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embedding import embedding
from app.ai.llm_provider import llm
from app.ai.prompts.job_profile import JOB_PROFILE_SYSTEM_PROMPT_V3, build_job_profile_prompt
from app.models.job import Job, JobProfile, Role

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 0. JD噪音黑名单（用于过滤非技能内容）
# ---------------------------------------------------------------------------

# JD段落标题（必须过滤）
JD_SECTION_HEADERS = frozenset([
    # 中文常见标题
    "岗位职责", "任职要求", "岗位描述", "职位描述", "工作内容", "岗位要求", "职位要求",
    "招聘要求", "岗位资格", "职位资格", "任职资格", "基本要求", "职位信息",
    "工作职责", "主要职责", "工作内容", "岗位职责", "岗位描述", "职位描述",
    "福利待遇", "薪酬福利", "薪资待遇", "员工福利", "公司福利", "薪酬待遇",
    "五险一金", "六险一金", "社保公积金", "带薪年假", "弹性工作", "周末双休",
    "技能要求", "能力要求", "素质要求", "专业要求", "学历要求", "经验要求",
    "加分项", "优先条件", "优先考虑", "熟悉", "了解", "掌握",
    "发展通道", "晋升空间", "培训机会", "成长机会",
    "团队", "职业发展氛围", "工作环境", "公司介绍", "公司简介", "关于我们",
    "投递方式", "联系方式", "简历投递", "欢迎投递", "期待加入", "欢迎加入",
    "符合要求", "有意向", "有兴趣", "可联系", "请投递",
    "公司规模成立", "公司", "公司位于", "公司地址", "办公地点",
    # 工作内容类短语（需过滤）
    "岗位内容", "工作内容", "职位内容", "工作描述", "职位描述",
    "测试工作", "开发工作", "运维工作", "设计工作", "运营工作",
    "包括", "负责", "参与", "协助", "完成", "制定", "执行",
    "提高", "优化", "改进", "提升", "推动", "跟进",
    "方案", "计划", "报告", "文档", "流程", "规范",
    "跟踪", "管理", "协调", "沟通", "对接",
    # 任职要求类短语
    "大专及以上", "本科及以上", "硕士及以上", "学历要求", "经验要求",
    "年以上", "年以下", "不限", "应届毕业生",
    # JD文本截断片段（常见于数据中）
    "学信网可查", "上市公司", "主要负责", "主要负责功能", "数据或接口",
    "统招本科", "毕业满", "计算机专业", "热爱软件测试", "有强力的自驱力",
    "能够在测试岗位", "入学习研究", "有无经验均可", "服从公司安排",
    "接受公司培养", "可接受异地", "欢迎符合要求", "大专及以上学历",
    "全国项目", "驻场测试", "项目驻场",
    # 英文常见标题
    "job description", "job requirements", "responsibilities", "qualifications",
    "benefits", "compensation", "skills required", "experience",
])

# 招聘模板话术（必须过滤）
RECRUITMENT_PHRASES = frozenset([
    "欢迎投递", "期待加入", "伙伴们投递", "符合要求的", "有意向的",
    "有兴趣的", "可联系", "请投递简历", "投递方式", "请发送简历",
    "简历投递", "联系方式", "面试流程", "招聘流程", "薪资面议",
    "具体薪资", "工资面议", "待遇从优", "氛围活跃", "团队年轻",
    "扁平管理", "领导好", "发展机会多", "成长空间大", "晋升通道",
])

# 企业介绍模板语（必须过滤）
COMPANY_INTRO_PHRASES = frozenset([
    "公司成立于", "公司位于", "公司是一家", "公司是", "公司拥有",
    "公司专注于", "公司致力于", "公司主营", "公司业务",
])

# 福利待遇短语（必须过滤，避免混入技能统计）
BENEFITS_PHRASES = frozenset([
    "提供五险一金", "公司可以提供住宿", "包住", "包吃", "包三餐",
    "试用期", "转正", "年终奖", "节日福利", "带薪年假", "带薪病假",
    "定期体检", "晋升空间", "发展空间", "股票期权", "绩效奖金",
    "项目奖金", "餐补", "交通补", "通讯补", "住房补", "高温补贴",
    "五险一金", "六险一金", "社保公积金", "弹性工作", "周末双休",
    "大小周", "扁平管理", "团队氛围好", "领导好", "发展机会多",
    "成长空间大", "晋升通道", "培训机会", "下午茶", "团建活动",
    "生日福利", "节日礼品", "年度旅游", "出国旅游", "免费体检",
])

# 招聘模板短语（必须过滤）
RECRUITMENT_TEMPLATES = frozenset([
    "欢迎符合要求的小", "欢迎符合要求的人", "统招本科学历及以",
    "能够在测试岗位深", "可接受异地工作优", "欢迎投递", "期待加入",
    "有意向者", "有意向的", "符合要求者", "符合要求的",
    "请投递简历", "请发送简历", "简历投递", "联系方式",
    "面试流程", "招聘流程", "薪资面议", "工资面议", "待遇面议",
    "具体薪资", "具体工资", "薪酬福利", "薪酬待遇",
])

# 笼统技能词（不应作为独立技能出现）
GENERIC_SKILL_TERMS = frozenset([
    "编程语言", "开发语言", "脚本语言",
    "测试工具", "测试软件", "测试平台",
    "测试方法", "测试方法论", "测试流程",
    "开发工具", "开发软件", "开发平台",
    "管理工具", "管理软件", "管理平台",
    "办公软件", "office软件",
    "技术栈", "技术体系", "技术框架",
])

# 组合黑名单
NOISE_BLACKLIST = JD_SECTION_HEADERS | RECRUITMENT_PHRASES | COMPANY_INTRO_PHRASES | BENEFITS_PHRASES | RECRUITMENT_TEMPLATES | GENERIC_SKILL_TERMS

# ---------------------------------------------------------------------------
# 1. 统计抽取阶段（带黑名单过滤）
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

# 扩展停用词（包含JD模板词）
_EXTENDED_STOP_WORDS = _STOP_WORDS | {
    "岗位", "职位", "要求", "职责", "工作", "负责", "任职", "资格",
    "经验", "能力", "技能", "优先", "熟悉", "了解", "掌握", "具备",
    "待遇", "福利", "薪资", "薪酬", "五险一金", "六险一金",
    "发展", "晋升", "培训", "成长", "空间", "机会",
    "团队", "公司", "办公", "地点", "环境", "氛围",
    "投递", "联系", "简历", "面试", "欢迎", "期待",
}


def _filter_noise_tokens(tokens: list[str]) -> list[str]:
    """过滤掉黑名单中的噪音词和扩展停用词"""
    filtered = []
    for token in tokens:
        token_lower = token.lower()
        # 过滤黑名单
        if token in NOISE_BLACKLIST or token_lower in NOISE_BLACKLIST:
            continue
        # 过滤扩展停用词
        if token in _EXTENDED_STOP_WORDS or token_lower in _EXTENDED_STOP_WORDS:
            continue
        # 过滤纯数字
        if token.isdigit():
            continue
        # 过滤长度过短的
        if len(token) < 2:
            continue
        filtered.append(token)
    return filtered


def _is_valid_experience(exp: str) -> bool:
    """验证经验值是否有效，排除明显是年份的数据。

    例如：
    - "1-3年" -> 有效
    - "3-5年" -> 有效
    - "不限" -> 有效
    - "应届毕业生" -> 有效
    - "2025年" -> 无效（年份）
    - "25年" -> 无效（年份，可能来自2025年的截断）
    - "62年" -> 无效（年份）
    """
    import re
    # 提取数字部分
    match = re.match(r'^(\d+)([-~]?\d*年)?$', exp)
    if not match:
        return True  # "不限" 等保持原样

    num = int(match.group(1))
    # 超过20年的数字大概率是年份（如2025、62）而非经验
    if num > 20:
        return False
    # 4位数字开头的是年份 (如 "2025年")
    if re.match(r'^20\d{2}', exp):
        return False
    return True


def _tokenize_jd(text: str) -> list[str]:
    """简单分词：提取英文词组和中文词，并过滤噪音"""
    tokens: list[str] = []
    for match in _SKILL_PATTERN.finditer(text):
        token = match.group().lower().strip()
        if token and len(token) >= 2:
            tokens.append(token)
    # 应用黑名单和扩展停用词过滤
    return _filter_noise_tokens(tokens)


def _extract_hard_anchors(jd_texts: list[str], top_n: int = 50) -> dict[str, Any]:
    """从所有 JD 文本中提取高频关键词（硬锚点），带黑名单过滤。

    Returns:
        {
            "skill_freq": {"python": 15, "java": 12, ...},
            "cert_freq": {"PMP": 3, ...},
            "education_freq": {"本科": 20, "硕士": 5},
            "experience_freq": {"1-3年": 35, "3-5年": 20, ...},
            "city_freq": {"北京": 156, "上海": 134, ...},
            "benefit_freq": {"五险一金": 456, "带薪年假": 234, ...},
            "total_jds": 25,
            "filtered_noise_count": 15,
        }
    """
    all_tokens: list[str] = []
    doc_freq: Counter[str] = Counter()  # 文档频率（出现该词的 JD 数量）
    noise_filtered_count = 0

    for jd in jd_texts:
        raw_tokens = []
        for match in _SKILL_PATTERN.finditer(jd):
            token = match.group().lower().strip()
            if token and len(token) >= 2:
                raw_tokens.append(token)

        # 统计被过滤的噪音词数量
        for token in raw_tokens:
            if token in NOISE_BLACKLIST:
                noise_filtered_count += 1

        # 过滤后应用到统计
        tokens = _filter_noise_tokens(raw_tokens)
        all_tokens.extend(tokens)
        unique_tokens = set(tokens)
        for t in unique_tokens:
            doc_freq[t] += 1

    total_jds = len(jd_texts)
    if total_jds == 0:
        return {"skill_freq": {}, "total_jds": 0, "filtered_noise_count": 0}

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

    # 经验年限统计
    exp_pattern = re.compile(r"(\d+[-~]?\d*年|不限|应届毕业生)")
    experience_freq: Counter[str] = Counter()
    for jd in jd_texts:
        # 标准化经验年限表达
        text = jd.replace("以上", "").replace("以下", "")
        for m in exp_pattern.finditer(text):
            exp = m.group()
            if "不限" in exp or "应届" in exp:
                exp = "不限"
            elif "-" in exp or "~" in exp:
                # 保持原样
                pass
            # 过滤掉明显是年份的数据（如 "2025年"、"25年"、"62年"）
            if _is_valid_experience(exp):
                experience_freq[exp] += 1

    # 城市统计
    city_pattern = re.compile(r"(北京|上海|广州|深圳|杭州|南京|苏州|成都|武汉|西安|重庆|天津|郑州|长沙|东莞|佛山|宁波|青岛|无锡|济南|石家庄|福州|厦门|合肥|昆明|沈阳|大连|哈尔滨|长春|南昌|贵阳|乌鲁木齐|呼和浩特)")
    city_freq: Counter[str] = Counter()
    for jd in jd_texts:
        for m in city_pattern.finditer(jd):
            city_freq[m.group()] += 1

    # 福利待遇统计
    benefit_pattern = re.compile(r"(五险一金|六险一金|社保公积金|带薪年假|弹性工作|周末双休|定期体检|年终奖|股票期权|餐补|交通补贴|通讯补贴|住房补贴|节日福利|生日福利|下午茶|团建活动|培训机会|晋升空间|扁平管理)")
    benefit_freq: Counter[str] = Counter()
    for jd in jd_texts:
        for m in benefit_pattern.finditer(jd):
            benefit_freq[m.group()] += 1

    # 证书统计（识别常见证书）
    cert_pattern = re.compile(r"(ISTQB|CMMI|ACP|PMP|PRINCE2|ITIL|CISP|软考|中级工程师|高级工程师|英语四级|英语六级|日语N|N1|N2)")
    cert_freq: Counter[str] = Counter()
    for jd in jd_texts:
        for m in cert_pattern.finditer(jd):
            cert_freq[m.group()] += 1

    return {
        "skill_freq": skill_freq,
        "education_freq": dict(education_freq),
        "experience_freq": dict(experience_freq),
        "city_freq": dict(city_freq),
        "benefit_freq": dict(benefit_freq),
        "cert_freq": dict(cert_freq),
        "total_jds": total_jds,
        "filtered_noise_count": noise_filtered_count,
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
# 3. 融合校验（适配新7类Schema）
# ---------------------------------------------------------------------------

def _merge_statistical_and_llm(
    stat_anchors: dict[str, Any],
    llm_profile: dict[str, Any],
    role_name: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """将统计硬锚点与 LLM 结果融合，返回 (merged_profile, evidence)。

    新7类Schema融合逻辑：
    1. 使用统计结果填充 basic_requirements 的分布数据
    2. technical_skills 与统计交叉校验
    3. 保留原始统计锚点（已过滤噪音）
    """
    total_jds = stat_anchors.get("total_jds", 0)
    skill_freq = stat_anchors.get("skill_freq", {})
    education_freq = stat_anchors.get("education_freq", {})
    experience_freq = stat_anchors.get("experience_freq", {})
    city_freq = stat_anchors.get("city_freq", {})
    benefit_freq = stat_anchors.get("benefit_freq", {})
    cert_freq = stat_anchors.get("cert_freq", {})
    filtered_noise_count = stat_anchors.get("filtered_noise_count", 0)

    # 构建 LLM 技能名称集合（小写）
    all_llm_skills = []
    technical_skills = llm_profile.get("technical_skills", {})
    for category, skills in technical_skills.items():
        if isinstance(skills, list):
            all_llm_skills.extend([s.get("name", "").lower() for s in skills])

    # 统计高频但 LLM 遗漏的技能 → 标记为待审核
    high_freq_threshold = max(1, total_jds * 0.3) if total_jds > 0 else 1
    supplemented: list[dict[str, Any]] = []

    for term, freq in skill_freq.items():
        if freq >= high_freq_threshold and term.lower() not in all_llm_skills:
            supplemented.append({
                "name": term,
                "frequency": freq,
                "weight": round(min(freq / total_jds, 1.0), 2) if total_jds else 0.5,
                "source": "statistical",
                "note": f"统计高频但LLM未识别，在{total_jds}条JD中出现{freq}次",
            })

    # 构建 evidence
    evidence: dict[str, Any] = {
        "statistical_anchors": {
            "total_jds_analyzed": total_jds,
            "top_skills_by_freq": skill_freq,
            "education_distribution": education_freq,
            "experience_distribution": experience_freq,
            "city_distribution": city_freq,
            "benefit_distribution": benefit_freq,
            "cert_distribution": cert_freq,
        },
        "llm_inferred_fields": [],
        "supplemented_skills": supplemented,
        "filtered_noise_count": filtered_noise_count,
    }

    # 构建最终画像（合并统计与LLM结果）
    merged_profile: dict[str, Any] = {
        "role_name": role_name,
        "total_jds_analyzed": total_jds,
        "basic_requirements": {
            "education": _normalize_distribution(education_freq),
            "experience": _normalize_distribution(experience_freq),
            "majors": llm_profile.get("basic_requirements", {}).get("majors", []),
            "languages": llm_profile.get("basic_requirements", {}).get("languages", []),
            "cities": [{"name": k, "count": v} for k, v in sorted(city_freq.items(), key=lambda x: -x[1])],
        },
        "technical_skills": technical_skills,
        "soft_skills": llm_profile.get("soft_skills", []),
        "certificates": _merge_certificates(cert_freq, llm_profile.get("certificates", [])),
        "job_responsibilities": llm_profile.get("job_responsibilities", []),
        "benefits": [{"name": k, "frequency": v} for k, v in sorted(benefit_freq.items(), key=lambda x: -x[1])],
        "metadata": {
            "version": "v2",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "noise_filtered_count": filtered_noise_count,
            "supplemented_skills_count": len(supplemented),
        },
    }

    return merged_profile, evidence


def _normalize_distribution(freq_dict: dict[str, int]) -> dict[str, float]:
    """将频次字典转换为概率分布"""
    if not freq_dict:
        return {}
    total = sum(freq_dict.values())
    if total == 0:
        return {}
    return {k: round(v / total, 3) for k, v in freq_dict.items()}


def _merge_certificates(
    stat_certs: dict[str, int],
    llm_certs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """合并证书：使用LLM结果，但补充统计频次"""
    result = []
    llm_cert_names = {c.get("name", "").lower() for c in llm_certs}

    # 先添加LLM识别的证书
    for cert in llm_certs:
        name = cert.get("name", "")
        result.append({
            "name": name,
            "frequency": stat_certs.get(name, 0) or cert.get("frequency", 0),
            "importance": cert.get("importance", "preferred"),
        })

    # 添加统计高频但LLM遗漏的证书
    for name, freq in stat_certs.items():
        if name.lower() not in llm_cert_names and freq >= 3:
            result.append({
                "name": name,
                "frequency": freq,
                "importance": "preferred",
            })

    return result


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
    merged_profile, evidence = _merge_statistical_and_llm(stat_anchors, llm_profile, role.name)

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
    """构建画像摘要文本用于 embedding（适配新7类Schema）。"""
    parts = [f"岗位: {role_name}"]

    # 基础要求 - 学历分布
    basic_req = profile.get("basic_requirements", {})
    if basic_req.get("education"):
        edu_dist = basic_req["education"]
        if edu_dist:
            top_edu = max(edu_dist.items(), key=lambda x: x[1])[0] if edu_dist else ""
            if top_edu:
                parts.append(f"学历: {top_edu}")

    # 核心技术技能 - 收集所有必填技能
    all_required_skills = []
    tech_skills = profile.get("technical_skills", {})
    for category, skills in tech_skills.items():
        if isinstance(skills, list):
            for s in skills:
                if s.get("is_required"):
                    all_required_skills.append(s.get("name", ""))

    if all_required_skills:
        parts.append(f"核心技能: {', '.join(all_required_skills[:15])}")

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
