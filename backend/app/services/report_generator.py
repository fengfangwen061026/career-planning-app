"""Streaming report generator for the admin report page."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.report import CareerReportResponse
from app.services.report import generate_full_report, normalize_report_content, serialize_career_report

logger = logging.getLogger(__name__)


class ReportGeneratorService:
    """Generate a report and emit backend-driven chapter events."""

    async def generate_report_stream(
        self,
        student_id: UUID,
        job_profile_id: UUID | None,
        db: AsyncSession,
    ):
        target_job_ids = [job_profile_id] if job_profile_id else None

        yield {
            "event": "stage",
            "type": "stage",
            "stage": "preparing",
            "progress": 10,
            "message": "正在准备报告上下文",
        }

        try:
            report = await generate_full_report(student_id=student_id, db=db, target_job_ids=target_job_ids)
        except Exception as exc:
            logger.exception("Report stream generation failed for student %s", student_id)
            yield {
                "event": "error",
                "type": "error",
                "message": str(exc),
            }
            return

        content = normalize_report_content(report.content_json or {})
        chapters = content.get("chapters") or []
        total = max(len(chapters), 1)

        yield {
            "event": "stage",
            "type": "stage",
            "stage": "generating",
            "progress": 25,
            "message": "正在生成五章报告内容",
        }

        for index, chapter in enumerate(chapters, start=1):
            yield {
                "event": "chapter",
                "type": "chapter",
                "chapter_index": index,
                "progress": min(95, 25 + int(index / total * 70)),
                "message": f"已生成 {chapter.get('title') or f'第 {index} 章'}",
                "data": chapter,
            }

        yield {
            "event": "complete",
            "type": "complete",
            "progress": 100,
            "message": "报告生成完成",
            "data": {
                "report": CareerReportResponse.model_validate(
                    serialize_career_report(report)
                ).model_dump(mode="json"),
            },
        }
