"""Career report service - 职业规划报告生成核心服务.

采用分块生成策略：
1. generate_outline - 生成报告纲要
2. generate_chapters - 逐章节生成
3. merge_and_save - 合并与存储
4. polish_report - 智能润色
5. check_completeness - 完整性检查
6. export_to_pdf - 导出 PDF
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_provider import llm
from app.models.report import CareerReport, ReportVersion
from app.services.graph import find_path_with_student_profile
from app.services.matching import recommend_jobs

logger = logging.getLogger(__name__)

# 报告章节定义
REPORT_CHAPTERS = [
    {
        "chapter_id": 1,
        "title": "个人画像分析",
        "description": "基于简历解析的学生四维画像分析",
        "sections": ["基本条件", "专业技能", "软性素养", "成长潜力"],
    },
    {
        "chapter_id": 2,
        "title": "目标岗位分析",
        "description": "推荐岗位的岗位画像和要求分析",
        "sections": ["岗位基本信息", "技能要求", "素养要求", "发展通道"],
    },
    {
        "chapter_id": 3,
        "title": "人岗匹配评估",
        "description": "四维度人岗匹配评分和差距分析",
        "sections": ["基础要求匹配", "技能匹配度", "职业素养评估", "发展潜力评估", "综合评分"],
    },
    {
        "chapter_id": 4,
        "title": "能力差距与提升建议",
        "description": "基于差距分析的能力提升建议",
        "sections": ["技能差距清单", "素养提升建议", "行动计划", "学习资源推荐"],
    },
    {
        "chapter_id": 5,
        "title": "职业发展规划",
        "description": "基于图谱的职业发展路径规划",
        "sections": ["当前定位", "晋升路径", "转岗路径", "行动计划时间表"],
    },
]

REPORT_LLM_TIMEOUT_SECONDS = 20.0


def _extract_report_role(matching_results: list[dict[str, Any]]) -> str:
    if not matching_results:
        return "目标岗位"
    job_info = matching_results[0].get("scores_json", {}).get("job_info", {})
    return str(job_info.get("role") or job_info.get("title") or "目标岗位")


def _extract_report_score(matching_results: list[dict[str, Any]]) -> int:
    if not matching_results:
        return 0
    raw_score = matching_results[0].get("total_score", 0)
    score = float(raw_score or 0)
    if score <= 1:
        score *= 100
    return round(score)


def _build_fallback_chapter(
    chapter: dict[str, Any],
    student_profile: dict[str, Any],
    matching_results: list[dict[str, Any]],
    career_path: dict[str, Any] | None,
) -> dict[str, Any]:
    basic_info = student_profile.get("basic_info") or {}
    role_name = _extract_report_role(matching_results)
    match_score = _extract_report_score(matching_results)
    action_plan = career_path.get("action_plan") if isinstance(career_path, dict) else []
    first_action = ""
    if isinstance(action_plan, list) and action_plan:
        first_action = str(
            action_plan[0].get("action")
            or action_plan[0].get("title")
            or action_plan[0].get("content")
            or ""
        )

    section_title = (chapter.get("sections") or ["核心结论"])[0]
    summary = (
        f"当前学生画像已完成基础分析，建议优先关注“{role_name}”方向，"
        f"当前匹配度约为 {match_score} 分。"
    )
    if basic_info.get("school") or basic_info.get("major"):
        summary += (
            f" 当前背景为 {basic_info.get('school') or '在校经历'}"
            f"{(' / ' + str(basic_info.get('major'))) if basic_info.get('major') else ''}。"
        )
    if first_action:
        summary += f" 下一步建议先执行：{first_action}。"

    return {
        "chapter_id": chapter.get("chapter_id", 0),
        "title": chapter.get("title", ""),
        "sections": [
            {
                "title": section_title,
                "content": summary,
                "key_points": [
                    f"目标岗位：{role_name}",
                    f"综合匹配：{match_score} 分",
                    first_action or "建议结合画像缺口继续补全项目、技能与证书信息",
                ],
            }
        ],
        "tables": [],
        "charts": [],
    }

# Prompt 模板
OUTLINE_SYSTEM_PROMPT = """你是一个专业的职业规划分析师，擅长生成结构化的职业发展报告。

请根据以下信息生成报告纲要 JSON。"""

OUTLINE_USER_PROMPT = """请根据以下学生画像、匹配结果和职业路径信息，生成一份职业规划报告的纲要。

## 学生画像（JSON）
{student_profile}

## 匹配结果（JSON）
{matching_results}

## 职业路径（JSON）
{career_path}

请生成以下结构的 JSON 报告纲要：
{{
    "title": "大学生职业规划报告",
    "chapters": [
        {{
            "chapter_id": 1,
            "title": "个人画像分析",
            "description": "...",
            "sections": ["基本条件", "专业技能", "软性素养", "成长潜力"]
        }}
    ],
    "estimated_length": "约5000字"
}}

只需要输出 JSON，不要其他文字。"""

CHAPTER_SYSTEM_PROMPT = """你是一个专业的职业规划分析师，擅长生成详实的职业发展报告内容。

