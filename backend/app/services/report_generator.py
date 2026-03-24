# backend/app/services/report_generator.py
"""职业发展报告生成服务 - 流式章节生成.

支持 SSE 流式输出，逐章生成报告内容。
"""
import asyncio
import json
import logging
from typing import AsyncGenerator
from uuid import UUID

logger = logging.getLogger(__name__)

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_provider import llm
from app.prompts.report_generation import REPORT_SYSTEM_PROMPT, CHAPTER_PROMPTS


class ReportGeneratorService:
    """职业发展报告生成服务 - 支持流式输出."""

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
        SSE 流式生成报告，每完成一章 yield 一条 SSE event。
        event 格式：
          data: {"chapter": 1, "status": "generating", "title": "个人优势总结"}
          data: {"chapter": 1, "status": "done", "content": "...章节内容..."}
          ...
          data: {"status": "all_done", "report_id": "uuid"}
        """
        chapter_titles = [
            "个人优势总结",
            "目标岗位分析",
            "差距与行动计划",
            "职业路径规划",
            "评估周期与指标",
        ]
        chapter_keys = [
            "chapter_1_summary",
            "chapter_2_job_analysis",
            "chapter_3_gap_action",
            "chapter_4_career_path",
            "chapter_5_evaluation",
        ]

        # 初始化报告内容
        report_content = {
            "student_id": str(student_id),
            "target_job_id": str(job_profile_id),
            "metadata": {
                "match_score": matching_result.get("total_score", 0),
                "target_job_name": job_profile.get("role_name", job_profile.get("title", "未知岗位")),
                "dimensions": matching_result.get("scores_json", {}),
            },
            "chapters": {},
        }

        for i in range(5):
            chapter_num = i + 1
            field_name = chapter_keys[i]
            title = chapter_titles[i]

            # 通知前端开始生成第N章
            yield f"data: {json.dumps({'chapter': chapter_num, 'status': 'generating', 'title': title}, ensure_ascii=False)}\n\n"

            try:
                # 准备 prompt 变量
                prompt_vars = self._prepare_prompt_vars(
                    chapter_num=chapter_num,
                    student_profile=student_profile,
                    job_profile=job_profile,
                    matching_result=matching_result,
                    related_jobs=related_jobs,
                )
                prompt = CHAPTER_PROMPTS[chapter_num].format(**prompt_vars)

                # 调用 LLM 生成
                content = await self.llm.generate_text(
                    system_prompt=REPORT_SYSTEM_PROMPT,
                    user_prompt=prompt,
                )

                report_content["chapters"][field_name] = content

                yield f"data: {json.dumps({'chapter': chapter_num, 'status': 'done', 'title': title, 'content': content}, ensure_ascii=False)}\n\n"

            except Exception as e:
                error_msg = f"[生成失败: {str(e)}]"
                report_content["chapters"][field_name] = error_msg
                yield f"data: {json.dumps({'chapter': chapter_num, 'status': 'error', 'title': title, 'error': str(e)}, ensure_ascii=False)}\n\n"

        # 保存报告到数据库（如果失败仍然通知前端完成）
        from app.models.report import CareerReport

        try:
            report = CareerReport(
                student_id=student_id,
                content_json=report_content,
                status="completed",
            )
            db.add(report)
            await db.commit()
            await db.refresh(report)
            report_id = str(report.id)
        except Exception as db_error:
            # 即使数据库保存失败，也通知前端生成完成，避免无限等待
            logger.error(f"Failed to save report to database: {db_error}")
            # 使用临时ID，前端可通过报告查询验证
            report_id = f"temp_{student_id}_{job_profile_id}"

        yield f"data: {json.dumps({'status': 'all_done', 'report_id': report_id}, ensure_ascii=False)}\n\n"

    def _prepare_prompt_vars(
        self,
        chapter_num: int,
        student_profile: dict,
        job_profile: dict,
        matching_result: dict,
        related_jobs: list[dict],
    ) -> dict:
        """根据章节号准备 prompt 模板所需变量."""
        # 处理 job_profile 中的 role_name / title 字段
        job_title = job_profile.get("role_name") or job_profile.get("title") or "未知岗位"

        base_vars = {
            "student_profile": json.dumps(student_profile, ensure_ascii=False, indent=2)[:3000],
            "job_profile": json.dumps(job_profile, ensure_ascii=False, indent=2)[:3000],
            "matching_result": json.dumps(matching_result, ensure_ascii=False, indent=2)[:3000],
            "target_job_name": job_title,
            "match_score": matching_result.get("total_score", 0),
            "student_skills": json.dumps(
                student_profile.get("skills", []), ensure_ascii=False
            )[:2000],
            "student_summary": json.dumps({
                k: student_profile.get(k)
                for k in ["name", "education", "skills", "projects", "internships"]
                if student_profile.get(k)
            }, ensure_ascii=False)[:2000],
            "related_jobs": json.dumps(
                [{"name": j.get("role_name") or j.get("title", "未知岗位"), "overlap": j.get("skill_overlap", "未知")}
                 for j in related_jobs[:5]],
                ensure_ascii=False
            ),
            "gap_summary": json.dumps(
                matching_result.get("gap_items", [])[:5], ensure_ascii=False
            )[:2000] if matching_result.get("gap_items") else "[]",
            "action_summary": "参见第三章生成的行动计划",
        }
        return base_vars
