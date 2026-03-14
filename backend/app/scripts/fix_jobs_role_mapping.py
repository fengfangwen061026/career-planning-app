#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
修复 jobs.role 字段映射 + 补充导入缺失 JD
按步骤自动执行并验收
"""
import asyncio
import argparse
import json
import os
import re
import sys
import uuid
import xlrd
import statistics
from datetime import datetime
from typing import List, Dict, Any, Optional

import asyncpg
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ai.llm_provider import LLMProvider


# ============== 映射定义 ==============

# Excel 原始岗位名称 → roles.name 标准名称
ROLE_MAPPING = {
    'Java': '后端开发',
    'C/C++': '后端开发',
    '技术支持工程师': '实施工程师',
    '测试工程师': '软件测试',
    '硬件测试': '软件测试',
    '质量管理/测试': '质检',
    '质检员': '质检',
    '风电工程师': '新能源工程师',
    '总助/CEO助理/董事长助理': '行政/助理',
    '档案管理': '行政/助理',
    '资料管理': '行政/助理',
    '招聘专员/助理': '人力资源',
    '培训师': '人力资源',
    '运营助理/专员': '运营',
    '社区运营': '运营',
    '游戏运营': '运营',
    '销售运营': '运营',
    'APP推广': '推广专员',
    '游戏推广': '推广专员',
    '英语翻译': '翻译',
    '日语翻译': '翻译',
    '网络销售': '销售',
    '电话销售': '销售',
    '广告销售': '销售',
    '销售助理': '销售',
    '销售工程师': '销售',
    '大客户代表': '销售',
    'BD经理': '商务拓展',
    '商务专员': '商务拓展',
    '管培生/储备干部': '管培生',
    '储备经理人': '管培生',
    '储备干部': '管培生',
    '咨询顾问': '咨询顾问',
    '知识产权/专利代理': '法务',
    '法务专员/助理': '法务',
    '律师': '法务',
    '律师助理': '法务',
    '售后客服': '客服',
    '网络客服': '客服',
    '电话客服': '客服',
    '项目专员/助理': '项目管理',
    '项目经理/主管': '项目管理',
    '项目招投标': '项目管理',
    '产品专员/助理': '产品经理',
    '猎头顾问': 'HR',
    '统计员': '科研人员',
}

# jobs 表现有非标准 role → roles.name 标准名称
JOBS_ROLE_FIX = {
    '软件开发': '后端开发',
    'Java开发': '后端开发',
    '测试': '软件测试',
    '质量保障': '质检',
    '招聘专员': '人力资源',
}

# UI设计的处理规则
UI_DESIGN_THRESHOLD = 50
UI_DESIGN_NEW_ROLE = {'name': 'UI设计', 'category': '产品类', 'level': 'growing'}
UI_DESIGN_FALLBACK = '产品经理'

# 需要重新生成画像的 role 列表
FORCE_REGENERATE_ROLES = [
    '咨询顾问', '新能源工程师', '翻译', '管培生',
    '行政/助理', '质检', '后端开发',
]

# 画像生成 JSON Schema
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
                "education": {"type": "string", "enum": ["大专及以上", "本科及以上", "硕士及以上", "博士及以上", "不限"]},
                "majors": {"type": "array", "items": {"type": "string"}},
                "experience_years": {"type": "object", "properties": {"min": {"type": "number"}, "preferred": {"type": "number"}}},
                "certifications": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string"}, "required": {"type": "boolean"}}}}
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


# ============== 工具函数 ==============

async def get_db_connection():
    """获取数据库连接"""
    return await asyncpg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5433)),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        database=os.getenv("DB_NAME", "career_planning")
    )


def parse_salary(salary_str: str) -> tuple[int | None, int | None, int]:
    """解析薪资字符串，返回 (min, max, months)"""
    if not salary_str:
        return None, None, 12

    salary_str = salary_str.strip()
    months = 12

    # 处理 N薪 格式
    months_match = re.search(r"(\d+)薪", salary_str)
    if months_match:
        months = int(months_match.group(1))
        salary_str = re.sub(r"·?\d+薪", "", salary_str)

    # 去除单位
    salary_str = re.sub(r"元/天|元|·", "", salary_str)

    # 统一单位：转换为元/月
    if "万" in salary_str:
        match = re.search(r"([\d.]+)-([\d.]+)万", salary_str)
        if match:
            return int(float(match.group(1)) * 10000), int(float(match.group(2)) * 10000), months
    else:
        match = re.search(r"(\d+)-(\d+)", salary_str)
        if match:
            return int(match.group(1)), int(match.group(2)), months
        match = re.search(r"(\d+)-(\d+)元/天", salary_str)
        if match:
            return int(match.group(1)) * 22, int(match.group(2)) * 22, months

    return None, None, months


def parse_address(address: str) -> tuple[str, str | None]:
    """解析地址字符串，返回 (city, district)"""
    if not address:
        return "", None

    parts = address.split("-")
    city = parts[0] if parts else ""
    district = parts[1] if len(parts) > 1 else None
    if district and (district.lower() == "none" or district == ""):
        district = None

    return city, district


def clean_description(description) -> str:
    """清洗岗位详情，去除 HTML 标签"""
    if not description or not isinstance(description, str):
        return ""
    description = re.sub(r"<br\s*/?>", "\n", description, flags=re.IGNORECASE)
    description = re.sub(r"<[^>]+>", "", description)
    description = re.sub(r"\n{3,}", "\n\n", description)
    return description.strip()


# ============== 步骤执行函数 ==============

async def step1_validate_mapping(conn) -> bool:
    """步骤1：验证映射表"""
    print("\n" + "=" * 50)
    print("步骤1：验证映射表")
    print("=" * 50)

    # 获取 roles 表中所有标准名称
    known_roles = set()
    result = await conn.fetch("SELECT name FROM roles")
    for r in result:
        known_roles.add(r['name'])

    print(f"已知 roles 数量: {len(known_roles)}")

    # 检查映射目标值是否都存在于 roles.name 中
    all_mappings = set(ROLE_MAPPING.values()) | set(JOBS_ROLE_FIX.values())
    invalid_targets = [v for v in all_mappings if v not in known_roles]

    if invalid_targets:
        print(f"[FAIL] 步骤1：映射目标不存在于 roles 表: {invalid_targets}")
        return False

    # 检查 Excel 岗位名称是否都被覆盖
    excel_path = os.getenv("EXCEL_PATH", "D:/Users/ffw/Desktop/a13/程序/a13基于AI的大学生职业规划智能体-JD采样数据.xls")
    wb = xlrd.open_workbook(excel_path)
    ws = wb.sheet_by_index(0)

    excel_names = set()
    for r in range(1, ws.nrows):
        title = str(ws.cell_value(r, 0)).strip()
        excel_names.add(title)

    # 直接同名或通过映射覆盖
    covered = set(ROLE_MAPPING.keys()) | known_roles
    uncovered = excel_names - covered

    if uncovered:
        print(f"[WARN] 以下 Excel 岗位名称未被覆盖（将被跳过）: {uncovered}")

    print("[PASS] 步骤1：映射表验收通过")
    return True


async def step2_handle_ui_design(conn) -> bool:
    """步骤2：处理 UI设计 归属"""
    print("\n" + "=" * 50)
    print("步骤2：处理 UI设计 归属")
    print("=" * 50)

    # 检查 UI设计在 jobs 表中的数量
    ui_count = await conn.fetchval(
        "SELECT COUNT(*) FROM jobs WHERE title = 'UI设计' OR role = 'UI设计'"
    )
    print(f"UI设计 JD 数量: {ui_count}")

    if ui_count >= UI_DESIGN_THRESHOLD:
        # 检查是否已存在
        existing = await conn.fetchval("SELECT COUNT(*) FROM roles WHERE name = 'UI设计'")
        if existing == 0:
            await conn.execute("""
                INSERT INTO roles (id, name, category, level, description, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            """, str(uuid.uuid4()), UI_DESIGN_NEW_ROLE['name'], UI_DESIGN_NEW_ROLE['category'],
                UI_DESIGN_NEW_ROLE['level'], '', datetime.now(), datetime.now())
            print(f"[AUTO] 新增 role: UI设计（产品类/growing），因 JD 数量={ui_count} >= {UI_DESIGN_THRESHOLD}")
        else:
            print(f"[SKIP] UI设计 role 已存在")
    else:
        # 归入产品经理 - 需要先确保 jobs 表中没有 UI设计 的 role
        await conn.execute("UPDATE jobs SET role = $1 WHERE role = 'UI设计'", UI_DESIGN_FALLBACK)
        print(f"[AUTO] UI设计({ui_count}条) 归入 {UI_DESIGN_FALLBACK}，因数量 < {UI_DESIGN_THRESHOLD}")

    # 验收
    ui_in_jobs = await conn.fetchval("SELECT COUNT(*) FROM jobs WHERE role = 'UI设计'")
    ui_in_roles = await conn.fetchval("SELECT COUNT(*) FROM roles WHERE name = 'UI设计'")

    if ui_in_jobs > 0 and ui_in_roles == 0:
        print(f"[FAIL] 步骤2：jobs 表中有 {ui_in_jobs} 条 UI设计 记录但 roles 表无对应 role")
        return False

    print("[PASS] 步骤2：UI设计处理验收通过")
    return True


async def step3_fix_jobs_role(conn) -> bool:
    """步骤3：修正 jobs 表已有记录的 role 字段"""
    print("\n" + "=" * 50)
    print("步骤3：修正 jobs 表 role 字段")
    print("=" * 50)

    total_fixed = 0
    for old_name, new_name in JOBS_ROLE_FIX.items():
        cnt = await conn.fetchval(
            "SELECT COUNT(*) FROM jobs WHERE role = $1",
            old_name
        )
        if cnt > 0:
            await conn.execute(
                "UPDATE jobs SET role = $1 WHERE role = $2",
                new_name, old_name
            )
            print(f"  {old_name} → {new_name}: {cnt} 条")
            total_fixed += cnt

    print(f"[INFO] 步骤3：共修正 {total_fixed} 条 jobs 记录")

    # 验收
    remaining = []
    for old_name in JOBS_ROLE_FIX.keys():
        cnt = await conn.fetchval("SELECT COUNT(*) FROM jobs WHERE role = $1", old_name)
        if cnt > 0:
            remaining.append((old_name, cnt))

    if remaining:
        print(f"[FAIL] 步骤3：以下旧 role 名称仍有残留记录: {remaining}")
        return False

    print("[PASS] 步骤3：jobs.role 修正验收通过")
    return True


async def step4_import_missing_jds(conn, excel_path: str) -> bool:
    """步骤4：导入缺失的 JD 记录"""
    print("\n" + "=" * 50)
    print("步骤4：导入缺失的 JD 记录")
    print("=" * 50)

    # 记录导入前的 jobs 数量
    jobs_before = await conn.fetchval("SELECT COUNT(*) FROM jobs")
    print(f"导入前 jobs 记录数: {jobs_before}")

    # 获取已入库的 job_code 集合
    existing_codes = set()
    result = await conn.fetch("SELECT job_code FROM jobs WHERE job_code IS NOT NULL")
    for r in result:
        existing_codes.add(r['job_code'])
    print(f"已存在的 job_code 数量: {len(existing_codes)}")

    # 获取合法 role 名称集合
    known_roles = set()
    result = await conn.fetch("SELECT name FROM roles")
    for r in result:
        known_roles.add(r['name'])
    print(f"合法的 role 数量: {len(known_roles)}")

    # 读取 Excel
    wb = xlrd.open_workbook(excel_path)
    ws = wb.sheet_by_index(0)

    stats = {'imported': 0, 'skipped_exists': 0, 'skipped_no_role': 0, 'skipped_no_code': 0}

    jobs_to_insert = []
    for r in range(1, ws.nrows):
        row = ws.row_values(r)

        raw_name = str(row[0]).strip()
        job_code = str(row[7]).strip()
        address = str(row[1]).strip()
        salary_str = str(row[2]).strip()
        company_name = str(row[3]).strip()
        industries = str(row[4]).strip()
        company_size = str(row[5]).strip()
        company_stage = str(row[6]).strip()
        description = str(row[8]).strip()
        source_url = str(row[11]).strip()

        if not job_code:
            stats['skipped_no_code'] += 1
            continue

        if job_code in existing_codes:
            stats['skipped_exists'] += 1
            continue

        # 归一化 role
        normalized_role = ROLE_MAPPING.get(raw_name) or (raw_name if raw_name in known_roles else None)
        if not normalized_role:
            stats['skipped_no_role'] += 1
            continue

        # 解析薪资
        salary_min, salary_max, salary_months = parse_salary(salary_str)

        # 解析地址
        city, district = parse_address(address)

        # 清洗行业 (转为列表，因为数据库是 ARRAY 类型)
        if industries:
            items = [i.strip() for i in industries.split(",")]
            unique_items = list(dict.fromkeys(items))
            industries = [i for i in unique_items if i]
        else:
            industries = []

        # 清洗描述
        description = clean_description(description)

        job_id = str(uuid.uuid4())
        now = datetime.now()

        jobs_to_insert.append({
            'id': job_id,
            'job_code': job_code,
            'title': raw_name,
            'role': normalized_role,
            'city': city,
            'district': district,
            'salary_min': salary_min,
            'salary_max': salary_max,
            'salary_months': salary_months,
            'company_name': company_name,
            'industries': industries,
            'company_size': company_size,
            'company_stage': company_stage,
            'description': description,
            'source_url': source_url,
            'created_at': now,
            'updated_at': now,
        })

        existing_codes.add(job_code)
        stats['imported'] += 1

        # 每 100 条提交一次
        if len(jobs_to_insert) >= 100:
            for job in jobs_to_insert:
                await conn.execute("""
                    INSERT INTO jobs (id, job_code, title, role, city, district, salary_min, salary_max,
                                     salary_months, company_name, industries, company_size, company_stage,
                                     description, source_url, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                """, job['id'], job['job_code'], job['title'], job['role'], job['city'],
                    job['district'], job['salary_min'], job['salary_max'], job['salary_months'],
                    job['company_name'], job['industries'], job['company_size'], job['company_stage'],
                    job['description'], job['source_url'], job['created_at'], job['updated_at'])
            print(f"  已导入 {stats['imported']} 条...")
            jobs_to_insert = []

    # 提交剩余的记录
    if jobs_to_insert:
        for job in jobs_to_insert:
            await conn.execute("""
                INSERT INTO jobs (id, job_code, title, role, city, district, salary_min, salary_max,
                                 salary_months, company_name, industries, company_size, company_stage,
                                 description, source_url, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            """, job['id'], job['job_code'], job['title'], job['role'], job['city'],
                job['district'], job['salary_min'], job['salary_max'], job['salary_months'],
                job['company_name'], job['industries'], job['company_size'], job['company_stage'],
                job['description'], job['source_url'], job['created_at'], job['updated_at'])

    print(f"\n导入统计: {stats}")

    # 验收
    jobs_after = await conn.fetchval("SELECT COUNT(*) FROM jobs")
    print(f"导入后 jobs 记录数: {jobs_before} → {jobs_after}")

    # 如果有实际导入的新记录，才验证数量增加
    if stats['imported'] > 0 and jobs_after <= jobs_before:
        print(f"[FAIL] 步骤4：导入后记录数未增加")
        return False

    # 检查必须有的 role
    must_have_data = ['咨询顾问', '新能源工程师', '翻译', '管培生', '行政/助理', '质检']
    for role_name in must_have_data:
        cnt = await conn.fetchval("SELECT COUNT(*) FROM jobs WHERE role = $1", role_name)
        print(f"  {role_name}: {cnt} 条")
        if cnt == 0:
            print(f"[FAIL] 步骤4：{role_name} 导入后仍为 0 条")
            return False

    print("[PASS] 步骤4：JD 导入验收通过")
    return True


async def step5_regenerate_profiles(conn, llm) -> bool:
    """步骤5：重新生成受影响 role 的岗位画像"""
    print("\n" + "=" * 50)
    print("步骤5：重新生成岗位画像")
    print("=" * 50)

    script_start_time = datetime.now()

    # 获取 JDs 的函数
    async def get_jds_for_role(role_name: str, limit: int = 30):
        return await conn.fetch("""
            SELECT id, description, salary_min, salary_max, city, company_name
            FROM jobs
            WHERE role = $1 AND description IS NOT NULL AND length(description) > 50
            ORDER BY salary_min NULLS LAST
            LIMIT $2
        """, role_name, limit)

    # 提取关键词
    def extract_keywords(descriptions: List[str], top_n: int = 20):
        skill_keywords = [
            "python", "java", "javascript", "typescript", "c++", "c#", "go", "golang", "rust",
            "php", "ruby", "swift", "kotlin", "scala", "r", "matlab",
            "html", "css", "vue", "react", "angular", "jquery", "bootstrap", "webpack", "node.js", "nodejs",
            "spring", "django", "flask", "fastapi", "express", "springboot", "mybatis",
            "mysql", "redis", "mongodb", "oracle", "postgresql", "sql", "nosql", "elasticsearch",
            "hadoop", "spark", "hive", "kafka", "flink", "etl", "数据仓库", "大数据",
            "数据分析", "数据挖掘", "机器学习", "深度学习", "人工智能", "ai",
            "aws", "azure", "gcp", "阿里云", "腾讯云", "华为云", "docker", "kubernetes", "k8s",
            "linux", "nginx", "tomcat", "devops", "ci/cd", "jenkins",
            "selenium", "junit", "pytest", "jmeter", "测试", "功能测试", "自动化测试",
            "产品经理", "需求分析", "axure", "Sketch", "figma", "原型设计", "ui设计",
            "项目管理", "敏捷", "scrum", "jira", "git", "svn", "版本控制", "沟通能力", "团队协作"
        ]

        word_count = {}
        for desc in descriptions:
            if not desc:
                continue
            desc_lower = desc.lower()
            for keyword in skill_keywords:
                if keyword.lower() in desc_lower:
                    word_count[keyword] = word_count.get(keyword, 0) + 1

        sorted_words = sorted(word_count.items(), key=lambda x: x[1], reverse=True)
        return [w[0] for w in sorted_words[:top_n]]

    # 抽样代表性 JD
    def sample_representative(jds: List[Dict], n: int = 5):
        if len(jds) <= n:
            return jds

        salaries = [j['salary_min'] for j in jds if j['salary_min']]
        if not salaries:
            return jds[:n]

        sorted_jds = sorted(jds, key=lambda x: x['salary_min'] or 0)
        total = len(sorted_jds)

        samples = [sorted_jds[0]]
        if total > 2:
            samples.append(sorted_jds[total // 2])
        if total > 1:
            samples.append(sorted_jds[-1])

        remaining = n - len(samples)
        if remaining > 0:
            for jd in sorted_jds:
                if jd not in samples:
                    samples.append(jd)
                    remaining -= 1
                    if remaining <= 0:
                        break

        return samples[:n]

    # 生成画像
    async def generate_profile(role_name: str, jds: List[Dict], salary_stats: Dict, skill_anchors: List[str]):
        representative_jds = sample_representative(jds, n=5)
        jd_texts = []
        for jd in representative_jds:
            desc = jd.get('description', '')[:800]
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

    success_count = 0
    fail_count = 0

    for role_name in FORCE_REGENERATE_ROLES:
        print(f"\n处理: {role_name}")

        # 获取 role id
        role_record = await conn.fetchrow("SELECT id FROM roles WHERE name = $1", role_name)
        if not role_record:
            print(f"  [SKIP] role 不存在")
            fail_count += 1
            continue

        role_id = role_record['id']

        # 获取 JD 数据
        jds = await get_jds_for_role(role_name)

        if len(jds) < 5:
            print(f"  [WARN] JD 样本不足 {len(jds)} 条，跳过")
            fail_count += 1
            continue

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
        profile = await generate_profile(role_name, jds, salary_stats, skill_anchors)

        if not profile:
            print(f"  [FAIL] {role_name} → LLM 生成失败")
            fail_count += 1
            continue

        # 补充 evidence_summary
        if len(jds) < 10:
            profile['evidence_summary'] = f"本画像基于 {len(jds)} 条 JD 样本生成，样本较少，画像可信度有限。"
        else:
            profile['evidence_summary'] = f"本画像基于 {len(jds)} 条 JD 样本生成，高频技能包括：{', '.join(skill_anchors[:5])}。"

        # 删除旧画像
        await conn.execute("DELETE FROM job_profiles WHERE role_id = $1", role_id)

        # 保存新画像
        now = datetime.now()
        result = await conn.fetchrow("""
            INSERT INTO job_profiles (id, role_id, profile_json, version, created_at, updated_at)
            VALUES ($1, $2, $3, 1, $4, $5)
            RETURNING id
        """, str(uuid.uuid4()), role_id, json.dumps(profile, ensure_ascii=False), now, now)

        if result:
            print(f"  [OK] {role_name} → profile_id={result['id']}")
            success_count += 1
        else:
            print(f"  [FAIL] {role_name} → 保存失败")
            fail_count += 1

        # 避免 LLM 限流
        await asyncio.sleep(1)

    print(f"\n画像生成完成：成功 {success_count}, 失败 {fail_count}")

    # 验收
    failed = []
    for role_name in FORCE_REGENERATE_ROLES:
        role = await conn.fetchrow("SELECT id FROM roles WHERE name = $1", role_name)
        if not role:
            failed.append(f"{role_name}(role不存在)")
            continue

        profile = await conn.fetchrow("SELECT updated_at FROM job_profiles WHERE role_id = $1", role['id'])
        if not profile:
            failed.append(f"{role_name}(无画像)")
        elif profile['updated_at'] < script_start_time:
            failed.append(f"{role_name}(画像未更新)")

    if failed:
        print(f"[FAIL] 步骤5：以下 role 画像生成失败: {failed}")
        return False

    print("[PASS] 步骤5：画像重新生成验收通过")
    return True


async def step6_final_validation(conn) -> bool:
    """步骤6：最终全局验收"""
    print("\n" + "=" * 50)
    print("步骤6：最终全局验收")
    print("=" * 50)

    # 验收A：不存在悬空 role
    result = await conn.fetch("""
        SELECT j.role, COUNT(*) as cnt
        FROM jobs j
        LEFT JOIN roles r ON r.name = j.role
        WHERE r.id IS NULL
        GROUP BY j.role
    """)
    if result:
        dangling = [(r['role'], r['cnt']) for r in result]
        print(f"[FAIL] 全局验收A：存在悬空 role: {dangling}")
        return False
    print("  验收A：无悬空 role [OK]")

    # 验收B：所有 role 都有 JD 数据
    result = await conn.fetch("""
        SELECT r.name, COUNT(j.id) as jd_count
        FROM roles r
        LEFT JOIN jobs j ON j.role = r.name
        GROUP BY r.name
        HAVING COUNT(j.id) = 0
    """)
    if result:
        no_jd = [r['name'] for r in result]
        print(f"[FAIL] 全局验收B：以下 role 无 JD 数据: {no_jd}")
        return False
    print("  验收B：所有 role 都有 JD 数据 [OK]")

    # 验收C：所有 role 都有画像
    result = await conn.fetch("""
        SELECT r.name
        FROM roles r
        LEFT JOIN job_profiles jp ON jp.role_id = r.id
        WHERE jp.id IS NULL
    """)
    if result:
        no_profile = [r['name'] for r in result]
        print(f"[FAIL] 全局验收C：以下 role 无画像: {no_profile}")
        return False
    print("  验收C：所有 role 都有画像 [OK]")

    # 验收D：输出全景数据
    print("\n最终全景数据:")
    result = await conn.fetch("""
        SELECT r.name, r.category, COUNT(j.id) as jd_count,
            CASE WHEN jp.id IS NOT NULL THEN '[OK]' ELSE '[FAIL]' END as has_profile
        FROM roles r
        LEFT JOIN jobs j ON j.role = r.name
        LEFT JOIN job_profiles jp ON jp.role_id = r.id
        GROUP BY r.name, r.category, r.id, jp.id
        ORDER BY r.category, jd_count DESC
    """)

    for r in result:
        print(f"  {r['category']:8} | {r['name']:12} | JD: {r['jd_count']:4} | 画像: {r['has_profile']}")

    print("\n" + "=" * 50)
    print("[ALL PASS] 全部验收通过，数据库修复完成")
    print("=" * 50)
    return True


# ============== 主函数 ==============

async def main():
    parser = argparse.ArgumentParser(description="修复 jobs.role 字段映射 + 补充导入缺失 JD")
    parser.add_argument('--excel', type=str,
                        default="D:/Users/ffw/Desktop/a13/程序/a13基于AI的大学生职业规划智能体-JD采样数据.xls",
                        help='Excel 文件路径')
    parser.add_argument('--skip-profile', action='store_true', help='跳过画像生成步骤')
    args = parser.parse_args()

    print("=" * 50)
    print("开始执行 jobs.role 修复流程")
    print(f"Excel 路径: {args.excel}")
    print("=" * 50)

    conn = await get_db_connection()

    try:
        # 步骤1：验证映射表
        if not await step1_validate_mapping(conn):
            return

        # 步骤2：处理 UI设计
        if not await step2_handle_ui_design(conn):
            return

        # 步骤3：修正 jobs 表
        if not await step3_fix_jobs_role(conn):
            return

        # 步骤4：导入缺失的 JD
        if not await step4_import_missing_jds(conn, args.excel):
            return

        # 步骤5：重新生成画像
        if not args.skip_profile:
            llm = LLMProvider()
            if not await step5_regenerate_profiles(conn, llm):
                return
        else:
            print("\n[SKIP] 步骤5：跳过画像生成")

        # 步骤6：最终验收
        if not await step6_final_validation(conn):
            return

    except Exception as e:
        print(f"\n[ERROR] 执行过程中出错: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
