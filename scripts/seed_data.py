#!/usr/bin/env python3
"""
数据导入脚本：从清洗后的 JD 数据文件批量导入数据库
"""
import argparse
import os
import re
import sys
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# 添加 backend 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.models.job import Job, Role


# Role 归一化映射表 - 基于 data_analysis_report.md
ROLE_MAPPING = {
    # 技术类
    r"(?i)(java|c\+\+|c#|golang|go|python|php|ruby|rust|scala|kotlin)": {
        "role": "后端开发", "category": "技术类", "level": "growing"
    },
    r"(?i)(前端|web前端|vue|react|angular|javascript|html|css)": {
        "role": "前端开发", "category": "技术类", "level": "growing"
    },
    r"(?i)(算法|机器学习|深度学习|人工智能|nlp)": {
        "role": "算法工程师", "category": "技术类", "level": "growing"
    },
    r"(?i)(测试|软件测试|qa|质量测试)": {
        "role": "软件测试", "category": "技术类", "level": "growing"
    },
    r"(?i)(实施工程师|技术支持|技术支持工程师|运维|运维工程师)": {
        "role": "技术支持/实施", "category": "技术类", "level": "growing"
    },
    r"(?i)(数据工程师|数据开发|etl|hadoop|hive)": {
        "role": "数据工程师", "category": "技术类", "level": "growing"
    },
    r"(?i)(移动端|ios|android|app开发)": {
        "role": "移动端开发", "category": "技术类", "level": "growing"
    },
    r"(?i)(硬件测试|硬件工程师|嵌入式)": {
        "role": "硬件工程师", "category": "技术类", "level": "growing"
    },
    # 产品类
    r"(?i)(产品经理|产品专员|产品助理)": {
        "role": "产品经理", "category": "产品类", "level": "growing"
    },
    # 运营类
    r"(?i)(运营|用户运营|内容运营|电商运营|游戏运营|社区运营)": {
        "role": "运营", "category": "运营类", "level": "growing"
    },
    r"(?i)(内容审核|审核)": {
        "role": "内容审核", "category": "运营类", "level": "entry"
    },
    r"(?i)(app推广|游戏推广|推广)": {
        "role": "推广专员", "category": "运营类", "level": "growing"
    },
    # 销售类
    r"(?i)(销售|销售工程师|电话销售|网络销售|销售助理|销售运营)": {
        "role": "销售", "category": "销售类", "level": "growing"
    },
    r"(?i)(大客户|客户经理|bd|商务拓展)": {
        "role": "商务拓展", "category": "销售类", "level": "growing"
    },
    r"(?i)(广告销售)": {
        "role": "广告销售", "category": "销售类", "level": "growing"
    },
    # 市场类
    r"(?i)(市场营销|市场推广|品牌推广)": {
        "role": "市场营销", "category": "市场类", "level": "growing"
    },
    # 客服类
    r"(?i)(客服|售后客服|电话客服|网络客服)": {
        "role": "客服", "category": "客服类", "level": "entry"
    },
    # 设计类
    r"(?i)(ui|ux|平面设计|视觉设计|交互设计|设计师)": {
        "role": "UI设计师", "category": "设计类", "level": "growing"
    },
    # 职能类
    r"(?i)(人力资源|hr|招聘专员|招聘助理|培训师|猎头顾问)": {
        "role": "人力资源", "category": "职能类", "level": "growing"
    },
    r"(?i)(法务|律师|专利|知识产权)": {
        "role": "法务", "category": "职能类", "level": "growing"
    },
    r"(?i)(财务|会计|出纳)": {
        "role": "财务", "category": "职能类", "level": "growing"
    },
    r"(?i)(行政|总助|ceo助理|董事长助理|资料管理|档案管理|统计员)": {
        "role": "行政/助理", "category": "职能类", "level": "entry"
    },
    # 项目管理
    r"(?i)(项目经理|项目主管|项目专员|项目招投标)": {
        "role": "项目管理", "category": "管理类", "level": "growing"
    },
    # 咨询类
    r"(?i)(咨询顾问|咨询)": {
        "role": "咨询顾问", "category": "咨询类", "level": "growing"
    },
    # 翻译
    r"(?i)(翻译|英语翻译|日语翻译|口译|笔译)": {
        "role": "翻译", "category": "语言类", "level": "growing"
    },
    # 科研
    r"(?i)(科研|科研人员)": {
        "role": "科研", "category": "科研类", "level": "growing"
    },
    # 质检
    r"(?i)(质检|质量检测)": {
        "role": "质检", "category": "质量类", "level": "entry"
    },
    # 新能源
    r"(?i)(风电|新能源|光伏)": {
        "role": "新能源工程师", "category": "技术类", "level": "growing"
    },
    # 管培生
    r"(?i)(管培生|储备干部|储备经理人|储备)": {
        "role": "管培生", "category": "管培类", "level": "entry"
    },
    # 质量管理
    r"(?i)(质检|质量检测|品控|品质管理|质量工程师)": {
        "role": "质量管理", "category": "质量类", "level": "entry"
    },
    # 数据分析（扩展）
    r"(?i)(统计|数据分析|数据专员|bi)": {
        "role": "数据分析", "category": "技术类", "level": "growing"
    },
    # 培训教育
    r"(?i)(培训师|培训专员|课程顾问|教务)": {
        "role": "培训", "category": "教育类", "level": "growing"
    },
    # 翻译（扩展）
    r"(?i)(翻译|英语翻译|日语翻译|口译|笔译|外译)": {
        "role": "翻译", "category": "语言类", "level": "growing"
    },
    # 司机/后勤
    r"(?i)(司机|商务司机|驾驶员)": {
        "role": "司机", "category": "职能类", "level": "entry"
    },
    # 美容/健身
    r"(?i)(美容|化妆|健身|瑜伽|美容师|美发)": {
        "role": "美容/健身", "category": "服务类", "level": "entry"
    },
    # 餐饮服务
    r"(?i)(厨师|服务员|餐饮|店长|店助)": {
        "role": "餐饮服务", "category": "服务类", "level": "entry"
    },
    # 零售
    r"(?i)(导购|营业员|店长|零售|店员)": {
        "role": "零售", "category": "销售类", "level": "entry"
    },
    # 仓储物流
    r"(?i)(仓管|仓库|物流|仓储|快递|配送)": {
        "role": "仓储物流", "category": "物流类", "level": "entry"
    },
    # 采购
    r"(?i)(采购|供应商|采购专员)": {
        "role": "采购", "category": "职能类", "level": "growing"
    },
    # 土木/建筑
    r"(?i)(土木|建筑|施工|工程|造价)": {
        "role": "建筑工程", "category": "工程类", "level": "growing"
    },
    # 机械
    r"(?i)(机械|机电|设备|维修|装配)": {
        "role": "机械工程", "category": "技术类", "level": "growing"
    },
    # 电气
    r"(?i)(电气|电工|电气工程|自动化)": {
        "role": "电气工程", "category": "技术类", "level": "growing"
    },
    # 化学/化工
    r"(?i)(化学|化工|研发|实验)": {
        "role": "化工研发", "category": "技术类", "level": "growing"
    },
    # 医药
    r"(?i)(医药|药剂|临床|医疗|护士|医生)": {
        "role": "医疗健康", "category": "医疗类", "level": "growing"
    },
    # 金融
    r"(?i)(金融|银行|证券|投资|理财|保险)": {
        "role": "金融", "category": "金融类", "level": "growing"
    },
    # 电商
    r"(?i)(电商|淘宝|天猫|京东|拼多多|跨境)": {
        "role": "电商运营", "category": "运营类", "level": "growing"
    },
    # 新媒体
    r"(?i)(新媒体|抖音|短视频|直播|自媒体)": {
        "role": "新媒体运营", "category": "运营类", "level": "growing"
    },
    # 教师
    r"(?i)(教师|老师|家教|幼教|教员)": {
        "role": "教师", "category": "教育类", "level": "growing"
    },
    # 研究院/科研
    r"(?i)(研究院|研究员|科研|专家)": {
        "role": "科研", "category": "科研类", "level": "growing"
    },
}


