#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
批量生成缺失的岗位画像
用法：
    python generate_missing_profiles.py              # 批量处理全部缺失 role
    python generate_missing_profiles.py --role "测试"  # 处理单个 role
"""

import asyncio
import argparse
import json
import statistics
import sys
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

import asyncpg
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ai.llm_provider import LLMProvider


# JSON Schema 定义
PROFILE_SCHEMA = {
    "type": "object",
    "required": ["role_name", "summary", "basic_requirements", "technical_skills", "soft_skills", "development_potential", "salary_range", "evidence_summary"],
    "properties": {
        "role_name": {"type": "string"},
        "summary": {"type": "string", "description": "岗位一句话描述，50字以内"},
        "basic_requirements": {
            "type": "object",
            "required": ["education", "majors", "experience_years", "certifications"],
            "properties": {
                "education": {
                    "type": "string",
                    "enum": ["大专及以上", "本科及以上", "硕士及以上", "博士及以上", "不限"]
                },
                "majors": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "相关专业列表"
                },
                "experience_years": {
                    "type": "object",
                    "properties": {
                        "min": {"type": "number"},
                        "preferred": {"type": "number"}
                    }
                },
                "certifications": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "required": {"type": "boolean"}
                        }
                    }
                }
            }
        },
        "technical_skills": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["name", "importance", "frequency_pct"],
                "properties": {
                    "name": {"type": "string"},
                    "category": {"type": "string"},
                    "importance": {"type": "string", "enum": ["必备", "加分", "了解即可"]},
                    "frequency_pct": {"type": "number", "minimum": 0, "maximum": 100}
                }
            }
        },
        "soft_skills": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["name", "importance"],
                "properties": {
                    "name": {"type": "string"},
                    "importance": {"type": "string", "enum": ["核心素养", "重要", "一般"]},
                    "evidence": {"type": "string"}
                }
            }
        },
        "development_potential": {
            "type": "object",
            "properties": {
                "growth_indicators": {"type": "array", "items": {"type": "string"}},
                "learning_requirements": {"type": "array", "items": {"type": "string"}},
                "innovation_signals": {"type": "array", "items": {"type": "string"}}
            }
        },
        "salary_range": {
            "type": "object",
            "properties": {
                "entry_level": {"type": "string"},
                "experienced": {"type": "string"},
                "senior": {"type": "string"}
            }
        },
        "evidence_summary": {"type": "string"}
    }
}

SYSTEM_PROMPT = """你是一个职业数据分析专家。根据提供的岗位招聘数据，生成标准化的岗位画像JSON。
要求：
1. 必须严格输出符合给定 JSON Schema 的结构，不输出任何额外文字
2. 所有技能名称使用中文，英文缩写保留（如 Python、SQL、Vue.js）
3. 每个字段必须有 evidence 来源依据
4. 不得编造在 JD 样本中未出现的技能或要求"""


async def get_db_connection():
    """获取数据库连接"""
    return await asyncpg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5433)),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        database=os.getenv("DB_NAME", "career_planning")
    )


async def get_missing_roles(conn, specific_role: Optional[str] = None) -> List[Dict]:
    """获取缺失画像的 roles"""
    if specific_role:
        result = await conn.fetch("""
            SELECT r.id, r.name, r.category, r.level
            FROM roles r
            WHERE r.name = $1
        """, specific_role)
    else:
        result = await conn.fetch("""
            SELECT r.id, r.name, r.category, r.level
            FROM roles r
            LEFT JOIN job_profiles jp ON jp.role_id = r.id
            WHERE jp.id IS NULL
            ORDER BY r.category, r.name
        """)
    return result


async def get_jds_for_role(conn, role_name: str, limit: int = 30) -> List[Dict]:
    """获取该 role 的 JD 数据"""
    jds = await conn.fetch("""
        SELECT id, description, salary_min, salary_max, city, company_name
        FROM jobs
        WHERE role = $1 AND description IS NOT NULL AND length(description) > 50
        ORDER BY salary_min NULLS LAST
        LIMIT $2
    """, role_name, limit)
    return jds


def extract_keywords(descriptions: List[str], top_n: int = 20) -> List[str]:
    """简单的关键词提取（基于常见技能词）"""
    import re

    # 常见技能关键词
    skill_keywords = [
        # 编程语言
        "python", "java", "javascript", "typescript", "c++", "c#", "go", "golang", "rust",
        "php", "ruby", "swift", "kotlin", "scala", "r", "matlab",
        # 前端
        "html", "css", "vue", "react", "angular", "jquery", "bootstrap", "webpack", "node.js",
        "nodejs", "前端", "前端开发", "ui",
        # 后端/服务端
        "spring", "django", "flask", "fastapi", "express", "springboot", "mybatis",
        "后端", "服务端", "后端开发", "api", "rest", "grpc",
        # 数据库
        "mysql", "redis", "mongodb", "oracle", "postgresql", "sql", "nosql", "elasticsearch",
        "数据库", "sqlserver", "db",
        # 数据
        "hadoop", "spark", "hive", "kafka", "flink", "etl", "数据仓库", "大数据",
        "数据分析", "数据挖掘", "机器学习", "深度学习", "人工智能", "ai",
        # 云/运维
        "aws", "azure", "gcp", "阿里云", "腾讯云", "华为云", "docker", "kubernetes", "k8s",
        "linux", "nginx", "tomcat", "devops", "ci/cd", "jenkins",
        # 测试
        "selenium", "junit", "pytest", "jmeter", "test", "测试", "功能测试", "自动化测试",
        # 产品/设计
        "产品经理", "产品", "需求分析", "axure", "Sketch", "figma", "原型设计", "ui设计", "ue",
        "photoshop", "illustrator",
        # 管理/其他
        "项目管理", "敏捷", "scrum", "jira", "git", "svn", "版本控制", "英语", "雅思", "托福",
        "沟通能力", "团队协作", "领导力", "ppt", "word", "excel"
    ]

    # 统计词频
    word_count = {}
    for desc in descriptions:
        if not desc:
            continue
        desc_lower = desc.lower()
        for keyword in skill_keywords:
            if keyword.lower() in desc_lower:
                word_count[keyword] = word_count.get(keyword, 0) + 1

    # 排序返回 top_n
    sorted_words = sorted(word_count.items(), key=lambda x: x[1], reverse=True)
    return [w[0] for w in sorted_words[:top_n]]


def sample_representative(jds: List[Dict], n: int = 5) -> List[Dict]:
    """按薪资区间抽样代表性 JD"""
    if len(jds) <= n:
        return jds

    # 分成低/中/高三档
    salaries = [j['salary_min'] for j in jds if j['salary_min']]
    if not salaries:
        return jds[:n]

    sorted_jds = sorted(jds, key=lambda x: x['salary_min'] or 0)
    total = len(sorted_jds)

    # 每档各取一些
    samples = []
    samples.append(sorted_jds[0])  # 最低薪
    if total > 2:
        samples.append(sorted_jds[total // 2])  # 中间
    if total > 1:
        samples.append(sorted_jds[-1])  # 最高薪

    # 补齐剩余
    remaining = n - len(samples)
    if remaining > 0:
        for jd in sorted_jds:
            if jd not in samples:
                samples.append(jd)
                remaining -= 1
                if remaining <= 0:
                    break

    return samples[:n]


async def generate_profile(
    llm: LLMProvider,
    role_name: str,
    jds: List[Dict],
    salary_stats: Dict,
    skill_anchors: List[str]
) -> Optional[Dict]:
    """调用 LLM 生成岗位画像"""

    # 准备代表性 JD
    representative_jds = sample_representative(jds, n=5)
    jd_texts = []
    for jd in representative_jds:
        desc = jd.get('description', '')[:800]  # 截断过长描述
        city = jd.get('city', '未知')
        company = jd.get('company_name', '未知公司')
        salary = f"{jd.get('salary_min', '未知')}-{jd.get('salary_max', '未知')}"
        jd_texts.append(f"【公司】{company} | 【城市】{city} | 【薪资】{salary}元/月\n【JD】{desc}")

    user_prompt = f"""岗位名称：{role_name}