请根据提供的信息生成专业的报告章节内容。"""

CHAPTER_USER_PROMPT = """请为职业规划报告生成第 {chapter_id} 章的内容。

## 章节信息
- 标题：{title}
- 描述：{description}
- 小节：{sections}

## 学生画像（JSON）
{student_profile}

## 匹配结果（JSON）
{matching_results}

## 职业路径（JSON）
{career_path}

请生成以下结构的 JSON 内容：
{{
    "title": "章节标题",
    "sections": [
        {{
            "title": "小节标题",
            "content": "小节内容（详细的分析和阐述）",
            "key_points": ["要点1", "要点2"]
        }}
    ],
    "tables": [
        {{
            "title": "表格标题",
            "headers": ["列1", "列2"],
            "rows": [["数据1", "数据2"]]
        }}
    ],
    "charts": [
        {{
            "type": "radar|bar|line|table",
            "title": "图表标题",
            "data": {{}}
        }}
    ]
}}

只需要输出 JSON，不要其他文字。"""

POLISH_SYSTEM_PROMPT = """你是一个专业的文字编辑，擅长润色和改写文章。

你的任务是只改写报告的措辞和表达方式，使其更加专业、流畅、易读。
**重要**：不要改变任何事实数据、分数、建议等实质性内容。
只优化语言表达，保持原意不变。"""

POLISH_USER_PROMPT = """请润色以下职业规划报告内容，只改写措辞，不改变任何事实数据。

## 原始报告
{original_report}

请返回润色后的版本，格式为：
{{
    "polished_content": "润色后的完整报告内容",
    "changes": ["修改点1描述", "修改点2描述"]
}}

