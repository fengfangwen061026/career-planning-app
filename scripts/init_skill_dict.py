"""Initialize skill dictionary from JD and JobProfile data.

This script:
1. Extracts skill keywords from all JDs
2. Collects skills from existing JobProfiles
3. Manually categorizes them into: programming languages, frameworks, databases, tools, certificates, soft skills
4. Builds synonym mapping table
5. Writes to skill_dictionary table
"""
import asyncio
import logging
import re
from collections import Counter
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embedding import embedding
from app.database import async_session_factory
from app.models.job import Job, JobProfile
from app.models.skill_dictionary import SkillDictionary

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 技能类别定义
CATEGORIES = {
    "编程语言": ["python", "java", "javascript", "typescript", "go", "rust", "c++", "c#", "php", "ruby", "swift", "kotlin", "scala", "r", "matlab"],
    "前端框架": ["react", "vue", "angular", "svelte", "next.js", "nuxt", "flutter", "react native", "uni-app"],
    "后端框架": ["node.js", "django", "flask", "fastapi", "spring", "spring boot", "gin", "echo", "rails", "laravel", "asp.net"],
    "数据库": ["mysql", "postgresql", "mongodb", "redis", "elasticsearch", "oracle", "sqlite", "hbase", "cassandra", "dynamodb"],
    "大数据": ["hadoop", "spark", "hive", "kafka", "flink", "storm", "spark streaming", "flume"],
    "云平台": ["aws", "azure", "gcp", "aliyun", "tencent cloud", "huawei cloud"],
    "容器编排": ["docker", "kubernetes", "helm", "istio", "terraform"],
    "开发工具": ["git", "svn", "jenkins", "gitlab ci", "github actions", "maven", "gradle", "npm", "yarn", "webpack"],
    "机器学习": ["tensorflow", "pytorch", "keras", "scikit-learn", "xgboost", "lightgbm", "catboost", "paddlepaddle"],
    "数据科学": ["pandas", "numpy", "scipy", "matplotlib", "tableau", "power bi", "excel"],
    "测试": ["selenium", "appium", "pytest", "junit", "jest", "mocha", "unittest", "postman", "jmeter"],
    "运维": ["linux", "nginx", "apache", "tomcat", "consul", "etcd", "prometheus", "grafana", "elk"],
    "项目管理": ["agile", "scrum", "jira", "confluence", "pmp", "prince2"],
    "软技能": ["communication", "teamwork", "problem solving", "leadership", "critical thinking", "time management"],
    "证书": ["pmp", "cissp", "cisa", "aws certified", "ocp", "mcdba", "rhce"],
    "其他": [],
}

# 同义词映射表
SYNONYMS = {
    "Python": ["python", "py", "python3", "python3.x"],
    "JavaScript": ["javascript", "js", "ecmascript", "es6", "es7", "es8"],
    "TypeScript": ["typescript", "ts", "tsx"],
    "Java": ["java", "j2ee", "j2se", "jdk", "jre"],
    "Go": ["golang", "go language", "go语言"],
    "Rust": ["rust", "rustlang"],
    "C++": ["c++", "cpp", "c plus plus", "c++11", "c++14", "c++17"],
    "C#": ["c#", "csharp", "c sharp", "dotnet"],
    "React": ["react", "reactjs", "react.js", "reactjs"],
    "Vue": ["vue", "vuejs", "vue.js", "vue2", "vue3"],
    "Angular": ["angular", "angularjs", "angular.js"],
    "Node.js": ["node", "nodejs", "node.js", "nodejs"],
    "Docker": ["docker", "dockerfile", "容器"],
    "Kubernetes": ["k8s", "kubernetes", "kube", "k8s集群"],
    "AWS": ["amazon web services", "aws", "amazon aws", "亚马逊云", "aws云"],
    "GCP": ["google cloud platform", "gcp", "google cloud", "谷歌云"],
    "Azure": ["azure", "microsoft azure", "微软云", "azure云"],
    "Machine Learning": ["ml", "machine learning", "机器学习", "ml算法"],
    "Deep Learning": ["dl", "deep learning", "深度学习", "神经网络"],
    "NLP": ["nlp", "natural language processing", "自然语言处理", "文本处理"],
    "Linux": ["linux", "unix", "ubuntu", "centos", "redhat", "debian"],
    "Git": ["git", "git版本控制", "github", "gitlab", "bitbucket"],
    "REST API": ["rest", "restful", "rest api", "restful api", "restfulapi"],
    "GraphQL": ["graphql", "gql", "graphQL"],
    "MongoDB": ["mongodb", "mongo", "mongod"],
    "Redis": ["redis", "redisdb", "redisson"],
    "Kafka": ["kafka", "apache kafka", "kafka消息队列"],
    "Spark": ["spark", "apache spark", "spark sql", "pyspark"],
    "TensorFlow": ["tensorflow", "tf", "tensorflow2"],
    "PyTorch": ["pytorch", "torch", "pytorch深度学习"],
    "MySQL": ["mysql", "mysql数据库", "mysql5.7", "mysql8.0"],
    "PostgreSQL": ["postgresql", "postgres", "pg", "pgsql"],
    "Elasticsearch": ["elasticsearch", "es", "elastic", "es搜索引擎"],
    "Hadoop": ["hadoop", "hdfs", "mapreduce", "yarn"],
    "Hive": ["hive", "hiveql", "hql"],
    "Flink": ["flink", "apache flink", "flink流处理"],
    "Spring": ["spring", "spring framework", "spring框架"],
    "Spring Boot": ["spring boot", "springboot", "spring-boot"],
    "Django": ["django", "django框架", "django web"],
    "Flask": ["flask", "flask框架", "microframework"],
    "FastAPI": ["fastapi", "fast api", "fast-framework"],
    "Pandas": ["pandas", "pandas库", "python pandas"],
    "NumPy": ["numpy", "numpy库", "python numpy"],
    "Scikit-learn": ["scikit-learn", "sklearn", "scikit"],
    "PMP": ["pmp", "pmp认证", "项目管理专业人士"],
    "Agile": ["agile", "敏捷", "scrum", "敏捷开发"],
    "CI/CD": ["ci/cd", "持续集成", "持续交付", "jenkins", "gitlab ci"],
}