def normalize_role(title: str) -> dict:
    """基于职位名称做规则归一化"""
    for pattern, meta in ROLE_MAPPING.items():
        if re.search(pattern, title):
            return meta
    # 默认归类
    return {"role": "其他", "category": "其他", "level": "unknown"}


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
        # 万/月
        match = re.search(r"([\d.]+)-([\d.]+)万", salary_str)
        if match:
            return int(float(match.group(1)) * 10000), int(float(match.group(2)) * 10000), months
    else:
        # 元/月
        match = re.search(r"(\d+)-(\d+)", salary_str)
        if match:
            return int(match.group(1)), int(match.group(2)), months
        # 日薪转换为月薪（按22天）
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


def clean_industries(industries) -> list[str]:
    """清洗行业字段，去重"""
    if not industries or not isinstance(industries, str):
        return []
    # 分割并去重
    items = [i.strip() for i in industries.split(",")]
    unique_items = list(dict.fromkeys(items))  # 保持顺序去重
    return [i for i in unique_items if i]


def clean_description(description) -> str:
    """清洗岗位详情，去除 HTML 标签"""
    if not description or not isinstance(description, str):
        return ""
    # 去除 <br> 标签
    description = re.sub(r"<br\s*/?>", "\n", description, flags=re.IGNORECASE)
    # 去除 HTML 标签
    description = re.sub(r"<[^>]+>", "", description)
    # 去除多余空白
    description = re.sub(r"\n{3,}", "\n\n", description)
    return description.strip()


