#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Demo 数据初始化脚本 - 安全幂等，可多次运行。

用法：
    python seed_demo_data.py                  # 完整初始化（含 LLM 调用）
    python seed_demo_data.py --skip-report    # 跳过 LLM 报告生成（快速模式）
    python seed_demo_data.py --skip-graph     # 跳过图谱构建
    python seed_demo_data.py --force          # 覆盖已存在的画像数据
"""

import argparse
import asyncio
import sys
import os
from pathlib import Path
from uuid import UUID

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[3] / ".env")

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.models.student import Student, StudentProfile
from app.models.job import JobProfile
from app.models.graph import GraphEdge


DEMO_ID = UUID("00000000-0000-0000-0000-000000009001")
DEMO_EMAIL = "demo@career.ai"

DEMO_PROFILE_JSON = {
    "basic_info": {
        "name": "张明",
        "education": "本科",
        "major": "计算机科学与技术",
        "school": "西安电子科技大学",
        "graduation_year": 2025,
        "gpa": 3.6,
        "target_role": "后端开发工程师",
        "city": "北京",
    },
    "skills": [
        {"name": "Python", "level": "熟练"},
        {"name": "Java", "level": "熟练"},
        {"name": "MySQL", "level": "了解"},
        {"name": "Git", "level": "熟练"},
        {"name": "Linux", "level": "了解"},
        {"name": "Vue.js", "level": "了解"},
        {"name": "Redis", "level": "了解"},
        {"name": "Spring Boot", "level": "了解"},
    ],
    "technical_skills": {
        "programming_languages": [
            {"name": "Python", "importance": "必备"},
            {"name": "Java", "importance": "必备"},
        ],
        "frameworks_and_libraries": [
            {"name": "Spring Boot", "importance": "加分"},
            {"name": "Vue.js", "importance": "加分"},
            {"name": "FastAPI", "importance": "加分"},
        ],
        "databases": [
            {"name": "MySQL", "importance": "必备"},
            {"name": "Redis", "importance": "加分"},
        ],
        "tools_and_platforms": [
            {"name": "Git", "importance": "必备"},
            {"name": "Linux", "importance": "加分"},
            {"name": "Docker", "importance": "加分"},
        ],
    },
    "education": [
        {
            "school": "西安电子科技大学",
            "degree": "本科",
            "major": "计算机科学与技术",
            "graduation_year": 2025,
            "gpa": 3.6,
        }
    ],
    "projects": [
        {
            "name": "校园二手交易平台",
            "role": "后端开发负责人",
            "description": "基于 Spring Boot + Vue.js 的校园商品交易系统，实现商品发布、搜索、交易撮合功能，注册用户 500+",
            "tech_stack": ["Spring Boot", "Vue.js", "MySQL", "Redis"],
            "start_date": "2024-03",
            "end_date": "2024-06",
        },
        {
            "name": "智能简历解析工具",
            "role": "独立开发",
            "description": "Python FastAPI 后端，调用 LLM 自动解析简历结构化信息，支持 PDF/DOCX，已开源",
            "tech_stack": ["Python", "FastAPI", "OpenAI API"],
            "start_date": "2024-09",
            "end_date": "2024-12",
        },
    ],
    "internships": [
        {
            "company": "某互联网公司",
            "role": "Python 后端实习生",
            "duration": "3个月",
            "description": "负责数据处理管道开发，使用 Python + Pandas，日处理数据量 100W 条，优化性能提升 30%",
        }
    ],
    "soft_competencies": {
        "communication": {
            "value": 4,
            "evidence": "参与团队项目代码评审，主导技术方案讨论",
        },
        "teamwork": {
            "value": 4,
            "evidence": "三人小组完成校园交易平台，负责后端并协调前后端接口对接",
        },
        "learning_ability": {
            "value": 5,
            "evidence": "自学 Vue.js、FastAPI 并成功应用于项目；通过在线课程掌握 Redis 缓存方案",
        },
        "stress_tolerance": {
            "value": 3,
            "evidence": "期末考试期间同步完成项目交付，按时完成所有功能",
        },
        "innovation": {
            "value": 4,
            "evidence": "设计了基于优先队列的交易撮合算法，降低响应延迟 40%",
        },
    },
    "certifications": [],
    "awards": ["校级奖学金 2023", "软件设计大赛三等奖 2023"],
    "competitiveness_score": 72,
    "completeness_score": 85,
    "missing_suggestions": [
        "建议增加量化项目成果（如 DAU、QPS 等指标）",
        "可补充云平台（AWS/阿里云）使用经验",
        "建议考取计算机相关证书（如软件设计师、CET-6）",
    ],
}


async def seed_student(db: AsyncSession, force: bool) -> None:
    student = await db.get(Student, DEMO_ID)
    if not student:
        student = Student(id=DEMO_ID, email=DEMO_EMAIL, name="张明")
        db.add(student)
        await db.commit()
        print("[OK] Demo 学生已创建")
    else:
        print("[SKIP] Demo 学生已存在")


async def seed_student_profile(db: AsyncSession, force: bool) -> None:
    stmt = select(StudentProfile).where(StudentProfile.student_id == DEMO_ID)
    profile = (await db.execute(stmt)).scalar_one_or_none()
    if not profile:
        profile = StudentProfile(student_id=DEMO_ID, profile_json=DEMO_PROFILE_JSON)
        db.add(profile)
        await db.commit()
        print("[OK] Demo 画像已写入")
    elif force:
        profile.profile_json = DEMO_PROFILE_JSON
        await db.commit()
        print("[OK] Demo 画像已覆盖更新")
    else:
        print("[SKIP] Demo 画像已存在（--force 可覆盖）")


async def seed_matching(db: AsyncSession) -> None:
    from app.services.matching import match_student_job

    jp_stmt = select(JobProfile).limit(5)
    job_profiles = (await db.execute(jp_stmt)).scalars().all()
    if not job_profiles:
        print("[WARN] 无岗位画像，跳过匹配计算")
        return

    for jp in job_profiles:
        try:
            await match_student_job(db=db, student_id=DEMO_ID, job_profile_id=jp.id)
            role_name = jp.profile_json.get("role_name", str(jp.id)) if jp.profile_json else str(jp.id)
            print(f"[OK] 匹配完成: {role_name}")
        except Exception as e:
            print(f"[WARN] 匹配失败 {jp.id}: {e}")


async def seed_report(db: AsyncSession) -> None:
    from app.services.report import generate_full_report

    try:
        report = await generate_full_report(student_id=DEMO_ID, db=db)
        print(f"[OK] Demo 报告已生成: {report.id}")
    except Exception as e:
        print(f"[WARN] 报告生成失败（需要 LLM 配置）: {e}")


async def seed_graph(db: AsyncSession, force: bool) -> None:
    from app.services.graph import build_job_graph

    # 检查现有图谱边数
    count = (await db.execute(
        select(func.count()).select_from(GraphEdge)
    )).scalar_one()

    if count == 0 or force:
        print(f"[INFO] 开始构建职业图谱（当前 {count} 条边）...")
        try:
            result = await build_job_graph(db)
            print(f"[OK] 图谱构建完成: {result}")
        except Exception as e:
            print(f"[WARN] 图谱构建失败: {e}")
            return
    else:
        print(f"[SKIP] 图谱已有 {count} 条边（--force 可重建）")

    # 验证换岗路径（赛题硬性要求：≥5 岗位 × ≥2 条路径）
    lateral_stmt = (
        select(GraphEdge.source_node_id, func.count().label("cnt"))
        .where(or_(
            GraphEdge.edge_type == "lateral_transfer",
            GraphEdge.edge_type == "transition",
        ))
        .group_by(GraphEdge.source_node_id)
        .having(func.count() >= 2)
    )
    rows = (await db.execute(lateral_stmt)).all()
    count_qualified = len(rows)

    print(f"\n[验收] 具有 ≥2 条换岗路径的岗位数：{count_qualified}（赛题要求 ≥5）")
    if count_qualified >= 5:
        print("  → 满足赛题要求 ✓")
    else:
        print("  → 不满足赛题要求！请确认岗位画像中包含技能数据，然后重新运行（加 --force）")
        # 同时打印各节点路径数以便调试
        all_lateral_stmt = (
            select(GraphEdge.source_node_id, func.count().label("cnt"))
            .where(or_(
                GraphEdge.edge_type == "lateral_transfer",
                GraphEdge.edge_type == "transition",
            ))
            .group_by(GraphEdge.source_node_id)
            .order_by(func.count().desc())
            .limit(10)
        )
        top_rows = (await db.execute(all_lateral_stmt)).all()
        if top_rows:
            print("  Top 10 节点换岗路径数：")
            for row in top_rows:
                print(f"    节点 {row.source_node_id}: {row.cnt} 条")
        else:
            print("  当前无换岗路径，图谱可能未构建或岗位画像缺少技能字段")


async def main(force: bool, skip_report: bool, skip_graph: bool) -> None:
    print("=== Demo 数据初始化开始 ===\n")

    async with async_session_factory() as db:
        await seed_student(db, force)
        await seed_student_profile(db, force)
        await seed_matching(db)

        if not skip_report:
            await seed_report(db)
        else:
            print("[SKIP] 跳过报告生成")

        if not skip_graph:
            await seed_graph(db, force)
        else:
            print("[SKIP] 跳过图谱构建")

    print("\n=== Demo 数据初始化完成 ===")
    print(f"\nDemo 学生 ID: {DEMO_ID}")
    print(f"Demo 学生邮箱: {DEMO_EMAIL}")
    print("在移动端 OnboardingFlow 中使用此邮箱即可体验完整演示流程")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="初始化 Demo 演示数据")
    parser.add_argument("--force", action="store_true", help="覆盖已存在的画像和图谱数据")
    parser.add_argument("--skip-report", action="store_true", help="跳过 LLM 报告生成（节省时间）")
    parser.add_argument("--skip-graph", action="store_true", help="跳过图谱构建")
    args = parser.parse_args()

    asyncio.run(main(args.force, args.skip_report, args.skip_graph))