只需要输出 JSON，不要其他文字。"""

# PDF 模板目录
PDF_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "static", "exports")


async def generate_outline(
    student_profile: dict[str, Any],
    matching_results: list[dict[str, Any]],
    career_path: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """生成报告纲要.

    Args:
        student_profile: 学生画像数据
        matching_results: 匹配结果列表
        career_path: 职业路径规划数据

    Returns:
        {"chapters": [...]}
    """
    # 序列化数据用于 prompt
    profile_str = json.dumps(student_profile, ensure_ascii=False, indent=2)
    matching_str = json.dumps(matching_results[:5], ensure_ascii=False, indent=2)  # 只取前5个
    path_str = json.dumps(career_path or {}, ensure_ascii=False, indent=2)

    prompt = OUTLINE_USER_PROMPT.format(
        student_profile=profile_str,
        matching_results=matching_str,
        career_path=path_str,
    )

    try:
        result = await asyncio.wait_for(
            llm.generate_json(
                prompt=prompt,
                system_prompt=OUTLINE_SYSTEM_PROMPT,
                temperature=0.3,
            ),
            timeout=REPORT_LLM_TIMEOUT_SECONDS,
        )

        # 确保有 chapters 字段
        if "chapters" not in result:
            result["chapters"] = REPORT_CHAPTERS

        logger.info("Generated report outline with %d chapters", len(result.get("chapters", [])))
        return result

    except Exception as e:
        logger.error("Failed to generate outline: %s", e)
        # 返回默认章节结构
        return {
            "title": "大学生职业规划报告",
            "chapters": REPORT_CHAPTERS,
            "estimated_length": "约5000字",
            "generated_by": "fallback",
        }


async def generate_chapters(
    outline: dict[str, Any],
    student_profile: dict[str, Any],
    matching_results: list[dict[str, Any]],
    career_path: dict[str, Any] | None,
    db: AsyncSession,
) -> list[dict[str, Any]]:
    """逐章节生成报告内容.

    Args:
        outline: 报告纲要
        student_profile: 学生画像数据
        matching_results: 匹配结果列表
        career_path: 职业路径规划数据
        db: 数据库会话

    Returns:
        每章节的生成内容列表
    """
    chapters = outline.get("chapters", REPORT_CHAPTERS)
    chapter_contents: list[dict[str, Any]] = []

    if outline.get("generated_by") == "fallback":
        return [
            _build_fallback_chapter(chapter, student_profile, matching_results, career_path)
            for chapter in chapters
        ]

    # 序列化数据
    profile_str = json.dumps(student_profile, ensure_ascii=False, indent=2)
    matching_str = json.dumps(matching_results[:5], ensure_ascii=False, indent=2)
    path_str = json.dumps(career_path or {}, ensure_ascii=False, indent=2)

    # 逐章节生成
    for chapter in chapters:
        chapter_id = chapter.get("chapter_id", 1)
        title = chapter.get("title", "")
        description = chapter.get("description", "")
        sections = chapter.get("sections", [])

        prompt = CHAPTER_USER_PROMPT.format(
            chapter_id=chapter_id,
            title=title,
            description=description,
            sections=json.dumps(sections, ensure_ascii=False),
            student_profile=profile_str,
            matching_results=matching_str,
            career_path=path_str,
        )

        try:
            result = await asyncio.wait_for(
                llm.generate_json(
                    prompt=prompt,
                    system_prompt=CHAPTER_SYSTEM_PROMPT,
                    temperature=0.5,
                    max_tokens=4000,
                ),
                timeout=REPORT_LLM_TIMEOUT_SECONDS,
            )

            # 确保基本结构
            chapter_content = {
                "chapter_id": chapter_id,
                "title": result.get("title", title),
                "sections": result.get("sections", []),
                "tables": result.get("tables", []),
                "charts": result.get("charts", []),
            }

            chapter_contents.append(chapter_content)
            logger.info("Generated chapter %d: %s", chapter_id, title)

        except Exception as e:
            logger.error("Failed to generate chapter %d: %s", chapter_id, e)
            chapter_contents.append(
                _build_fallback_chapter(chapter, student_profile, matching_results, career_path)
            )

    return chapter_contents


async def merge_and_save(
    student_id: UUID,
    report_data: dict[str, Any],
    db: AsyncSession,
) -> CareerReport:
    """合并与存储报告.

    Args:
        student_id: 学生 ID
        report_data: 报告数据（包含 outline 和 chapters）
        db: 数据库会话

    Returns:
        生成的 CareerReport 对象
    """
    # 合并所有章节为完整报告
    outline = report_data.get("outline", {})
    chapters = report_data.get("chapters", [])
    matching_results = report_data.get("matching_results", [])

    # 生成摘要
    summary = _generate_summary(chapters, matching_results)

    # 生成推荐建议
    recommendations = _generate_recommendations(report_data)

    # 构建报告 JSON
    content_json = {
        "outline": outline,
        "chapters": chapters,
        "matching_results": matching_results,
        "metadata": {
            "generated_at": datetime.utcnow().isoformat(),
            "student_id": str(student_id),
            "version": "1.0",
        },
    }

    # 查询是否已有报告
    stmt = select(CareerReport).where(CareerReport.student_id == student_id)
    result = await db.execute(stmt)
    existing_report = result.scalar_one_or_none()

    if existing_report:
        # 更新现有报告
        existing_report.content_json = content_json
        existing_report.summary = summary
        existing_report.recommendations = recommendations
        existing_report.status = "completed"
        existing_report.updated_at = datetime.utcnow()

        # 版本递增
        try:
            ver = float(existing_report.version)
            existing_report.version = f"{ver + 0.1:.1f}"
        except (ValueError, TypeError):
            existing_report.version = "1.1"

        report = existing_report
    else:
        # 创建新报告
        report = CareerReport(
            student_id=student_id,
            content_json=content_json,
            summary=summary,
            recommendations=recommendations,
            status="completed",
            version="1.0",
        )
        db.add(report)

    await db.flush()
    await db.refresh(report)

    # 创建版本快照
    version = ReportVersion(
        report_id=report.id,
        version=report.version,
        content=content_json,
        change_notes="初始版本",
    )
    db.add(version)

    await db.commit()

    logger.info("Saved career report for student %s, version %s", student_id, report.version)
    return report


def _generate_summary(
    chapters: list[dict[str, Any]],
    matching_results: list[dict[str, Any]],
) -> str:
    """生成报告摘要."""
    if not matching_results:
        return "暂无匹配结果"

    # 从第一章获取基本信息
    if chapters and len(chapters) > 0:
        first_chapter = chapters[0]
        if first_chapter.get("sections"):
            first_section = first_chapter["sections"][0]
            return first_section.get("content", "")[:200] + "..."

    # 从匹配结果生成
    top_match = matching_results[0] if matching_results else None
    if top_match:
        score = top_match.get("total_score", 0) * 100
        job_info = top_match.get("scores_json", {}).get("job_info", {})
        job_title = job_info.get("title", "目标岗位")
        return f"与 {job_title} 的综合匹配度为 {score:.1f} 分，建议针对差距进行针对性提升。"

    return "职业规划报告已生成。"


def _generate_recommendations(report_data: dict[str, Any]) -> list[dict[str, Any]]:
    """生成推荐建议列表."""
    recommendations: list[dict[str, Any]] = []
    matching_results = report_data.get("matching_results", [])
    career_path = report_data.get("career_path", {})

    # 基于匹配结果生成建议
    if matching_results:
        top_match = matching_results[0]
        scores_json = top_match.get("scores_json", {})
        total_score = scores_json.get("total_score", 0)

        if total_score >= 80:
            recommendations.append({
                "type": "positive",
                "title": "匹配度高",
                "content": "您与推荐岗位的匹配度较高，建议继续保持并提升核心竞争力。",
            })
        elif total_score >= 60:
            recommendations.append({
                "type": "improvement",
                "title": "需要提升",
                "content": "建议针对差距项进行针对性提升，补齐能力短板。",
            })
        else:
            recommendations.append({
                "type": "warning",
                "title": "差距较大",
                "content": "建议重新评估目标岗位，或先积累相关经验后再投递。",
            })

    # 基于职业路径生成建议
    if career_path:
        action_plan = career_path.get("action_plan", [])
        if action_plan:
            recommendations.append({
                "type": "action",
                "title": "行动计划",
                "content": f"建议按照职业路径规划逐步推进，共 {len(action_plan)} 个步骤。",
            })

    return recommendations


async def polish_report(report_id: UUID, db: AsyncSession) -> dict[str, Any]:
    """智能润色报告.

    Args:
        report_id: 报告 ID
        db: 数据库会话

    Returns:
        {"polished": bool, "changes": [...], "version": "..."}
    """
    # 加载报告
    report = await db.get(CareerReport, report_id)
    if not report:
        raise ValueError(f"Report {report_id} not found")

    # 序列化原始内容
    original_content = json.dumps(report.content_json, ensure_ascii=False, indent=2)

    prompt = POLISH_USER_PROMPT.format(original_report=original_content)

    try:
        result = await llm.generate_json(
            prompt=prompt,
            system_prompt=POLISH_SYSTEM_PROMPT,
            temperature=0.3,
        )

        polished_content_str = result.get("polished_content", original_content)
        changes = result.get("changes", [])

        # 解析润色后的内容
        try:
            polished_json = json.loads(polished_content_str)
        except json.JSONDecodeError:
            # 如果不是 JSON，保留原结构只更新文本字段
            polished_json = report.content_json

        # 创建新版本
        version_num = _increment_version(report.version)

        # 保存润色版本
        polished_version = ReportVersion(
            report_id=report.id,
            version=version_num,
            content=polished_json,
            change_notes=f"润色版本：{', '.join(changes[:3])}" if changes else "语言润色",
        )
        db.add(polished_version)

        # 更新报告
        report.content_json = polished_json
        report.version = version_num
        report.updated_at = datetime.utcnow()

        await db.commit()

        logger.info("Polished report %s to version %s", report_id, version_num)

        return {
            "polished": True,
            "changes": changes,
            "version": version_num,
        }

    except Exception as e:
        logger.error("Failed to polish report %s: %s", report_id, e)
        return {
            "polished": False,
            "changes": [],
            "error": str(e),
        }


def _increment_version(current: str) -> str:
    """递增版本号."""
    try:
        ver = float(current)
        return f"{ver + 0.1:.1f}"
    except (ValueError, TypeError):
        return "1.1"


async def check_completeness(report_id: UUID, db: AsyncSession) -> dict[str, Any]:
    """检查报告完整性.

    Args:
        report_id: 报告 ID
        db: 数据库会话

    Returns:
        {"complete": bool, "missing_items": [...], "suggestions": [...]}
    """
    report = await db.get(CareerReport, report_id)
    if not report:
        raise ValueError(f"Report {report_id} not found")

    content = report.content_json or {}
    chapters = content.get("chapters", [])

    missing_items: list[str] = []
    suggestions: list[str] = []

    # 检查章节完整性
    expected_chapters = 5
    if len(chapters) < expected_chapters:
        missing_items.append(f"报告章节不完整：只有 {len(chapters)} 章，预期 {expected_chapters} 章")
        suggestions.append("建议重新生成完整报告")

    # 检查每章内容
    for i, chapter in enumerate(chapters):
        chapter_id = chapter.get("chapter_id", i + 1)
        title = chapter.get("title", "")

        # 检查小节
        sections = chapter.get("sections", [])
        if not sections:
            missing_items.append(f"第{chapter_id}章 '{title}' 没有内容")
            suggestions.append(f"补充第{chapter_id}章详细内容")

        # 检查表格
        tables = chapter.get("tables", [])
        if not tables and chapter_id in [3, 4]:  # 匹配和差距章节应该有表格
            suggestions.append(f"建议为第{chapter_id}章添加数据表格")

        # 检查图表
        charts = chapter.get("charts", [])
        if not charts and chapter_id in [1, 3]:  # 画像和匹配章节应该有图表
            suggestions.append(f"建议为第{chapter_id}章添加可视化图表")

    # 检查元信息
    if not report.summary:
        missing_items.append("报告缺少摘要")
        suggestions.append("补充执行摘要")

    if not report.recommendations:
        missing_items.append("报告缺少推荐建议")
        suggestions.append("添加具体的行动建议")

    # 检查职业路径
    career_path = content.get("outline", {}).get("career_path") or content.get("career_path")
    if not career_path:
        missing_items.append("报告缺少职业路径规划")
        suggestions.append("生成职业发展路径规划")

    is_complete = len(missing_items) == 0

    return {
        "complete": is_complete,
        "missing_items": missing_items,
        "suggestions": suggestions,
        "chapter_count": len(chapters),
    }


async def export_to_pdf(report_id: UUID, db: AsyncSession) -> str:
    """导出 PDF 报告.

    Args:
        report_id: 报告 ID
        db: 数据库会话

    Returns:
        PDF 文件路径
    """
    # 尝试导入 weasyprint
    try:
        from weasyprint import HTML
    except ImportError:
        logger.warning("weasyprint not installed, using basic HTML export")
        return await _export_to_html(report_id, db)

    # 加载报告
    report = await db.get(CareerReport, report_id)
    if not report:
        raise ValueError(f"Report {report_id} not found")

    content = report.content_json or {}

    # 生成 HTML 内容
    html_content = _build_export_html(report, content)

    # 确保输出目录存在
    os.makedirs(PDF_OUTPUT_DIR, exist_ok=True)

    # 生成文件名
    filename = f"career_report_{report.student_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.pdf"
    pdf_path = os.path.join(PDF_OUTPUT_DIR, filename)

    # 转换 PDF
    try:
        HTML(string=html_content).write_pdf(pdf_path)
        logger.info("Exported PDF to %s", pdf_path)
    except Exception as e:
        logger.error("Failed to generate PDF: %s", e)
        # 回退到 HTML
        html_path = pdf_path.replace(".pdf", ".html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        return html_path

    # 更新报告的 PDF 路径
    report.pdf_path = pdf_path
    await db.commit()

    return pdf_path


async def _export_to_html(report_id: UUID, db: AsyncSession) -> str:
    """导出 HTML 报告（备选方案）。"""
    report = await db.get(CareerReport, report_id)
    if not report:
        raise ValueError(f"Report {report_id} not found")

    content = report.content_json or {}
    html_content = _build_export_html(report, content)

    # 确保输出目录存在
    os.makedirs(PDF_OUTPUT_DIR, exist_ok=True)

    # 生成文件名
    filename = f"career_report_{report.student_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.html"
    html_path = os.path.join(PDF_OUTPUT_DIR, filename)

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    # 更新报告的 PDF 路径（实际上是 HTML）
    report.pdf_path = html_path
    await db.commit()

    return html_path


def _generate_pdf_html(report: CareerReport, content: dict[str, Any]) -> str:
    """生成 PDF/HTML 内容."""
    chapters = content.get("chapters", [])
    summary = report.summary or ""

    # 生成章节 HTML
    chapters_html = ""
    for chapter in chapters:
        title = chapter.get("title", "")
        sections = chapter.get("sections", [])

        sections_html = ""
        for section in sections:
            section_title = section.get("title", "")
            section_content = section.get("content", "")
            key_points = section.get("key_points", [])

            points_html = ""
            if key_points:
                points_html = "<ul>" + "".join(f"<li>{p}</li>" for p in key_points) + "</ul>"

            sections_html += f"""
            <div class="section">
                <h3>{section_title}</h3>
                <p>{section_content}</p>
                {points_html}
            </div>
            """

        # 生成表格 HTML
        tables_html = ""
        for table in chapter.get("tables", []):
            table_title = table.get("title", "")
            headers = table.get("headers", [])
            rows = table.get("rows", [])

            header_cells = "".join(f"<th>{h}</th>" for h in headers)
            body_rows = ""
            for row in rows:
                body_rows += "<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>"

            tables_html += f"""
            <div class="table-container">
                <h4>{table_title}</h4>
                <table>
                    <thead><tr>{header_cells}</tr></thead>
                    <tbody>{body_rows}</tbody>
                </table>
            </div>
            """

        chapters_html += f"""
        <div class="chapter">
            <h2>{title}</h2>
            {sections_html}
            {tables_html}
        </div>
        """

    # 生成雷达图数据
    radar_chart = _generate_radar_chart_data(content)

    # 生成推荐建议 HTML
    recommendations_html = ""
    if report.recommendations:
        for rec in report.recommendations:
            rec_type = rec.get("type", "")
            rec_title = rec.get("title", "")
            rec_content = rec.get("content", "")
            recommendations_html += f'<div class="recommendation-item"><strong>{rec_title}</strong>: {rec_content}</div>'

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>职业规划报告</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }}
        h1 {{
            color: #1a73e8;
            text-align: center;
            border-bottom: 2px solid #1a73e8;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #333;
            margin-top: 30px;
            border-left: 4px solid #1a73e8;
            padding-left: 10px;
        }}
        h3 {{
            color: #555;
            margin-top: 20px;
        }}
        h4 {
            color: #666;
            margin-top: 15px;
        }
        .summary {
            background: #f5f5f5;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .chapter {{
            margin-bottom: 40px;
        }}
        .section {{
            margin-bottom: 15px;
        }}
        .section p {{
            text-indent: 2em;
            margin: 10px 0;
        }}
        ul {{
            margin-left: 20px;
        }}
        li {{
            margin: 5px 0;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }}
        th {{
            background: #f5f5f5;
        }}
        .chart-container {{
            text-align: center;
            margin: 20px 0;
        }}
        .recommendations {{
            background: #e8f0fe;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }}
        .recommendation-item {{
            margin: 10px 0;
            padding: 10px;
            background: white;
            border-radius: 3px;
        }}
        .footer {{
            text-align: center;
            color: #999;
            margin-top: 40px;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <h1>大学生职业规划报告</h1>

    <div class="summary">
        <h3>报告摘要</h3>
        <p>{summary}</p>
    </div>

    {chapters_html}

    <div class="recommendations">
        <h3>推荐建议</h3>
        {recommendations_html}
    </div>

    {radar_chart}

    <div class="footer">
        <p>报告生成时间：{report.created_at.strftime("%Y-%m-%d %H:%M:%S") if report.created_at else "未知"}</p>
        <p>版本：{report.version}</p>
    </div>
</body>
</html>"""

    return html