async def import_jobs(session: AsyncSession, df: pd.DataFrame, batch_size: int = 500) -> int:
    """批量导入 jobs 表"""
    total_imported = 0
    existing_codes = set()

    # 查询已存在的 job_code
    result = await session.execute(select(Job.job_code))
    existing_codes = {row[0] for row in result.all()}

    # 过滤已存在的记录
    df_filtered = df[~df["岗位编码"].isin(existing_codes)]

    jobs_to_insert = []
    for _, row in df_filtered.iterrows():
        job_code = row.get("岗位编码")
        if not job_code:
            continue

        title = row.get("岗位名称", "")
        role_info = normalize_role(title)

        # 解析薪资
        salary_str = row.get("薪资范围", "")
        salary_min, salary_max, salary_months = parse_salary(salary_str)

        # 解析地址
        address_str = row.get("地址", "")
        city, district = parse_address(address_str)

        # 清洗行业
        industries_str = row.get("所属行业", "")
        industries = clean_industries(industries_str)

        # 清洗描述
        description = clean_description(row.get("岗位详情", ""))

        job = Job(
            job_code=str(job_code),
            title=title,
            role=role_info["role"],
            city=city,
            district=district,
            salary_min=salary_min,
            salary_max=salary_max,
            salary_months=salary_months,
            company_name=row.get("公司名称", ""),
            industries=industries,
            company_size=row.get("公司规模") if pd.notna(row.get("公司规模")) else None,
            company_stage=row.get("公司类型") if pd.notna(row.get("公司类型")) else None,
            description=description,
            company_intro=row.get("公司详情") if pd.notna(row.get("公司详情")) else None,
        )
        jobs_to_insert.append(job)

        # 批量插入
        if len(jobs_to_insert) >= batch_size:
            session.add_all(jobs_to_insert)
            await session.commit()
            total_imported += len(jobs_to_insert)
            jobs_to_insert = []
            print(f"  已导入 {total_imported} 条...")

    # 插入剩余记录
    if jobs_to_insert:
        session.add_all(jobs_to_insert)
        await session.commit()
        total_imported += len(jobs_to_insert)

    return total_imported