JD样本数量：{len(jds)} 条
薪资区间：{salary_stats.get('min', '未知')}~{salary_stats.get('max', '未知')} 元/月，中位数 {salary_stats.get('median', '未知')}
高频关键词统计：{', '.join(skill_anchors) if skill_anchors else '无'}

代表性JD原文：
{chr(10).join(jd_texts)}

请生成该岗位的标准化画像，输出格式严格遵循以下 JSON Schema。"""

    try:
        result = await llm.generate_json(
            prompt=user_prompt,
            system_prompt=SYSTEM_PROMPT,
            json_schema=PROFILE_SCHEMA,
            temperature=0.3
        )
        return result
    except Exception as e:
        print(f"  [ERROR] LLM 调用失败: {e}")
        return None


async def save_profile(conn, role_id: str, profile: Dict) -> Optional[str]:
    """保存岗位画像到数据库"""
    try:
        now = datetime.now()
        result = await conn.fetchrow("""
            INSERT INTO job_profiles (id, role_id, profile_json, version, created_at, updated_at)
            VALUES ($1, $2, $3, 1, $4, $4)
            RETURNING id
        """, str(uuid.uuid4()), role_id, json.dumps(profile, ensure_ascii=False), now)
        return result['id'] if result else None
    except Exception as e:
        print(f"  [ERROR] 保存失败: {e}")
        return None


async def process_role(conn, llm, role: Dict) -> bool:
    """处理单个 role"""
    role_id = role['id']
    role_name = role['name']
    category = role['category']
    level = role['level']

    print(f"\n处理: {role_name} (category={category}, level={level})")

    # 获取 JD 数据
    jds = await get_jds_for_role(conn, role_name)

    if len(jds) < 5:
        print(f"  [WARN] JD 样本不足 {len(jds)} 条，跳过")
        return False

    # 提取关键词
    descriptions = [jd['description'] for jd in jds if jd.get('description')]
    skill_anchors = extract_keywords(descriptions)

    # 计算薪资统计
    salaries = [jd['salary_min'] for jd in jds if jd['salary_min']]
    salary_stats = {}
    if salaries:
        salary_stats = {
            'min': min(salaries),
            'max': max(salaries),
            'median': statistics.median(salaries)
        }

    # 生成画像
    profile = await generate_profile(llm, role_name, jds, salary_stats, skill_anchors)

    if not profile:
        print(f"  [FAIL] {role_name} → LLM 生成失败")
        return False

    # 补充 evidence_summary
    if len(jds) < 10:
        profile['evidence_summary'] = f"本画像基于 {len(jds)} 条 JD 样本生成，样本较少，画像可信度有限。"
    else:
        profile['evidence_summary'] = f"本画像基于 {len(jds)} 条 JD 样本生成，高频技能包括：{', '.join(skill_anchors[:5])}。"

    # 保存到数据库
    profile_id = await save_profile(conn, role_id, profile)

    if profile_id:
        print(f"  [OK] {role_name} → profile_id={profile_id}")
        return True
    else:
        print(f"  [FAIL] {role_name} → 保存失败")
        return False


async def main():
    parser = argparse.ArgumentParser(description="批量生成缺失的岗位画像")
    parser.add_argument('--role', type=str, help='指定单个 role 名称')
    args = parser.parse_args()

    # 获取数据库连接
    conn = await get_db_connection()

    # 初始化 LLM
    llm = LLMProvider()

    # 获取缺失画像的 roles
    roles = await get_missing_roles(conn, args.role)

    if not roles:
        print("没有缺失画像的 role")
        await conn.close()
        return

    print(f"找到 {len(roles)} 个缺失画像的 role")

    success_count = 0
    fail_count = 0

    for role in roles:
        ok = await process_role(conn, llm, role)
        if ok:
            success_count += 1
        else:
            fail_count += 1

        # 避免触发 LLM 限流
        await asyncio.sleep(1)

    await conn.close()

    print(f"\n完成！成功: {success_count}, 失败: {fail_count}")


if __name__ == "__main__":
    asyncio.run(main())
