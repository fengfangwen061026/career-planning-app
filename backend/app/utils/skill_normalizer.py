"""Skill normalizer - normalizes skill names to handle synonyms.

This module provides:
- normalize(): single skill normalization with exact/synonym/vector matching
- normalize_batch(): batch normalization for multiple skills
- Database-backed skill dictionary with vector similarity
"""

from typing import Any, TYPE_CHECKING

# Skill synonyms mapping (fallback when DB not available)
SKILL_SYNONYMS: dict[str, list[str]] = {
    "Python": ["python", "py", "python3", "python3.x", "py3"],
    "JavaScript": ["javascript", "js", "ecmascript", "es6", "es7", "es8", "jscript"],
    "TypeScript": ["typescript", "ts", "tsx", "tsjs"],
    "Java": ["java", "j2ee", "j2se", "jdk", "jre", "javase", "javaee"],
    "Go": ["golang", "go language", "go语言", "go语言"],
    "Rust": ["rust", "rustlang", "rust语言"],
    "C++": ["c++", "cpp", "c plus plus", "c++11", "c++14", "c++17", "c++20"],
    "C#": ["c#", "csharp", "c sharp", "dotnet", "c#.net"],
    "PHP": ["php", "php7", "php8", "php语言"],
    "Ruby": ["ruby", "ruby on rails", "ror", "rails"],
    "Swift": ["swift", "swiftui", "ios开发"],
    "Kotlin": ["kotlin", "kotlin语言", "android开发"],
    "React": ["react", "reactjs", "react.js", "reactjs", "react前端"],
    "Vue": ["vue", "vuejs", "vue.js", "vue2", "vue3", "vuejs"],
    "Angular": ["angular", "angularjs", "angular.js", "angular2"],
    "Node.js": ["node", "nodejs", "node.js", "nodejs", "node后端"],
    "Django": ["django", "django框架", "django web", "dj"],
    "Flask": ["flask", "flask框架", "microframework", "flask微框架"],
    "FastAPI": ["fastapi", "fast api", "fast-framework", "fastapiframework"],
    "Spring": ["spring", "spring framework", "spring框架", "spring框架"],
    "Spring Boot": ["spring boot", "springboot", "spring-boot", "springboot"],
    "Gin": ["gin", "gin框架", "go gin"],
    "Echo": ["echo", "echo框架", "go echo"],
    "Rails": ["rails", "ruby on rails", "ror", "rails框架"],
    "Laravel": ["laravel", "php laravel", "laravel框架"],
    "MySQL": ["mysql", "mysql数据库", "mysql5.7", "mysql8.0", "mysql数据库"],
    "PostgreSQL": ["postgresql", "postgres", "pg", "pgsql", "pg数据库"],
    "MongoDB": ["mongodb", "mongo", "mongod", "mongodb数据库"],
    "Redis": ["redis", "redisdb", "redisson", "redis缓存"],
    "Elasticsearch": ["elasticsearch", "es", "elastic", "es搜索引擎", "es全文搜索"],
    "SQLite": ["sqlite", "sqlite3", "轻量级数据库"],
    "Oracle": ["oracle", "oracle数据库", "oracledb"],
    "HBase": ["hbase", "hbase数据库", "hadoop hbase"],
    "Cassandra": ["cassandra", "cassandra数据库", "nosql cassandra"],
    "Docker": ["docker", "dockerfile", "容器", "docker容器"],
    "Kubernetes": ["k8s", "kubernetes", "kube", "k8s集群", "容器编排"],
    "Helm": ["helm", "helm charts", "helm包管理"],
    "Istio": ["istio", "istio服务网格", "service mesh"],
    "Terraform": ["terraform", "tf", "基础设施即代码"],
    "AWS": ["amazon web services", "aws", "amazon aws", "亚马逊云", "aws云", "aws服务"],
    "GCP": ["google cloud platform", "gcp", "google cloud", "谷歌云", "gcp云"],
    "Azure": ["azure", "microsoft azure", "微软云", "azure云", "azure云服务"],
    "Alibaba Cloud": ["阿里云", "aliyun", "alibaba cloud", "阿里云服务"],
    "Hadoop": ["hadoop", "hdfs", "mapreduce", "yarn", "hadoop大数据"],
    "Spark": ["spark", "apache spark", "spark sql", "pyspark", "spark大数据"],
    "Hive": ["hive", "hiveql", "hql", "hive数据仓库"],
    "Kafka": ["kafka", "apache kafka", "kafka消息队列", "mq kafka"],
    "Flink": ["flink", "apache flink", "flink流处理", "实时计算"],
    "Storm": ["storm", "apache storm", "storm流处理"],
    "TensorFlow": ["tensorflow", "tf", "tensorflow2", "tf深度学习"],
    "PyTorch": ["pytorch", "torch", "pytorch深度学习", "torch深度学习"],
    "Keras": ["keras", "keras深度学习", "tf keras"],
    "Scikit-learn": ["scikit-learn", "sklearn", "scikit", "机器学习库"],
    "XGBoost": ["xgboost", "xgb", "xgboost机器学习"],
    "LightGBM": ["lightgbm", "lgb", "lgbm机器学习"],
    "PaddlePaddle": ["paddlepaddle", "paddle", "百度飞桨"],
    "Machine Learning": ["ml", "machine learning", "机器学习", "ml算法", "机器学习算法"],
    "Deep Learning": ["dl", "deep learning", "深度学习", "神经网络", "深度神经网络"],
    "NLP": ["nlp", "natural language processing", "自然语言处理", "文本处理", "nlp算法"],
    "Computer Vision": ["cv", "computer vision", "计算机视觉", "图像处理", "cv算法"],
    "Pandas": ["pandas", "pandas库", "python pandas", "数据分析"],
    "NumPy": ["numpy", "numpy库", "python numpy", "数值计算"],
    "SciPy": ["scipy", "scipy库", "科学计算"],
    "Matplotlib": ["matplotlib", "matplotlib绘图", "数据可视化"],
    "Linux": ["linux", "unix", "ubuntu", "centos", "redhat", "debian", "linux系统"],
    "Git": ["git", "git版本控制", "github", "gitlab", "bitbucket", "版本控制"],
    "Jenkins": ["jenkins", "ci jenkins", "持续集成jenkins"],
    "Maven": ["maven", "maven构建", "java构建工具"],
    "Gradle": ["gradle", "gradle构建", "android构建"],
    "NPM": ["npm", "npm包管理", "node包管理"],
    "Yarn": ["yarn", "yarn包管理", "facebook yarn"],
    "Webpack": ["webpack", "webpack打包", "前端打包工具"],
    "REST API": ["rest", "restful", "rest api", "restful api", "restfulapi", "rest接口"],
    "GraphQL": ["graphql", "gql", "graphQL", "图查询语言"],
    "Selenium": ["selenium", "selenium自动化", "web自动化"],
    "Appium": ["appium", "appium自动化", "移动端自动化"],
    "Pytest": ["pytest", "pytest测试", "python测试"],
    "JUnit": ["junit", "junit测试", "java单元测试"],
    "Jest": ["jest", "jest测试", "js测试框架"],
    "Postman": ["postman", "postman接口测试", "api测试"],
    "JMeter": ["jmeter", "jmeter性能测试", "性能测试工具"],
    "Nginx": ["nginx", "nginx服务器", "反向代理"],
    "Apache": ["apache", "apache服务器", "httpd"],
    "Tomcat": ["tomcat", "tomcat服务器", "java容器"],
    "Prometheus": ["prometheus", "普罗米修斯", "监控"],
    "Grafana": ["grafana", "grafana可视化", "监控可视化"],
    "ELK": ["elk", "elastic stack", "日志分析"],
    "Agile": ["agile", "敏捷", "敏捷开发", "scrum", "敏捷方法"],
    "Scrum": ["scrum", "scrum敏捷", "迭代开发"],
    "JIRA": ["jira", "jira项目管理", "项目跟踪"],
    "Confluence": ["confluence", "confluence文档", "知识库"],
    "PMP": ["pmp", "pmp认证", "项目管理专业人士", "项目经理认证"],
    "CI/CD": ["ci/cd", "持续集成", "持续交付", "devops ci cd"],
    "DevOps": ["devops", "运维开发", "devops实践"],
    "SRE": ["sre", "site reliability", "网站可靠性工程"],
    "Data Analysis": ["数据分析", "data analysis", "数据分析工作"],
    "Data Mining": ["数据挖掘", "data mining", "挖掘分析"],
    "Algorithm": ["算法", "algorithm", "算法设计"],
    "System Design": ["系统设计", "system design", "架构设计"],
    "Microservices": ["微服务", "microservices", "微服务架构"],
    "Distributed Systems": ["分布式系统", "distributed systems", "分布式"],
    "Communication": ["沟通", "communication", "沟通能力", "表达能力"],
    "Teamwork": ["团队合作", "teamwork", "团队协作"],
    "Problem Solving": ["问题解决", "problem solving", "解决问题"],
    "Leadership": ["领导力", "leadership", "团队管理"],
    "Critical Thinking": ["批判性思维", "critical thinking", "逻辑思维"],
    "Time Management": ["时间管理", "time management", "效率"],
}

