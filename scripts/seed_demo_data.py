#!/usr/bin/env python3
"""
预加载演示数据脚本。
运行方式：cd backend && python ../scripts/seed_demo_data.py
"""
import asyncio
import json
import sys
import os
import uuid

# 添加项目路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.database import async_session_factory as async_session
from sqlalchemy import text


# ============================================================
# Demo 学生数据（3套）- 使用规范 UUID 以 9001/9002/9003 结尾便于识别
# ============================================================

def make_uuid(num: int) -> uuid.UUID:
    """生成以指定数字结尾的 UUID，方便识别"""
    base = f"00000000-0000-0000-0000-00000000{num:04d}"
    return uuid.UUID(base)


DEMO_STUDENTS = [
    {
        "id": make_uuid(9001),
        "email": "zhangmingyuan@demo.cn",
        "name": "张明远",
        "phone": "13800009001",
        "gender": "男",
        "job_intention": "后端开发工程师",
        "expected_salary_min": 8000,
        "expected_salary_max": 12000,
        "profile": {
            "student_id": 9001,
            "education_level": "本科",
            "major": "计算机科学与技术",
            "graduation_year": 2026,
            "completeness_score": 0.92,
            "competitiveness_score": 0.78,
            "skills": [
                {"name": "Python", "category": "编程语言", "proficiency": "熟练", "source": "resume"},
                {"name": "Java", "category": "编程语言", "proficiency": "掌握", "source": "resume"},
                {"name": "MySQL", "category": "数据库", "proficiency": "熟练", "source": "resume"},
                {"name": "Git", "category": "工具", "proficiency": "熟练", "source": "resume"},
                {"name": "Docker", "category": "工具", "proficiency": "了解", "source": "resume"},
                {"name": "FastAPI", "category": "框架", "proficiency": "掌握", "source": "resume"},
                {"name": "Vue.js", "category": "框架", "proficiency": "了解", "source": "resume"},
            ],
            "experience_months": 3,
            "project_count": 2,
            "certificate_names": ["CET-6 520分", "计算机二级 Python"],
            "award_level": "校级",
            "soft_skills": [
                {"dimension": "沟通能力", "score": 0.6, "evidence": "团队项目中负责需求对接"},
                {"dimension": "团队协作", "score": 0.8, "evidence": "二手平台3人团队协作"},
                {"dimension": "抗压能力", "score": 0.6, "evidence": "实习期间多任务并行"},
                {"dimension": "学习能力", "score": 0.8, "evidence": "自学FastAPI并完成项目"},
                {"dimension": "创新能力", "score": 0.6, "evidence": "推荐系统独立设计算法"},
            ],
            "missing_suggestions": ["建议补充Redis项目经验", "建议了解微服务架构"],
        },
        "completeness_score": 0.92,
        "competitiveness_score": 0.78,
    },
    {
        "id": make_uuid(9002),
        "email": "liyutong@demo.cn",
        "name": "李雨桐",
        "phone": "13800009002",
        "gender": "女",
        "job_intention": "数据分析师",
        "expected_salary_min": 10000,
        "expected_salary_max": 15000,
        "profile": {
            "student_id": 9002,
            "education_level": "本科",
            "major": "数据科学与大数据技术",
            "graduation_year": 2026,
            "completeness_score": 0.85,
            "competitiveness_score": 0.75,
            "skills": [
                {"name": "Python", "category": "编程语言", "proficiency": "熟练", "source": "resume"},
                {"name": "SQL", "category": "数据库", "proficiency": "熟练", "source": "resume"},
                {"name": "Pandas", "category": "库", "proficiency": "熟练", "source": "resume"},
                {"name": "Tableau", "category": "工具", "proficiency": "掌握", "source": "resume"},
                {"name": "Excel", "category": "工具", "proficiency": "熟练", "source": "resume"},
                {"name": "R", "category": "编程语言", "proficiency": "了解", "source": "resume"},
            ],
            "experience_months": 2,
            "project_count": 1,
            "certificate_names": ["CET-6 550分"],
            "award_level": "校级",
            "soft_skills": [
                {"dimension": "沟通能力", "score": 0.7, "evidence": "数据分析报告多次汇报"},
                {"dimension": "团队协作", "score": 0.7, "evidence": "小组项目协作"},
                {"dimension": "学习能力", "score": 0.8, "evidence": "自学数据分析技能"},
            ],
            "missing_suggestions": ["建议学习Spark/Hive", "建议强化统计建模"],
        },
        "completeness_score": 0.85,
        "competitiveness_score": 0.75,
    },
    {
        "id": make_uuid(9003),
        "email": "wanghaoran@demo.cn",
        "name": "王浩然",
        "phone": "13800009003",
        "gender": "男",
        "job_intention": "前端开发工程师",
        "expected_salary_min": 8000,
        "expected_salary_max": 15000,
        "profile": {
            "student_id": 9003,
            "education_level": "本科",
            "major": "软件工程",
            "graduation_year": 2026,
            "completeness_score": 0.70,
            "competitiveness_score": 0.68,
            "skills": [
                {"name": "JavaScript", "category": "编程语言", "proficiency": "熟练", "source": "resume"},
                {"name": "TypeScript", "category": "编程语言", "proficiency": "掌握", "source": "resume"},
                {"name": "React", "category": "框架", "proficiency": "熟练", "source": "resume"},
                {"name": "CSS", "category": "前端", "proficiency": "熟练", "source": "resume"},
                {"name": "Node.js", "category": "运行时", "proficiency": "掌握", "source": "resume"},
            ],
            "experience_months": 0,
            "project_count": 1,
            "certificate_names": [],
            "award_level": "无",
            "soft_skills": [
                {"dimension": "沟通能力", "score": 0.5, "evidence": "较少团队项目经验"},
                {"dimension": "团队协作", "score": 0.6, "evidence": "课程项目协作"},
                {"dimension": "学习能力", "score": 0.7, "evidence": "自学React并完成项目"},
            ],
            "missing_suggestions": ["建议补充实习经验", "建议学习主流前端框架"],
        },
        "completeness_score": 0.70,
        "competitiveness_score": 0.68,
    },
]