def _generate_radar_chart_data(content: dict[str, Any]) -> str:
    """生成雷达图 HTML（使用 Chart.js）。"""
    chapters = content.get("chapters", [])

    # 从第三章（匹配评估）提取评分数据
    matching_chapter = None
    for chapter in chapters:
        if chapter.get("chapter_id") == 3:
            matching_chapter = chapter
            break

    if not matching_chapter:
        return ""

    # 尝试从章节内容提取评分
    radar_data = {
        "labels": ["基础要求", "技能匹配", "职业素养", "发展潜力"],
        "values": [0, 0, 0, 0],
    }

    # 这里可以进一步从章节内容解析实际评分
    # 目前返回空的雷达图容器

    return f"""
    <div class="chart-container">
        <h3>能力雷达图</h3>
        <canvas id="radarChart" width="400" height="400"></canvas>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script>
            const ctx = document.getElementById('radarChart');
            new Chart(ctx, {{
                type: 'radar',
                data: {{
                    labels: {json.dumps(radar_data['labels'])},
                    datasets: [{{
                        label: '能力评估',
                        data: {json.dumps(radar_data['values'])},
                        backgroundColor: 'rgba(26, 115, 232, 0.2)',
                        borderColor: 'rgba(26, 115, 232, 1)',
                        borderWidth: 2
                    }}]
                }},
                options: {{
                    scales: {{
                        r: {{
                            min: 0,
                            max: 100
                        }}
                    }}
                }}
            }});
        </script>
    </div>
    """