if TYPE_CHECKING:
    from app.models.skill_dictionary import SkillDictionary
    import asyncio


def normalize(skill_text: str, threshold: float = 0.85) -> str:
    """Normalize a skill name to its canonical form.

    Lookup order:
    1. Exact match (case-insensitive)
    2. Synonym match
    3. Vector similarity (if DB available)

    Args:
        skill_text: Input skill name
        threshold: Minimum similarity score for vector match (default: 0.85)

    Returns:
        Canonical skill name
    """
    skill_lower = skill_text.lower().strip()

    # 1. Check if it's a canonical form
    if skill_lower in [s.lower() for s in SKILL_SYNONYMS.keys()]:
        for canonical in SKILL_SYNONYMS.keys():
            if skill_lower == canonical.lower():
                return canonical

    # 2. Check synonyms
    for canonical, synonyms in SKILL_SYNONYMS.items():
        if skill_lower in [s.lower() for s in synonyms]:
            return canonical

    # 3. Try vector similarity if DB is available
    try:
        from sqlalchemy import select, text

        async def _vector_match():
            from app.database import async_session_factory

            async with async_session_factory() as session:
                # Check if skill_dictionary table has data with vectors
                result = await session.execute(
                    text("SELECT COUNT(*) FROM skill_dictionary WHERE embedding IS NOT NULL")
                )
                count = result.scalar() or 0

                if count == 0:
                    return None

                # Generate embedding for input
                from app.ai.embedding import embedding
                emb = await embedding.embed(f"Skill: {skill_text}")

                # Query similar skills (using float[] type)
                result = await session.execute(
                    text("""
                        SELECT canonical_name,
                               1 - (embedding <=> :query_vector::float[]) as similarity
                        FROM skill_dictionary
                        WHERE embedding IS NOT NULL
                        ORDER BY embedding <=> :query_vector::float[]
                        LIMIT 1
                    """),
                    {"query_vector": emb}
                )
                row = result.fetchone()

                if row and row.similarity >= threshold:
                    return row.canonical_name

                return None

        # Note: This is a simplified sync wrapper
        # In production, you'd call this from an async context
        import asyncio
        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(_vector_match())
            if result:
                return result
        finally:
            loop.close()

    except Exception:
        # DB not available or other error, skip vector matching
        pass

    # Fallback: title case the input
    return skill_text.title()