# 技能域定义
DOMAINS = {
    "技术类": ["编程语言", "前端框架", "后端框架", "数据库", "大数据", "机器学习", "数据科学"],
    "平台类": ["云平台", "容器编排", "运维"],
    "工具类": ["开发工具", "测试", "项目管理"],
    "通用类": ["软技能", "证书", "其他"],
}


def _detect_category(skill_name: str) -> tuple[str, str]:
    """检测技能类别和域。"""
    skill_lower = skill_name.lower()

    for category, keywords in CATEGORIES.items():
        for keyword in keywords:
            if keyword.lower() in skill_lower or skill_lower in keyword.lower():
                domain = "技术类"
                for cat, dom in DOMAINS.items():
                    if category in dom:
                        domain = cat
                        break
                return category, domain

    # 默认分类
    return "其他", "通用类"


def _extract_skills_from_jd(jd_text: str) -> list[str]:
    """从JD文本中提取技能关键词。"""
    if not jd_text:
        return []

    # 英文技能模式
    english_pattern = re.compile(
        r'\b([A-Za-z][A-Za-z0-9+#.\-]{1,30})\b',
        re.IGNORECASE
    )

    # 中文技能模式
    chinese_pattern = re.compile(
        r'[\u4e00-\u9fff]{2,8}',
    )

    skills = set()

    # 提取英文
    for match in english_pattern.finditer(jd_text):
        skill = match.group().strip()
        if len(skill) >= 2:
            skills.add(skill.lower())

    # 提取中文
    for match in chinese_pattern.finditer(jd_text):
        skill = match.group().strip()
        if skill in ["编程", "开发", "设计", "测试", "运维", "架构", "算法"]:
            skills.add(skill)

    return list(skills)


async def _extract_skills_from_job_profiles(session: AsyncSession) -> list[str]:
    """从JobProfile中提取技能列表。"""
    result = await session.execute(select(JobProfile))
    job_profiles = result.scalars().all()

    all_skills = []

    for profile in job_profiles:
        profile_json = profile.profile_json
        if not profile_json:
            continue

        # 从 dimensions.professional_skills 提取
        dims = profile_json.get("dimensions", {})
        skills = dims.get("professional_skills", [])

        for skill in skills:
            skill_name = skill.get("skill_name", "")
            if skill_name:
                all_skills.append(skill_name)

    return all_skills