async def sync_roles(session: AsyncSession) -> dict[str, Any]:
    """同步 roles 表：基于 jobs 表中已有的 role 归一化"""
    # 获取 jobs 表中所有唯一的 role
    result = await session.execute(select(Job.role).distinct())
    job_roles = {row[0] for row in result.all()}

    # 查询已存在的 role
    result = await session.execute(select(Role.name))
    existing_roles = {row[0] for row in result.all()}

    roles_to_insert = []
    for role_name in job_roles:
        if role_name in existing_roles:
            continue

        # 查找对应的 meta
        meta = {"category": "其他", "level": "unknown", "description": ""}
        for pattern, m in ROLE_MAPPING.items():
            if re.search(pattern, role_name):
                meta = m
                break
        if role_name == "其他":
            meta = {"category": "其他", "level": "unknown", "description": "未分类岗位"}

        role = Role(
            name=role_name,
            category=meta.get("category", "其他"),
            level=meta.get("level", "unknown"),
            description=meta.get("description", ""),
        )
        roles_to_insert.append(role)

    if roles_to_insert:
        session.add_all(roles_to_insert)
        await session.commit()

    return {"inserted": len(roles_to_insert), "existing": len(existing_roles)}


async def update_job_role_ids(session: AsyncSession) -> int:
    """更新 jobs 表的 role_id 外键"""
    # 获取所有 role 映射
    result = await session.execute(select(Role))
    roles = result.scalars().all()
    role_map = {role.name: role.id for role in roles}

    # 更新 jobs 表
    result = await session.execute(select(Job).where(Job.role_id.is_(None)))
    jobs_without_role = result.scalars().all()

    for job in jobs_without_role:
        if job.role in role_map:
            job.role_id = role_map[job.role]

    if jobs_without_role:
        await session.commit()

    return len(jobs_without_role)


async def get_role_statistics(session: AsyncSession) -> list[dict]:
    """获取每个 Role 下的 JD 数量统计"""
    result = await session.execute(
        select(Job.role, func.count(Job.id))
        .group_by(Job.role)
        .order_by(func.count(Job.id).desc())
    )
    return [{"role": row[0], "count": row[1]} for row in result.all()]


async def main():
    parser = argparse.ArgumentParser(description="导入 JD 数据到数据库")
    parser.add_argument(
        "--file", "-f",
        default="a13基于AI的大学生职业规划智能体-JD采样数据.xls",
        help="清洗后的 JD 数据文件 (xls/csv)"
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://postgres:postgres@localhost:5432/career_planning"
        ),
        help="数据库连接 URL"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="批量插入大小"
    )
    args = parser.parse_args()

    # 检查文件是否存在
    data_file = Path(args.file)
    if not data_file.exists():
        # 尝试在当前目录查找
        data_file = Path(__file__).parent.parent / args.file
        if not data_file.exists():
            print(f"❌ 文件不存在: {args.file}")
            sys.exit(1)

    print(f"📂 读取数据文件: {data_file}")

    # 读取 Excel 文件
    df = pd.read_excel(data_file)
    print(f"📊 原始数据: {len(df)} 条")

    # 去重：基于岗位编码
    df = df.drop_duplicates(subset=["岗位编码"], keep="last")
    print(f"🔄 去重后: {len(df)} 条")

    # 创建异步引擎
    engine = create_async_engine(args.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # 导入 jobs
        print(f"\n📥 正在导入 jobs 表 (每批 {args.batch_size} 条)...")
        jobs_count = await import_jobs(session, df, args.batch_size)
        print(f"✅ 成功导入 {jobs_count} 条 job 记录")

        # 同步 roles
        print("\n🔄 正在同步 roles 表...")
        roles_result = await sync_roles(session)
        print(f"✅ 新增 {roles_result['inserted']} 条 role 记录")

        # 更新 role_id
        print("\n🔗 正在更新 role_id 外键...")
        updated_count = await update_job_role_ids(session)
        print(f"✅ 已更新 {updated_count} 条 job 的 role_id")

        # 打印统计
        print("\n" + "=" * 50)
        print("📊 Role 统计 (Top 20):")
        print("=" * 50)
        stats = await get_role_statistics(session)
        for i, stat in enumerate(stats[:20], 1):
            print(f"  {i:2d}. {stat['role']:<20} {stat['count']:>5} 条")
        print("=" * 50)
        print(f"  总计: {len(stats)} 个 Role, {sum(s['count'] for s in stats)} 条 JD")

    await engine.dispose()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