def _build_export_html(report: CareerReport, content: dict[str, Any]) -> str:
    """Build safe HTML content for PDF and HTML export."""
    chapters = content.get("chapters", [])
    summary = report.summary or ""
    generated_at = (
        report.created_at.strftime("%Y-%m-%d %H:%M:%S")
        if report.created_at
        else "Unknown"
    )

    chapter_blocks: list[str] = []
    for chapter in chapters:
        section_blocks: list[str] = []
        for section in chapter.get("sections", []):
            key_points = section.get("key_points", [])
            points_html = ""
            if key_points:
                points_html = "<ul>" + "".join(f"<li>{point}</li>" for point in key_points) + "</ul>"

            section_blocks.append(
                f"""
                <div class="section">
                    <h3>{section.get("title", "")}</h3>
                    <p>{section.get("content", "")}</p>
                    {points_html}
                </div>
                """
            )

        table_blocks: list[str] = []
        for table in chapter.get("tables", []):
            header_cells = "".join(f"<th>{header}</th>" for header in table.get("headers", []))
            body_rows = "".join(
                "<tr>" + "".join(f"<td>{cell}</td>" for cell in row) + "</tr>"
                for row in table.get("rows", [])
            )
            table_blocks.append(
                f"""
                <div class="table-container">
                    <h4>{table.get("title", "")}</h4>
                    <table>
                        <thead><tr>{header_cells}</tr></thead>
                        <tbody>{body_rows}</tbody>
                    </table>
                </div>
                """
            )

        chapter_blocks.append(
            f"""
            <div class="chapter">
                <h2>{chapter.get("title", "")}</h2>
                {''.join(section_blocks)}
                {''.join(table_blocks)}
            </div>
            """
        )

    recommendations_html = "".join(
        f'<div class="recommendation-item"><strong>{rec.get("title", "")}</strong>: {rec.get("content", "")}</div>'
        for rec in (report.recommendations or [])
    )

    chart_html = _build_export_chart_html(content)

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>职业规划报告</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }}
        h1 {{
            color: #1a73e8;
            text-align: center;
            border-bottom: 2px solid #1a73e8;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #333;
            margin-top: 30px;
            border-left: 4px solid #1a73e8;
            padding-left: 10px;
        }}
        h3 {{
            color: #555;
            margin-top: 20px;
        }}
        h4 {{
            color: #666;
            margin-top: 15px;
        }}
        .summary {{
            background: #f5f5f5;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }}
        .chapter {{
            margin-bottom: 40px;
        }}
        .section {{
            margin-bottom: 15px;
        }}
        .section p {{
            text-indent: 2em;
            margin: 10px 0;
        }}
        ul {{
            margin-left: 20px;
        }}
        li {{
            margin: 5px 0;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            vertical-align: top;
        }}
        th {{
            background: #f5f5f5;
        }}
        .chart-container {{
            margin: 20px 0;
            padding: 16px;
            background: #fafafa;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
        }}
        .chart-row {{
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 10px 0;
        }}
        .chart-label {{
            width: 120px;
            flex-shrink: 0;
            font-weight: 600;
        }}
        .chart-bar {{
            flex: 1;
            height: 10px;
            background: #e5e7eb;
            border-radius: 999px;
            overflow: hidden;
        }}
        .chart-fill {{
            height: 100%;
            background: linear-gradient(90deg, #60a5fa, #2563eb);
        }}
        .chart-value {{
            width: 48px;
            text-align: right;
            color: #4b5563;
            font-size: 12px;
        }}
        .recommendations {{
            background: #e8f0fe;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }}
        .recommendation-item {{
            margin: 10px 0;
            padding: 10px;
            background: white;
            border-radius: 3px;
        }}
        .footer {{
            text-align: center;
            color: #999;
            margin-top: 40px;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <h1>大学生职业规划报告</h1>

    <div class="summary">
        <h3>报告摘要</h3>
        <p>{summary}</p>
    </div>

    {''.join(chapter_blocks)}

    <div class="recommendations">
        <h3>推荐建议</h3>
        {recommendations_html}
    </div>

    {chart_html}

    <div class="footer">
        <p>报告生成时间：{generated_at}</p>
        <p>版本：{report.version}</p>
    </div>
</body>
</html>"""


def _normalize_dimension_score(value: Any) -> int:
    """Normalize a dimension score to a 0-100 integer."""

    try:
        score = float(value or 0)
    except (TypeError, ValueError):
        return 0

    if score <= 1:
        score *= 100
    return max(0, min(100, round(score)))


def _build_export_chart_html(content: dict[str, Any]) -> str:
    """Render a simple static score block for exported reports."""
    matching_results = content.get("matching_results")
    if not isinstance(matching_results, list):
        metadata = content.get("metadata") or {}
        matching_results = metadata.get("matching_results")

    if not isinstance(matching_results, list) or not matching_results:
        return ""

    top_match = matching_results[0] or {}
    scores_json = top_match.get("scores_json") or {}
    chart_data = [
        ("基础要求", 0),
        ("技能匹配", 0),
        ("职业素养", 0),
        ("发展潜力", 0),
    ]

    chart_data = [
        ("基础要求", _normalize_dimension_score((scores_json.get("basic") or {}).get("score"))),
        ("技能匹配", _normalize_dimension_score((scores_json.get("skill") or {}).get("score"))),
        ("职业素养", _normalize_dimension_score((scores_json.get("competency") or {}).get("score"))),
        ("发展潜力", _normalize_dimension_score((scores_json.get("potential") or {}).get("score"))),
    ]

    rows_html = "".join(
        f"""
        <div class="chart-row">
            <div class="chart-label">{label}</div>
            <div class="chart-bar"><div class="chart-fill" style="width: {value}%"></div></div>
            <div class="chart-value">{value}</div>
        </div>
        """
        for label, value in chart_data
    )

    return f"""
    <div class="chart-container">
        <h3>能力概览</h3>
        {rows_html}
    </div>
    """


async def generate_full_report(
    student_id: UUID,
    db: AsyncSession,
    target_job_ids: list[UUID] | None = None,
) -> CareerReport:
    """完整报告生成流程.

    整合所有服务生成完整职业规划报告。

    Args:
        student_id: 学生 ID
        db: 数据库会话
        target_job_ids: 目标岗位 ID 列表（可选）

    Returns:
        生成的 CareerReport 对象
    """
    from app.models.student import StudentProfile
    from app.services.matching import match_student_job

    # 1. 优先复用已有画像，避免报告链路重复触发整套画像重算
    existing_profile = (
        await db.execute(select(StudentProfile).where(StudentProfile.student_id == student_id))
    ).scalars().first()
    if existing_profile and existing_profile.profile_json:
        student_profile = existing_profile.profile_json
    else:
        from app.services.student_profile import generate_student_profile

        profile_result = await generate_student_profile(student_id, db)
        student_profile = profile_result["profile"].profile_json

    # 2. 获取匹配结果
    if target_job_ids:
        matching_results = []
        for job_id in target_job_ids:
            try:
                match_result = await match_student_job(
                    db,
                    student_id,
                    job_id,
                    mode="deep",
                )
                matching_results.append({
                    "job_id": str(job_id),
                    "total_score": match_result.total_score,
                    "scores_json": match_result.scores_json,
                    "gaps_json": match_result.gaps_json,
                })
            except Exception as e:
                logger.warning("Match failed for job %s: %s", job_id, e)
    else:
        # 先复用稳定推荐结果，只对榜首岗位做一次深评兜底
        match_results = await recommend_jobs(db, student_id, top_k=10)
        deep_refresh_count = min(1, len(match_results))
        refreshed_results = []
        for index, match_result in enumerate(match_results):
            current_result = match_result
            if index < deep_refresh_count:
                try:
                    current_result = await match_student_job(
                        db,
                        student_id,
                        match_result.job_profile_id,
                        mode="deep",
                    )
                except Exception as e:
                    logger.warning("Deep match refresh failed for job %s: %s", match_result.job_profile_id, e)
            refreshed_results.append(current_result)

        refreshed_results.sort(key=lambda item: item.total_score, reverse=True)
        matching_results = [
            {
                "job_id": str(mr.job_profile_id),
                "total_score": mr.total_score,
                "scores_json": mr.scores_json,
                "gaps_json": mr.gaps_json,
            }
            for mr in refreshed_results
        ]

    # 3. 获取职业路径
    career_path = None
    if matching_results:
        top_job = matching_results[0]
        # 从 scores_json 提取目标岗位信息
        job_info = top_job.get("scores_json", {}).get("job_info", {})
        target_role = job_info.get("role", "软件工程师")
        career_path = await find_path_with_student_profile(
            db, student_profile, target_role, "expert"
        )

    # 4. 生成报告纲要
    outline = await generate_outline(student_profile, matching_results, career_path)

    # 5. 逐章节生成
    chapters = await generate_chapters(
        outline, student_profile, matching_results, career_path, db
    )

    # 6. 合并与存储
    report_data = {
        "outline": outline,
        "chapters": chapters,
        "matching_results": matching_results,
        "career_path": career_path,
    }

    report = await merge_and_save(student_id, report_data, db)

    return report


# 保留原有的接口以兼容
async def generate_report(
    student_id: UUID,
    db: AsyncSession,
    job_ids: list[UUID] | None = None,
) -> dict[str, Any]:
    """Generate career report for a student.

    Args:
        student_id: The student ID
        db: 数据库会话
        job_ids: Optional list of job IDs to include in report

    Returns:
        Generated report data
    """
    report = await generate_full_report(student_id, db, job_ids)
    return {
        "id": str(report.id),
        "student_id": str(report.student_id),
        "version": report.version,
        "summary": report.summary,
        "status": report.status,
    }


async def export_to_docx(report_id: UUID, db: AsyncSession) -> str:
    """Export report to DOCX format.

    Args:
        report_id: The report ID
        db: 数据库会话

    Returns:
        Path to exported DOCX file
    """
    # 尝试导入 python-docx
    try:
        from docx import Document
    except ImportError:
        logger.warning("python-docx not installed")
        return await _export_to_html(report_id, db)

    # 加载报告
    report = await db.get(CareerReport, report_id)
    if not report:
        raise ValueError(f"Report {report_id} not found")

    content = report.content_json or {}

    # 创建 Word 文档
    doc = Document()
    doc.add_heading("大学生职业规划报告", 0)

    # 添加摘要
    if report.summary:
        doc.add_heading("报告摘要", 1)
        doc.add_paragraph(report.summary)

    # 添加章节
    chapters = content.get("chapters", [])
    for chapter in chapters:
        title = chapter.get("title", "")
        doc.add_heading(title, 1)

        for section in chapter.get("sections", []):
            section_title = section.get("title", "")
            section_content = section.get("content", "")

            doc.add_heading(section_title, 2)
            doc.add_paragraph(section_content)

            # 添加要点
            for point in section.get("key_points", []):
                doc.add_paragraph(point, style="List Bullet")

        # 添加表格
        for table in chapter.get("tables", []):
            table_title = table.get("title", "")
            headers = table.get("headers", [])
            rows = table.get("rows", [])

            doc.add_heading(table_title, 2)
            t = doc.add_table(rows=len(rows) + 1, cols=len(headers))
            t.style = "Light Grid Accent 1"

            # 表头
            for i, header in enumerate(headers):
                t.rows[0].cells[i].text = header

            # 数据行
            for i, row in enumerate(rows):
                for j, cell in enumerate(row):
                    t.rows[i + 1].cells[j].text = str(cell)

    # 添加推荐建议
    if report.recommendations:
        doc.add_heading("推荐建议", 1)
        for rec in report.recommendations:
            doc.add_paragraph(f"{rec.get('title', '')}: {rec.get('content', '')}", style="List Bullet")

    # 保存
    os.makedirs(PDF_OUTPUT_DIR, exist_ok=True)
    filename = f"career_report_{report.student_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.docx"
    docx_path = os.path.join(PDF_OUTPUT_DIR, filename)

    doc.save(docx_path)

    # 更新报告路径
    report.docx_path = docx_path
    await db.commit()

    return docx_path


async def create_report_version(
    report_id: UUID,
    version: str,
    db: AsyncSession,
    change_notes: str | None = None,
) -> dict[str, Any]:
    """Create a new version of a report.

    Args:
        report_id: The report ID
        version: Version string
        db: 数据库会话
        change_notes: Notes about changes

    Returns:
        Created version data
    """
    report = await db.get(CareerReport, report_id)
    if not report:
        raise ValueError(f"Report {report_id} not found")

    # 创建新版本
    report_version = ReportVersion(
        report_id=report.id,
        version=version,
        content=report.content_json,
        change_notes=change_notes,
    )
    db.add(report_version)

    await db.commit()

    return {
        "id": str(report_version.id),
        "report_id": str(report_version.report_id),
        "version": report_version.version,
        "created_at": report_version.created_at.isoformat(),
    }
