# backend/app/services/report_generator.py
"""职业发展报告生成服务 - 单次 JSON 生成.

一次 LLM 调用生成完整结构化报告。
"""
import json
import logging
from typing import AsyncGenerator
from uuid import UUID

logger = logging.getLogger(__name__)

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_provider import llm
from app.prompts.report_generation import REPORT_SYSTEM_PROMPT


def _build_user_prompt(
    student_profile: dict,
    job_profile: dict,
    matching_result: dict,
    related_jobs: list[dict],
) -> str:
    """构建完整的用户 prompt，包含所有数据。"""
    job_title = job_profile.get("role_name") or job_profile.get("title") or "未知岗位"
    total_score = matching_result.get("total_score", 0)
    dimensions = matching_result.get("scores_json", {})
    gap_items = matching_result.get("gap_items", [])[:5]

    student_summary = {
        "姓名": student_profile.get("name", "未知"),
        "学历": student_profile.get("education", "未知"),
        "技能": [s.get("skill_name", s) if isinstance(s, dict) else s for s in student_profile.get("skills", [])][:10],
        "项目经历": [p.get("project_name", p) if isinstance(p, dict) else str(p)[:50] for p in student_profile.get("projects", [])][:3],
        "实习经历": [i.get("company", i) if isinstance(i, dict) else str(i)[:50] for i in student_profile.get("internships", [])][:2],
    }

    job_summary = {
        "岗位名称": job_title,
        "行业": job_profile.get("industry", "未知"),
        "公司": job_profile.get("company_name", "未知"),
        "必备技能": job_profile.get("required_skills", [])[:5],
        "学历要求": job_profile.get("education_level", "未知"),
        "经验要求": job_profile.get("experience_level", "未知"),
        "薪资范围": job_profile.get("salary_range", "未知"),
    }

    related_summary = [
        {"岗位": j.get("role_name") or j.get("title", "未知"), "技能重叠度": j.get("skill_overlap", "未知")}
        for j in related_jobs[:3]
    ]

    prompt = f"""请基于以下数据生成职业规划报告，使用 system prompt 中指定的 JSON Schema。

## 学生画像
{json.dumps(student_summary, ensure_ascii=False, indent=2)}

## 目标岗位
{json.dumps(job_summary, ensure_ascii=False, indent=2)}

## 匹配结果
- 总分：{total_score}/100
- 四维得分：{json.dumps(dimensions, ensure_ascii=False)}
- 差距清单：{json.dumps(gap_items, ensure_ascii=False)}

## 相关岗位（用于横向转岗参考）
{json.dumps(related_summary, ensure_ascii=False, indent=2)}

请严格按 JSON Schema 输出完整报告，不要输出任何其他内容。
"""
    return prompt


class ReportGeneratorService:
    """职业发展报告生成服务 - 单次 JSON 输出."""

    def __init__(self):
        self.llm = llm

    async def generate_report_stream(
        self,
        student_profile: dict,
        job_profile: dict,
        matching_result: dict,
        related_jobs: list[dict],
        db: AsyncSession,
        student_id: UUID,
        job_profile_id: UUID,
    ) -> AsyncGenerator[str, None]:
        """
        SSE 流式生成报告，先 yield 各章节生成状态，最后 yield all_done。
        event 格式：
          data: {{"chapter": 1, "status": "generating", "title": "综合评估"}}
          data: {{"chapter": 1, "status": "done", "title": "综合评估", "content": "...", "key_points": [...]}}
          ...
          data: {{"status": "all_done", "report_id": "uuid"}}
        """
        chapter_titles = [
            "综合评估",
            "核心优势",
            "能力缺口",
            "职业路径",
            "近期行动",
        ]

        # 通知开始生成
        for i, title in enumerate(chapter_titles):
            yield f"data: {json.dumps({'chapter': i + 1, 'status': 'generating', 'title': title}, ensure_ascii=False)}\n\n"

        # 单次 LLM 调用生成完整 JSON 报告
        user_prompt = _build_user_prompt(
            student_profile, job_profile, matching_result, related_jobs
        )

        try:
            raw_response = await self.llm.generate_text(
                system_prompt=REPORT_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.3,
                max_tokens=4000,
                response_format={"type": "json_object"},
            )
        except Exception as e:
            logger.error(f"LLM report generation failed: {e}")
            for i, title in enumerate(chapter_titles):
                yield f"data: {json.dumps({'chapter': i + 1, 'status': 'error', 'title': title, 'error': str(e)}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'status': 'all_done', 'report_id': None, 'error': str(e)}, ensure_ascii=False)}\n\n"
            return

        # 解析 JSON
        try:
            report_data = json.loads(raw_response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}, raw: {raw_response[:500]}")
            for i, title in enumerate(chapter_titles):
                yield f"data: {json.dumps({'chapter': i + 1, 'status': 'error', 'title': title, 'error': 'JSON解析失败'}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'status': 'all_done', 'report_id': None, 'error': 'JSON解析失败'}, ensure_ascii=False)}\n\n"
            return

        chapters = report_data.get("chapters", [])
        action_suggestions = report_data.get("action_suggestions", [])

        # 逐章推送 done 事件
        for i, chapter in enumerate(chapters):
            yield f"data: {json.dumps({
                'chapter': i + 1,
                'status': 'done',
                'title': chapter.get('title', chapter_titles[i]),
                'content': chapter.get('content', ''),
                'key_points': chapter.get('key_points', []),
            }, ensure_ascii=False)}\n\n"

        # 构建存储结构
        report_content = {
            "student_id": str(student_id),
            "target_job_id": str(job_profile_id),
            "metadata": {
                "match_score": matching_result.get("total_score", 0),
                "target_job_name": job_profile.get("role_name", job_profile.get("title", "未知岗位")),
                "dimensions": matching_result.get("scores_json", {}),
            },
            "chapters": [
                {
                    "chapter_id": i + 1,
                    "title": ch.get("title", chapter_titles[i]),
                    "sections": [{
                        "title": ch.get("title", chapter_titles[i]),
                        "content": ch.get("content", ""),
                        "key_points": ch.get("key_points", []),
                    }],
                    "tables": [],
                    "charts": [],
                }
                for i, ch in enumerate(chapters)
            ],
            "action_suggestions": action_suggestions,
        }

        # 保存报告
        try:
            from app.services.report import merge_and_save
            saved_report = await merge_and_save(student_id, report_content, db)
            report_id = str(saved_report.id)
        except Exception as db_error:
            logger.error(f"Failed to save report to database: {db_error}")
            report_id = f"temp_{student_id}_{job_profile_id}"

        yield f"data: {json.dumps({'status': 'all_done', 'report_id': report_id}, ensure_ascii=False)}\n\n"