async def _collect_all_skills(session: AsyncSession) -> dict[str, int]:
    """收集所有技能并统计频率。"""
    skill_counter: Counter = Counter()

    # 1. 从所有JD中提取技能
    result = await session.execute(select(Job))
    jobs = result.scalars().all()

    logger.info(f"Processing {len(jobs)} jobs...")

    for job in jobs:
        if job.description:
            skills = _extract_skills_from_jd(job.description)
            skill_counter.update(skills)

        if job.skills:
            for skill in job.skills:
                if skill:
                    skill_counter[skill.lower()] += 1

    # 2. 从JobProfile中提取技能
    profile_skills = await _extract_skills_from_job_profiles(session)
    skill_counter.update([s.lower() for s in profile_skills])

    logger.info(f"Found {len(skill_counter)} unique skills")

    return dict(skill_counter)


def _build_skill_entry(
    canonical_name: str,
    usage_count: int = 0,
) -> dict[str, Any]:
    """构建技能字典条目。"""
    category, domain = _detect_category(canonical_name)
    aliases = SYNONYMS.get(canonical_name, [canonical_name.lower()])

    return {
        "canonical_name": canonical_name,
        "category": category,
        "domain": domain,
        "aliases_json": aliases,
        "usage_count": usage_count,
        "resume_usage_count": 0,
    }


async def init_skill_dictionary() -> None:
    """初始化技能词典。"""
    async with async_session_factory() as session:
        # 检查是否已有数据
        result = await session.execute(select(SkillDictionary).limit(1))
        existing = result.scalar_one_or_none()

        if existing:
            logger.info("Skill dictionary already exists, skipping initialization")
            return

        # 收集所有技能
        skill_freq = await _collect_all_skills(session)

        # 预定义的标准化技能列表（带分类）
        predefined_skills = []

        # 从同义词表获取标准化名称
        for canonical, aliases in SYNONYMS.items():
            total_freq = sum(skill_freq.get(a.lower(), 0) for a in aliases)
            predefined_skills.append((canonical, total_freq))

        # 添加高频但未收录的技能
        for skill, freq in sorted(skill_freq.items(), key=lambda x: x[1], reverse=True):
            # 跳过太短的
            if len(skill) < 2:
                continue

            # 检查是否已在同义词表中
            is_known = False
            for canonical, aliases in SYNONYMS.items():
                if skill.lower() in [a.lower() for a in aliases]:
                    is_known = True
                    break

            if not is_known and freq >= 3:  # 至少出现3次
                predefined_skills.append((skill.title(), freq))

        # 去重
        seen = set()
        unique_skills = []
        for skill, freq in predefined_skills:
            if skill.lower() not in seen:
                seen.add(skill.lower())
                unique_skills.append((skill, freq))

        # 创建技能字典条目
        entries = []
        for skill, freq in unique_skills:
            entry = _build_skill_entry(skill, freq)
            entries.append(entry)

        logger.info(f"Creating {len(entries)} skill dictionary entries")

        # 批量写入
        for entry_data in entries:
            skill_dict = SkillDictionary(**entry_data)
            session.add(skill_dict)

        await session.commit()
        logger.info("Skill dictionary initialization completed")


async def update_skill_from_jds() -> None:
    """从JD更新技能使用统计。"""
    async with async_session_factory() as session:
        skill_freq: Counter = Counter()

        # 统计JD中的技能
        result = await session.execute(select(Job))
        jobs = result.scalars().all()

        for job in jobs:
            if job.description:
                skills = _extract_skills_from_jd(job.description)
                skill_counter = Counter(skills)

                # 归一化到标准技能
                normalized = normalize_skill_batch(list(skill_counter.keys()))
                for norm_skill, original_freq in zip(normalized, skill_counter.values()):
                    skill_freq[norm_skill.lower()] += original_freq

        # 更新数据库
        for skill_name, count in skill_freq.items():
            result = await session.execute(
                select(SkillDictionary).where(
                    SkillDictionary.canonical_name.ilike(skill_name)
                )
            )
            skill_dict = result.scalar_one_or_none()
            if skill_dict:
                skill_dict.usage_count = count

        await session.commit()
        logger.info(f"Updated usage counts for {len(skill_freq)} skills")


def normalize_skill_batch(skills: list[str]) -> list[str]:
    """批量归一化技能名称。"""
    normalized = []
    for skill in skills:
        skill_lower = skill.lower().strip()

        # 检查是否是标准技能的别名
        for canonical, aliases in SYNONYMS.items():
            if skill_lower in [a.lower() for a in aliases]:
                normalized.append(canonical)
                break
        else:
            normalized.append(skill.title())

    return normalized


if __name__ == "__main__":
    asyncio.run(init_skill_dictionary())