def normalize_batch(skill_list: list[str], threshold: float = 0.85) -> list[str]:
    """Normalize a list of skills.

    Args:
        skill_list: List of skill names
        threshold: Minimum similarity score for vector match

    Returns:
        List of normalized skill names (deduplicated)
    """
    normalized = set()
    for skill in skill_list:
        if skill and skill.strip():
            normalized.add(normalize(skill.strip(), threshold))

    return sorted(list(normalized))


def get_skill_synonyms(skill: str) -> list[str]:
    """Get all synonyms for a skill.

    Args:
        skill: Skill name

    Returns:
        List of all known synonyms including the canonical form
    """
    skill_lower = skill.lower().strip()

    for canonical, synonyms in SKILL_SYNONYMS.items():
        if skill_lower in [s.lower() for s in synonyms]:
            return [canonical] + synonyms

    return [skill]


def get_skill_info(skill: str) -> dict[str, Any]:
    """Get detailed info for a skill from the dictionary.

    Args:
        skill: Skill name

    Returns:
        Dict with skill info or empty dict if not found
    """
    try:
        from sqlalchemy import select, text
        import asyncio

        async def _get_info():
            from app.database import async_session_factory

            async with async_session_factory() as session:
                # Try exact match first
                result = await session.execute(
                    select(SkillDictionary).where(
                        SkillDictionary.canonical_name.ilike(skill)
                    )
                )
                skill_obj = result.scalar_one_or_none()

                if skill_obj:
                    return {
                        "id": str(skill_obj.id),
                        "canonical_name": skill_obj.canonical_name,
                        "category": skill_obj.category,
                        "domain": skill_obj.domain,
                        "aliases": skill_obj.aliases_json,
                    }

                # Try synonym match
                for canonical, synonyms in SKILL_SYNONYMS.items():
                    if skill.lower() in [s.lower() for s in synonyms]:
                        result = await session.execute(
                            select(SkillDictionary).where(
                                SkillDictionary.canonical_name == canonical
                            )
                        )
                        skill_obj = result.scalar_one_or_none()
                        if skill_obj:
                            return {
                                "id": str(skill_obj.id),
                                "canonical_name": skill_obj.canonical_name,
                                "category": skill_obj.category,
                                "domain": skill_obj.domain,
                                "aliases": skill_obj.aliases_json,
                            }

                return {}

        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_get_info())
        finally:
            loop.close()

    except Exception:
        return {}