# ============================================================
# Demo 匹配结果
# ============================================================

DEMO_MATCHING_RESULTS = {
    9001: {
        "overall_score": 0.82,
        "dimension_scores": {
            "basic": 0.92,
            "skill": 0.78,
            "soft": 0.75,
            "potential": 0.85
        },
        "gap_items": [
            {"item": "Redis", "current": "未掌握", "required": "熟练", "priority": "高", "suggestion": "学习Redis基础，2-3周可掌握缓存和分布式锁"},
            {"item": "微服务架构", "current": "不了解", "required": "了解", "priority": "中", "suggestion": "了解Spring Cloud或gRPC基本概念"},
            {"item": "项目量化表达", "current": "描述主观", "required": "量化数据", "priority": "高", "suggestion": "补充用户量、性能指标等量化数据"},
        ],
    },
    9002: {
        "overall_score": 0.79,
        "dimension_scores": {
            "basic": 0.95,
            "skill": 0.72,
            "soft": 0.80,
            "potential": 0.78
        },
        "gap_items": [
            {"item": "Spark/Hive", "current": "不了解", "required": "了解", "priority": "中", "suggestion": "学习大数据处理基础"},
            {"item": "统计建模", "current": "掌握一般", "required": "熟练", "priority": "高", "suggestion": "强化A/B测试和回归分析实操"},
        ],
    },
}


# ============================================================
# Demo 报告内容
# ============================================================

