#!/usr/bin/env python3
"""
Role 重新分类脚本：使用扩展后的 ROLE_MAPPING 重新分类"其他"岗位

使用方法:
    python scripts/reroll_roles.py
"""
import os
import sys
import re
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

# 添加 backend 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.models.job import Job, Role


# Role 归一化映射表（与 seed_data.py 保持同步）
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
    r"(?i)(测试，软件测试|qa|质量测试)": {
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


def main():
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@localhost:5433/career_planning"
    )

    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    print("=" * 60)
    print("Role 重新分类脚本")
    print("=" * 60)

    # 1. 查看当前"其他"的数量和内容
    result = session.execute(text("""
        SELECT role, COUNT(*) as cnt
        FROM jobs
        GROUP BY role
        ORDER BY cnt DESC
    """))
    print("\n【分类前】Role 分布:")
    for row in result:
        print(f"  {row[0]:<20} {row[1]:>5} 条")

    # 2. 统计"其他"中还有哪些岗位没被新规则覆盖
    result = session.execute(text("""
        SELECT title, COUNT(*) as cnt
        FROM jobs
        WHERE role = '其他'
        GROUP BY title
        ORDER BY cnt DESC
        LIMIT 20
    """))
    print("\n【待处理】'其他'中的岗位 (Top 20):")
    for row in result:
        print(f"  {row[0]:<30} {row[1]:>3} 条")

    # 3. 执行重新分类
    print("\n【执行】重新分类 '其他' 岗位...")

    # 获取所有 role='其他' 的 job
    result = session.execute(text("""
        SELECT id, title
        FROM jobs
        WHERE role = '其他'
    """))
    jobs_to_update = []
    classified_count = 0
    unclassified = []

    for row in result:
        job_id, title = row
        role_info = normalize_role(title)
        if role_info["role"] != "其他":
            jobs_to_update.append((job_id, role_info["role"], role_info["category"], role_info["level"]))
            classified_count += 1
        else:
            unclassified.append(title)

    print(f"  可分类: {classified_count} 条")
    print(f"  仍无法分类: {len(unclassified)} 条")

    # 4. 批量更新
    if jobs_to_update:
        print("\n【执行】更新 jobs 表...")
        for job_id, role, category, level in jobs_to_update:
            session.execute(text("""
                UPDATE jobs
                SET role = :role
                WHERE id = :id
            """), {"role": role, "id": job_id})
        session.commit()
        print(f"  已更新 {len(jobs_to_update)} 条")

    # 5. 同步 roles 表
    print("\n【执行】同步 roles 表...")

    # 获取所有唯一的 role
    result = session.execute(text("SELECT DISTINCT role FROM jobs"))
    job_roles = {row[0] for row in result.all()}

    # 获取已存在的 role
    result = session.execute(text("SELECT name FROM roles"))
    existing_roles = {row[0] for row in result.all()}

    # 添加新 role (使用 gen_random_uuid() 生成 id)
    roles_to_add = []
    for role_name in job_roles:
        if role_name not in existing_roles:
            # 查找对应的 meta
            meta = {"category": "其他", "level": "unknown", "description": ""}
            for pattern, m in ROLE_MAPPING.items():
                if re.search(pattern, role_name):
                    meta = m
                    break

            session.execute(text("""
                INSERT INTO roles (id, name, category, level, description)
                VALUES (gen_random_uuid(), :name, :category, :level, :description)
            """), {
                "name": role_name,
                "category": meta.get("category", "其他"),
                "level": meta.get("level", "unknown"),
                "description": meta.get("description", "")
            })
            roles_to_add.append(role_name)

    if roles_to_add:
        session.commit()
        print(f"  新增 {len(roles_to_add)} 个 role: {roles_to_add}")

    # 6. 更新 jobs.role_id 外键
    print("\n【执行】更新 role_id 外键...")

    # 先将所有 role 名称同步到 roles 表
    result = session.execute(text("SELECT id, name FROM roles"))
    role_map = {row[1]: row[0] for row in result.all()}

    # 更新 jobs
    session.execute(text("""
        UPDATE jobs j
        SET role_id = r.id
        FROM roles r
        WHERE j.role = r.name AND j.role_id IS NULL
    """))
    session.commit()

    updated_count = session.execute(text("SELECT COUNT(*) FROM jobs WHERE role_id IS NOT NULL")).scalar()
    print(f"  已关联 role_id: {updated_count} 条")

    # 7. 查看分类后的分布
    print("\n【分类后】Role 分布:")
    result = session.execute(text("""
        SELECT role, COUNT(*) as cnt
        FROM jobs
        GROUP BY role
        ORDER BY cnt DESC
    """))
    for row in result:
        print(f"  {row[0]:<20} {row[1]:>5} 条")

    # 8. 统计"其他"剩余量
    other_count = session.execute(text("SELECT COUNT(*) FROM jobs WHERE role = '其他'")).scalar()
    print(f"\n✅ '其他' 剩余: {other_count} 条")

    session.close()


if __name__ == "__main__":
    main()
