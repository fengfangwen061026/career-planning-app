#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
修复脚本：清空旧数据并从 Excel 重新导入，解决中文乱码问题。

使用方法：
  cd D:/Users/ffw/Desktop/a13/程序
  set PYTHONIOENCODING=utf-8
  python scripts/fix_reimport_data.py

原理说明：
  旧的 seed_data.py 在 Windows GBK 终端环境下运行时，某些字符串处理
  （特别是带有特殊符号 • 等的岗位详情）会被 GBK 编码截断或乱码，
  导致写入 PostgreSQL（UTF-8）的数据变成乱码。

  本脚本的修复策略：
  1. 强制设置 stdout/stderr 为 UTF-8（避免 Windows 终端 GBK 干扰）
  2. 清空 jobs 和 roles 表的旧数据
  3. 从 Excel 重新读取并导入
  4. 在每条记录写入前做 UTF-8 编码验证
"""

import argparse
import asyncio
import io
import os
import re
import sys
from pathlib import Path
from typing import Any, Optional

# ============================================================
# 关键修复：强制 UTF-8 输出，防止 Windows GBK 终端干扰
# ============================================================
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    os.environ["PYTHONIOENCODING"] = "utf-8"
    # 使用 Selector 事件循环避免 Proactor 问题
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import pandas as pd
from sqlalchemy import select, func, text, delete
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import psycopg_async as asyncpg_dialect

# 添加 backend 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.models.job import Job, Role


# ============================================================
# Role 归一化映射表（与 seed_data.py 保持一致）
# ============================================================
ROLE_MAPPING = {
    # 技术类
    r"(?i)(java|c\+\+|c#|golang|go语言|python|php|ruby|rust|scala|kotlin)": {
        "role": "后端开发", "category": "技术类", "level": "growing"
    },
    r"(?i)(前端|web前端|vue|react|angular|javascript|html|css)": {
        "role": "前端开发", "category": "技术类", "level": "growing"
    },
    r"(?i)(全栈|full.?stack)": {
        "role": "全栈开发", "category": "技术类", "level": "growing"
    },
    r"(?i)(ios|android|移动端|flutter|react.?native|鸿蒙|harmonyos)": {
        "role": "移动开发", "category": "技术类", "level": "growing"
    },
    r"(?i)(算法|机器学习|深度学习|nlp|自然语言|cv|计算机视觉|ai工程|人工智能)": {
        "role": "算法工程师", "category": "技术类", "level": "hot"
    },
    r"(?i)(数据分析|数据挖掘|bi|商业分析|数据工程)": {
        "role": "数据分析", "category": "技术类", "level": "growing"
    },
    r"(?i)(测试|qa|质量|自动化测试|性能测试)": {
        "role": "软件测试", "category": "技术类", "level": "stable"
    },
    r"(?i)(运维|devops|sre|linux|网络工程|系统管理|云计算)": {
        "role": "运维工程师", "category": "技术类", "level": "stable"
    },
    r"(?i)(安全|渗透|攻防|信息安全|网络安全)": {
        "role": "安全工程师", "category": "技术类", "level": "growing"
    },
    r"(?i)(dba|数据库管理|数据库工程)": {
        "role": "数据库工程师", "category": "技术类", "level": "stable"
    },
    r"(?i)(嵌入式|单片机|firmware|硬件开发|fpga|驱动开发)": {
        "role": "嵌入式开发", "category": "技术类", "level": "stable"
    },
    r"(?i)(架构师|技术总监|cto|技术经理|技术负责人)": {
        "role": "技术管理", "category": "技术类", "level": "senior"
    },
    r"(?i)(实施|交付|部署|项目实施)": {
        "role": "实施工程师", "category": "技术类", "level": "stable"
    },
    # 产品类
    r"(?i)(产品经理|产品总监|产品设计|产品运营|产品助理|产品专员)": {
        "role": "产品经理", "category": "产品类", "level": "growing"
    },
    r"(?i)(项目经理|项目管理|pmo|scrum)": {
        "role": "项目经理", "category": "产品类", "level": "stable"
    },
    # 运营类
    r"(?i)(运营|内容运营|用户运营|社区运营|活动运营|新媒体|短视频运营)": {
        "role": "运营", "category": "运营类", "level": "growing"
    },
    r"(?i)(内容审核|审核|信息审核)": {
        "role": "内容审核", "category": "运营类", "level": "stable"
    },
    r"(?i)(推广|sem|seo|广告投放|流量|增长)": {
        "role": "推广专员", "category": "运营类", "level": "growing"
    },
    # 销售类
    r"(?i)(销售|客户经理|大客户|商务代表)": {
        "role": "销售", "category": "销售类", "level": "stable"
    },
    r"(?i)(商务|bd|合作|渠道)": {
        "role": "商务拓展", "category": "销售类", "level": "stable"
    },
    # 设计类
    r"(?i)(ui|ux|交互|视觉|平面设计|设计师)": {
        "role": "UI设计师", "category": "设计类", "level": "stable"
    },
    # 职能类
    r"(?i)(hr|人事|招聘|人力资源|薪酬|绩效|组织发展)": {
        "role": "HR", "category": "职能类", "level": "stable"
    },
    r"(?i)(财务|会计|出纳|税务|审计)": {
        "role": "财务", "category": "职能类", "level": "stable"
    },
    r"(?i)(法务|律师|合规|法律顾问)": {
        "role": "法务", "category": "职能类", "level": "stable"
    },
    r"(?i)(行政|前台|办公室|文秘|助理)": {
        "role": "行政", "category": "职能类", "level": "stable"
    },
    r"(?i)(客服|售后|在线客服|电话客服|技术支持)": {
        "role": "客服", "category": "职能类", "level": "stable"
    },
    # 科研类
    r"(?i)(科研|研究员|研发|研究)": {
        "role": "科研人员", "category": "技术类", "level": "growing"
    },
}


def normalize_role(title: str) -> dict:
    """基于职位名称做规则归一化"""
    if not title:
        return {"role": "其他", "category": "未分类", "level": "unknown"}
    for pattern, info in ROLE_MAPPING.items():
        if re.search(pattern, title):
            return info
    return {"role": "其他", "category": "未分类", "level": "unknown"}


def parse_salary(salary_str: str) -> tuple[Optional[int], Optional[int], int]:
    """解析薪资字符串，返回 (min, max, months)"""
    if not salary_str or pd.isna(salary_str):
        return None, None, 12

    s = str(salary_str).strip()

    # 日薪：如 120-150元/天
    m = re.match(r"(\d+)-(\d+)元/天", s)
    if m:
        daily_min, daily_max = int(m.group(1)), int(m.group(2))
        return daily_min * 22, daily_max * 22, 12

    # 万/月：如 1-1.3万
    m = re.match(r"([\d.]+)-([\d.]+)万", s)
    if m:
        return int(float(m.group(1)) * 10000), int(float(m.group(2)) * 10000), 12

    # 千/月：如 3-4千
    m = re.match(r"([\d.]+)-([\d.]+)千", s)
    if m:
        return int(float(m.group(1)) * 1000), int(float(m.group(2)) * 1000), 12

    # 元/月：如 3000-4000元
    m = re.match(r"(\d+)-(\d+)元", s)
    if m:
        return int(m.group(1)), int(m.group(2)), 12

    # 纯数字范围：如 3000-4000
    m = re.match(r"(\d+)-(\d+)", s)
    if m:
        return int(m.group(1)), int(m.group(2)), 12

    return None, None, 12


def parse_address(address_str: str) -> tuple[str, Optional[str]]:
    """解析地址字符串，返回 (city, district)"""
    if not address_str or pd.isna(address_str):
        return "未知", None
    parts = str(address_str).split("-", 1)
    city = parts[0].strip()
    district = parts[1].strip() if len(parts) > 1 else None
    if district and district.lower() == "none":
        district = None
    return city or "未知", district


def clean_industries(industries_str: str) -> list[str]:
    """清洗行业字段，去重"""
    if not industries_str or pd.isna(industries_str):
        return []
    items = [s.strip() for s in str(industries_str).split(",") if s.strip()]
    # 去重但保持顺序
    seen = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def clean_description(desc: str) -> str:
    """清洗岗位详情，去除 HTML 标签和多余空白"""
    if not desc or pd.isna(desc):
        return ""
    s = str(desc)
    # 去除 HTML 标签
    s = re.sub(r"<[^>]+>", "", s)
    # 把连续空白和换行统一
    s = re.sub(r"\s+", " ", s).strip()
    return s


def ensure_utf8(value: Any) -> Any:
    """
    关键修复函数：确保字符串值是有效的 UTF-8。
    如果遇到无法编码的字符，用 ? 替代而不是报错。
    """
    if value is None:
        return None
    if isinstance(value, str):
        # 尝试 encode 再 decode，清除非法字符
        return value.encode("utf-8", errors="replace").decode("utf-8")
    return value


# ============================================================
# 数据库操作
# ============================================================

async def clear_all_data(session: AsyncSession):
    """清空 jobs 和 roles 表，准备重新导入"""
    print("🗑️  正在清空旧数据...")

    # 先清 jobs（有外键依赖 roles）
    result = await session.execute(delete(Job))
    jobs_deleted = result.rowcount
    print(f"   删除 jobs: {jobs_deleted} 条")

    # 再清 roles
    result = await session.execute(delete(Role))
    roles_deleted = result.rowcount
    print(f"   删除 roles: {roles_deleted} 条")

    await session.commit()
    print("✅ 旧数据已清空\n")


async def import_jobs(session: AsyncSession, df: pd.DataFrame, batch_size: int = 500) -> int:
    """批量导入 jobs 表（带 UTF-8 验证）"""
    total_imported = 0
    skipped = 0
    jobs_to_insert = []

    for idx, row in df.iterrows():
        job_code = row.get("岗位编码")
        if not job_code or pd.isna(job_code):
            skipped += 1
            continue

        title = ensure_utf8(row.get("岗位名称", ""))
        role_info = normalize_role(title)

        salary_str = str(row.get("薪资范围", ""))
        salary_min, salary_max, salary_months = parse_salary(salary_str)

        address_str = str(row.get("地址", ""))
        city, district = parse_address(address_str)

        industries_str = str(row.get("所属行业", ""))
        industries = clean_industries(industries_str)

        description = ensure_utf8(clean_description(row.get("岗位详情", "")))
        company_intro = ensure_utf8(row.get("公司详情") if pd.notna(row.get("公司详情")) else None)

        job = Job(
            job_code=str(job_code),
            title=title,
            role=role_info["role"],
            city=city,
            district=district,
            salary_min=salary_min,
            salary_max=salary_max,
            salary_months=salary_months,
            company_name=ensure_utf8(row.get("公司名称", "")),
            industries=industries,
            company_size=ensure_utf8(row.get("公司规模") if pd.notna(row.get("公司规模")) else None),
            company_stage=ensure_utf8(row.get("公司类型") if pd.notna(row.get("公司类型")) else None),
            description=description,
            company_intro=company_intro,
        )
        jobs_to_insert.append(job)

        if len(jobs_to_insert) >= batch_size:
            session.add_all(jobs_to_insert)
            await session.commit()
            total_imported += len(jobs_to_insert)
            jobs_to_insert = []
            print(f"   已导入 {total_imported} 条...")

    if jobs_to_insert:
        session.add_all(jobs_to_insert)
        await session.commit()
        total_imported += len(jobs_to_insert)

    if skipped:
        print(f"   ⚠️ 跳过 {skipped} 条无岗位编码的记录")

    return total_imported


async def sync_roles(session: AsyncSession) -> dict:
    """从 jobs 表聚合生成 roles 表"""
    result = await session.execute(
        select(Job.role, func.count(Job.id).label("cnt"))
        .where(Job.role.isnot(None))
        .group_by(Job.role)
    )
    role_stats = result.all()

    inserted = 0
    for role_name, count in role_stats:
        existing = await session.execute(
            select(Role).where(Role.name == role_name)
        )
        if existing.scalar_one_or_none() is None:
            # 使用 normalize_role 获取 category 和 level
            role_info = normalize_role(role_name)
            role = Role(
                name=role_name,
                category=role_info.get("category", "未分类"),
                level=role_info.get("level", "unknown"),
                description=role_info.get("description", "")
            )
            session.add(role)
            inserted += 1

    await session.commit()
    return {"inserted": inserted, "total": len(role_stats)}


async def update_job_role_ids(session: AsyncSession) -> int:
    """更新 jobs 表的 role_id 外键"""
    result = await session.execute(select(Role))
    roles = {r.name: r.id for r in result.scalars().all()}

    updated = 0
    for role_name, role_id in roles.items():
        result = await session.execute(
            select(Job).where(Job.role == role_name, Job.role_id.is_(None))
        )
        jobs = result.scalars().all()
        for job in jobs:
            job.role_id = role_id
            updated += 1

    await session.commit()
    return updated


async def get_role_statistics(session: AsyncSession) -> list[dict]:
    """获取 Role 统计"""
    result = await session.execute(
        select(Job.role, func.count(Job.id).label("cnt"))
        .group_by(Job.role)
        .order_by(func.count(Job.id).desc())
    )
    return [{"role": row[0], "count": row[1]} for row in result.all()]


async def verify_data(session: AsyncSession):
    """验证导入后的数据是否正确（抽检中文是否正常）"""
    print("\n🔍 数据验证...")

    # 抽取几条记录检查中文是否正常
    result = await session.execute(
        select(Job.title, Job.description, Job.city, Job.company_name)
        .limit(5)
    )
    rows = result.all()

    all_ok = True
    for i, (title, desc, city, company) in enumerate(rows, 1):
        # 检查是否包含乱码特征（连续的 � 或 \x 开头的转义）
        for field_name, field_val in [("标题", title), ("城市", city), ("公司", company)]:
            if field_val and ("�" in field_val or "\\x" in field_val):
                print(f"   ❌ 第{i}条 {field_name} 疑似乱码: {field_val[:50]}")
                all_ok = False

        # 检查 description 前50字符
        desc_preview = (desc or "")[:50]
        if desc_preview:
            has_chinese = bool(re.search(r"[\u4e00-\u9fff]", desc_preview))
            if not has_chinese:
                print(f"   ⚠️ 第{i}条 岗位详情无中文: {desc_preview}")
                all_ok = False

    if all_ok:
        print("   ✅ 抽检5条记录，中文显示正常！")
    else:
        print("   ⚠️ 部分记录可能仍有编码问题，请人工检查")

    # 显示示例数据
    print("\n📋 示例数据（前3条）:")
    result = await session.execute(
        select(Job.title, Job.role, Job.city, Job.company_name)
        .limit(3)
    )
    for i, (title, role, city, company) in enumerate(result.all(), 1):
        print(f"   {i}. {title} | {role} | {city} | {company}")


# ============================================================
# 主入口
# ============================================================

async def main():
    parser = argparse.ArgumentParser(description="修复编码：清空旧数据并重新导入")
    parser.add_argument(
        "--file", "-f",
        default="a13基于AI的大学生职业规划智能体-JD采样数据.xls",
        help="JD 数据文件 (xls/xlsx/csv)"
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://postgres:postgres@localhost:5433/career_planning"
        ),
        help="数据库连接 URL"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="批量插入大小"
    )
    parser.add_argument(
        "--skip-clear",
        action="store_true",
        help="跳过清空旧数据（仅追加）"
    )
    args = parser.parse_args()

    # 查找文件
    data_file = Path(args.file)
    if not data_file.exists():
        data_file = Path(__file__).parent.parent / args.file
        if not data_file.exists():
            print(f"❌ 文件不存在: {args.file}")
            sys.exit(1)

    print("=" * 60)
    print("🔧 编码修复 - 数据重新导入脚本")
    print("=" * 60)
    print(f"📂 数据文件: {data_file}")
    print(f"🗄️  数据库: {args.database_url}")
    print(f"📦 批量大小: {args.batch_size}")
    print()

    # 读取 Excel
    print("📖 正在读取 Excel 文件...")
    if str(data_file).endswith(".csv"):
        # CSV 尝试多种编码
        for enc in ["utf-8", "gbk", "gb2312", "gb18030"]:
            try:
                df = pd.read_csv(data_file, encoding=enc)
                print(f"   CSV 编码: {enc}")
                break
            except (UnicodeDecodeError, UnicodeError):
                continue
        else:
            print("❌ 无法识别 CSV 编码")
            sys.exit(1)
    else:
        df = pd.read_excel(data_file)
    print(f"📊 原始数据: {len(df)} 条")

    # 检查列名是否正确（中文列名应该能正常显示）
    print(f"📋 列名: {list(df.columns)}")
    expected_cols = ["岗位名称", "岗位编码", "岗位详情"]
    missing = [c for c in expected_cols if c not in df.columns]
    if missing:
        print(f"❌ 缺少必要列: {missing}")
        print(f"   实际列名: {list(df.columns)}")
        sys.exit(1)

    # 快速检查：第一行数据是否有中文
    first_title = df.iloc[0]["岗位名称"]
    if not re.search(r"[\u4e00-\u9fff]", str(first_title)):
        print(f"⚠️ 警告：第一行岗位名称无中文字符: {first_title}")
        print("   Excel 文件可能有编码问题，请检查原始文件")
    else:
        print(f"✅ 编码检查通过，第一行: {first_title}")

    # 去重
    df = df.drop_duplicates(subset=["岗位编码"], keep="last")
    print(f"🔄 去重后: {len(df)} 条\n")

    # 连接数据库（使用 psycopg/asyncpg 异步驱动）
    # 替换为 psycopg 异步驱动
    db_url = args.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # 清空旧数据
        if not args.skip_clear:
            await clear_all_data(session)

        # 导入 jobs
        print(f"📥 正在导入 jobs 表 (每批 {args.batch_size} 条)...")
        jobs_count = await import_jobs(session, df, args.batch_size)
        print(f"✅ 成功导入 {jobs_count} 条 job 记录\n")

        # 同步 roles
        print("🔄 正在同步 roles 表...")
        roles_result = await sync_roles(session)
        print(f"✅ 新增 {roles_result['inserted']} 条 role 记录\n")

        # 更新 role_id
        print("🔗 正在更新 role_id 外键...")
        updated_count = await update_job_role_ids(session)
        print(f"✅ 已更新 {updated_count} 条 job 的 role_id\n")

        # 验证数据
        await verify_data(session)

        # 统计
        print("\n" + "=" * 60)
        print("📊 Role 统计 (Top 20):")
        print("=" * 60)
        stats = await get_role_statistics(session)
        for i, stat in enumerate(stats[:20], 1):
            print(f"  {i:2d}. {stat['role']:<20} {stat['count']:>5} 条")
        print("=" * 60)
        print(f"  总计: {len(stats)} 个 Role, {sum(s['count'] for s in stats)} 条 JD")

    await engine.dispose()
    print("\n🎉 修复完成！")


if __name__ == "__main__":
    asyncio.run(main())