DEMO_REPORTS = {
    9001: {
        "summary": "张明远是西安交通大学计算机专业2026届应届毕业生，具备扎实后端开发能力，Python和MySQL经验丰富，但需补充Redis和微服务经验。",
        "target_job_name": "后端开发工程师",
        "match_score": 82,
        "chapter_1_summary": """## 个人优势总结

张明远同学是西安交通大学计算机科学与技术专业2026届应届毕业生，具备扎实的后端开发能力和明确的职业方向。

**核心优势：**

- **Python后端开发能力突出**：3个项目使用Python开发，其中校园二手交易平台独立负责后端架构，注册用户300+，接口响应P99 < 200ms，体现了工程落地能力
- **数据库设计经验丰富**：实习期间负责数据库设计，熟练使用MySQL，具备真实业务场景下的数据建模能力
- **项目经验完整**：从需求分析、架构设计到部署运维，经历过完整的项目生命周期，团队协作能力良好
- **自学能力强**：自主学习FastAPI框架并成功应用于项目，学习曲线陡峭

**与目标岗位最匹配的优势**：Python开发能力、MySQL数据库经验、API设计经验与后端开发工程师岗位高度契合。

**一句话定位**：具备扎实Python后端基础和完整项目经验的应届毕业生，在API开发和数据库设计方面有较强竞争力。""",

        "chapter_2_job_analysis": """## 目标岗位分析

**后端开发工程师**是互联网行业最核心的技术岗位之一，负责服务端架构设计、API开发、数据处理和系统性能优化。

**岗位核心要求：**
- 必备技能：Python/Java、MySQL、Redis、Git
- 加分技能：微服务架构、Docker/K8s、消息队列
- 素质要求：逻辑思维、问题解决、团队协作
- 经验要求：应届可接受，有实习经验优先

**四维匹配分析：**
- **基础要求 92分**：学历、专业、实习经验完全满足
- **职业技能 78分**：Python和MySQL强匹配，但缺少Redis和微服务经验
- **职业素养 75分**：有团队协作和项目管理经验，沟通能力需加强
- **发展潜力 85分**：自学能力强，项目复杂度递增，成长轨迹良好

**行业趋势**：后端开发岗位需求稳定，薪资范围应届8-15K，2-3年经验后可达15-25K。""",

        "chapter_3_gap_action": """## 差距与行动计划

**必须补齐（影响较大）：**

**1. Redis缺失（影响 -12分）**
- 当前状态：简历和项目中未涉及Redis
- 行动计划：
  - 第1-2周：学习Redis基础（数据类型、持久化、过期策略）
  - 第3周：在二手平台项目中加入Redis缓存层，实践分布式锁
  - 推荐资源：《Redis设计与实现》前6章 + 实操练习

**2. 项目量化表达不足（影响 -8分）**
- 当前状态：项目成果描述偏主观，缺少数据支撑
- 行动计划：
  - 本周内完成：补充二手平台的并发数、响应时间、数据量等指标
  - 推荐格式：STAR法则 + 量化数据（如"优化查询性能，响应时间从500ms降至200ms"）

**建议提升（加分项）：**

**3. 微服务概念了解（影响 -5分）**
- 行动计划：用2-3周了解微服务基本概念，做一个简单的gRPC demo
- 优先级较低，先补齐Redis后再考虑""",

        "chapter_4_career_path": """## 职业路径规划

**推荐主路径：垂直晋升**

**阶段一：现在 → 后端开发工程师（初级）** 【0-6个月】
- 目标：拿到第一份后端开发offer
- 关键行动：补齐Redis、完善简历量化表达、准备算法面试
- 里程碑：通过技术面试、入职

**阶段二：后端开发（中级）** 【1-3年】
- 目标：独立负责模块设计和开发
- 能力要求：微服务架构、高并发系统设计、SQL调优
- 里程碑：独立负责一个核心服务

**阶段三：技术负责人** 【5年+】
- 目标：带领技术团队、参与架构决策
- 能力要求：系统架构设计、团队管理、跨部门沟通

**备选路径：横向转岗**
- **全栈工程师**（技能重叠72%）：补充React/Vue前端技能
- **数据工程师**（技能重叠62%）：补充Spark、Hive、数据管道经验""",

        "chapter_5_evaluation": """## 评估周期与指标

**建议每3个月自评一次**，对照以下检查清单：

**短期评估（1-3个月）：**
- [ ] 完成Redis基础学习并在项目中实践
- [ ] 简历更新：所有项目加入量化数据
- [ ] 完成一个包含Redis的side project
- [ ] 熟悉至少一种消息队列（如RabbitMQ）
- [ ] LeetCode刷题50+（中等难度为主）

**中期评估（3-12个月）：**
- [ ] 获得第一份后端开发相关实习或正式offer
- [ ] 独立完成一个完整的后端项目（含部署）
- [ ] 了解Docker容器化部署流程
- [ ] 参与一个开源项目的贡献

**动态调整建议：**
如果3个月后发现对数据处理更感兴趣，可以考虑转向数据工程方向；如果面试中频繁被问到前端知识，可以补充Vue/React基础，向全栈方向调整。

建议每半年重新上传简历，对比竞争力分数变化。""",
    }
}


async def get_existing_job_profile_ids(db, limit=5):
    """获取数据库中现有的 job_profile id"""
    result = await db.execute(
        text("SELECT id FROM job_profiles ORDER BY created_at LIMIT :limit"),
        {"limit": limit}
    )
    return [row[0] for row in result.fetchall()]


async def seed_demo_data():
    """写入演示数据"""
    async with async_session() as db:
        print("开始写入 Demo 数据...")

        # 1. 检查表是否存在
        try:
            await db.execute(text("SELECT 1 FROM students LIMIT 1"))
        except Exception as e:
            print(f"students 表不存在，请先运行 alembic upgrade head: {e}")
            return

        # 2. 获取一个现有的 job_profile_id 用于创建 match_result
        job_profile_ids = await get_existing_job_profile_ids(db, 1)
        if not job_profile_ids:
            print("警告: 数据库中没有 job_profiles，将跳过 match_results 创建")
            demo_job_profile_id = None
        else:
            demo_job_profile_id = job_profile_ids[0]
            print(f"  找到 job_profile_id: {demo_job_profile_id}")

        # 3. 写入学生和画像
        for student_data in DEMO_STUDENTS:
            sid = student_data["id"]
            student_email = student_data["email"]

            # 检查学生是否已存在
            existing = await db.execute(
                text("SELECT id FROM students WHERE email = :email"),
                {"email": student_email}
            )
            if existing.scalar():
                print(f"  学生 {student_data['name']} ({student_email}) 已存在，跳过")
                # 获取已存在学生的 id
                result = await db.execute(
                    text("SELECT id FROM students WHERE email = :email"),
                    {"email": student_email}
                )
                sid = result.scalar()
            else:
                # 插入学生基础记录
                await db.execute(
                    text("""
                        INSERT INTO students (id, email, name, phone, gender, job_intention, expected_salary_min, expected_salary_max)
                        VALUES (:id, :email, :name, :phone, :gender, :job_intention, :salary_min, :salary_max)
                    """),
                    {
                        "id": str(sid),
                        "email": student_email,
                        "name": student_data["name"],
                        "phone": student_data.get("phone"),
                        "gender": student_data.get("gender"),
                        "job_intention": student_data.get("job_intention"),
                        "salary_min": student_data.get("expected_salary_min"),
                        "salary_max": student_data.get("expected_salary_max"),
                    }
                )
                print(f"  创建学生 {student_data['name']} (ID: {sid})")

            await db.commit()

            # 获取 student_profile id（可能是刚创建的或已存在的）
            result = await db.execute(
                text("SELECT id FROM student_profiles WHERE student_id = :student_id"),
                {"student_id": str(sid)}
            )
            profile_row = result.scalar()

            # 写入学生画像 (profile_json)
            profile_json = json.dumps(student_data["profile"], ensure_ascii=False)

            if profile_row:
                # 更新现有画像 - 使用 CAST 语法避免与 SQLAlchemy 参数冲突
                await db.execute(
                    text("""
                        UPDATE student_profiles
                        SET profile_json = CAST(:profile AS JSONB),
                            completeness_score = :completeness,
                            updated_at = NOW()
                        WHERE student_id = :student_id
                    """),
                    {
                        "profile": profile_json,
                        "completeness": student_data["completeness_score"],
                        "student_id": str(sid),
                    }
                )
                print(f"  更新画像: {student_data['name']}")
            else:
                # 创建新画像
                profile_uuid = make_uuid(9000 + list(DEMO_STUDENTS).index(student_data) + 100)
                await db.execute(
                    text("""
                        INSERT INTO student_profiles (id, student_id, profile_json, completeness_score, version)
                        VALUES (:id, :student_id, CAST(:profile AS JSONB), :completeness, '1.0')
                    """),
                    {
                        "id": str(profile_uuid),
                        "student_id": str(sid),
                        "profile": profile_json,
                        "completeness": student_data["completeness_score"],
                    }
                )
                print(f"  创建画像: {student_data['name']}")

            await db.commit()

        # 4. 写入报告
        for sid_num, report_data in DEMO_REPORTS.items():
            student_id = make_uuid(sid_num)

            # 检查学生是否存在
            result = await db.execute(
                text("SELECT id FROM students WHERE id = :id"),
                {"id": str(student_id)}
            )
            if not result.scalar():
                print(f"  报告跳过: 学生 {sid_num} 不存在")
                continue

            # 构建 content_json
            content_json = {
                "target_job_name": report_data.get("target_job_name", ""),
                "match_score": report_data.get("match_score", 0),
                "chapter_1_summary": report_data.get("chapter_1_summary", ""),
                "chapter_2_job_analysis": report_data.get("chapter_2_job_analysis", ""),
                "chapter_3_gap_action": report_data.get("chapter_3_gap_action", ""),
                "chapter_4_career_path": report_data.get("chapter_4_career_path", ""),
                "chapter_5_evaluation": report_data.get("chapter_5_evaluation", ""),
            }

            report_uuid = uuid.uuid4()

            # 检查是否已有报告
            existing_report = await db.execute(
                text("SELECT id FROM career_reports WHERE student_id = :student_id"),
                {"student_id": str(student_id)}
            )
            if existing_report.scalar():
                # 更新现有报告
                await db.execute(
                    text("""
                        UPDATE career_reports
                        SET content_json = CAST(:content AS JSONB),
                            status = 'completed',
                            summary = :summary,
                            updated_at = NOW()
                        WHERE student_id = :student_id
                    """),
                    {
                        "content": json.dumps(content_json, ensure_ascii=False),
                        "summary": report_data.get("summary", ""),
                        "student_id": str(student_id),
                    }
                )
                print(f"  更新报告: 学生 {sid_num}")
            else:
                # 创建新报告
                await db.execute(
                    text("""
                        INSERT INTO career_reports (id, student_id, content_json, status, summary, version)
                        VALUES (:id, :student_id, CAST(:content AS JSONB), 'completed', :summary, '1.0')
                    """),
                    {
                        "id": str(report_uuid),
                        "student_id": str(student_id),
                        "content": json.dumps(content_json, ensure_ascii=False),
                        "summary": report_data.get("summary", ""),
                    }
                )
                print(f"  创建报告: 学生 {sid_num}")

            await db.commit()

        # 5. 写入匹配结果
        if demo_job_profile_id:
            for sid_num, match_data in DEMO_MATCHING_RESULTS.items():
                student_id = make_uuid(sid_num)

                # 获取 student_profile_id
                result = await db.execute(
                    text("SELECT id FROM student_profiles WHERE student_id = :student_id"),
                    {"student_id": str(student_id)}
                )
                student_profile_row = result.scalar()
                if not student_profile_row:
                    print(f"  匹配结果跳过: 学生 {sid_num} 的画像不存在")
                    continue

                match_uuid = uuid.uuid4()

                # 构建 scores_json 和 gaps_json
                scores_json = {
                    "basic": match_data["dimension_scores"].get("basic", 0),
                    "skill": match_data["dimension_scores"].get("skill", 0),
                    "soft": match_data["dimension_scores"].get("soft", 0),
                    "potential": match_data["dimension_scores"].get("potential", 0),
                }
                gaps_json = match_data.get("gap_items", [])

                # 检查是否已有匹配结果
                existing_match = await db.execute(
                    text("SELECT id FROM match_results WHERE student_profile_id = :sp_id AND job_profile_id = :jp_id"),
                    {"sp_id": str(student_profile_row), "jp_id": str(demo_job_profile_id)}
                )
                if existing_match.scalar():
                    # 更新
                    await db.execute(
                        text("""
                            UPDATE match_results
                            SET total_score = :total,
                                scores_json = CAST(:scores AS JSONB),
                                gaps_json = CAST(:gaps AS JSONB),
                                updated_at = NOW()
                            WHERE student_profile_id = :sp_id AND job_profile_id = :jp_id
                        """),
                        {
                            "total": match_data["overall_score"],
                            "scores": json.dumps(scores_json, ensure_ascii=False),
                            "gaps": json.dumps(gaps_json, ensure_ascii=False),
                            "sp_id": str(student_profile_row),
                            "jp_id": str(demo_job_profile_id),
                        }
                    )
                    print(f"  更新匹配结果: 学生 {sid_num}")
                else:
                    # 创建
                    await db.execute(
                        text("""
                            INSERT INTO match_results (id, student_profile_id, job_profile_id, total_score, scores_json, gaps_json, version)
                            VALUES (:id, :sp_id, :jp_id, :total, CAST(:scores AS JSONB), CAST(:gaps AS JSONB), '1.0')
                        """),
                        {
                            "id": str(match_uuid),
                            "sp_id": str(student_profile_row),
                            "jp_id": str(demo_job_profile_id),
                            "total": match_data["overall_score"],
                            "scores": json.dumps(scores_json, ensure_ascii=False),
                            "gaps": json.dumps(gaps_json, ensure_ascii=False),
                        }
                    )
                    print(f"  创建匹配结果: 学生 {sid_num}")

                await db.commit()

        print("\nDemo 数据写入完成！")
        print(f"  学生数: {len(DEMO_STUDENTS)}")
        print(f"  报告数: {len(DEMO_REPORTS)}")
        print(f"  匹配结果数: {len(DEMO_MATCHING_RESULTS)}")
        print("\n提示：演示时使用 student_id 结尾为 9001 (张明远) 作为主演示路线")


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
