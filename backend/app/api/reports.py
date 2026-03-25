"""Reports API routes."""
import logging
import os
from typing import Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.report import CareerReport
from app.schemas.report import (
    CareerReportCreate,
    CareerReportResponse,
    ReportGenerateRequest,
    ReportExportRequest,
)
from app.services.matching import match_student_job
from app.services.report import (
    check_completeness,
    export_to_docx,
    export_to_pdf,
    generate_full_report,
    polish_report,
)


# 自定义更新 schema，支持 content_json
class CareerReportUpdate(BaseModel):
    """Career report update schema with content_json support."""
    title: str | None = None
    summary: str | None = None
    recommendations: list[dict[str, Any]] | None = None
    suggested_jobs: list[dict[str, Any]] | None = None
    skill_gaps: list[dict[str, Any]] | None = None
    career_path: list[dict[str, Any]] | None = None
    content_json: dict[str, Any] | None = None
    status: str | None = None


router = APIRouter()

logger = logging.getLogger(__name__)

# PDF 导出目录
PDF_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "static", "exports")


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------


@router.post("/generate/{student_id}", response_model=CareerReportResponse)
async def generate_report(
    student_id: UUID,
    job_profile_ids: list[UUID] | None = Query(default=None),
    include_export: bool = Query(default=False),
    request: ReportGenerateRequest | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
) -> CareerReportResponse:
    """Generate a career report for a student.

    Args:
        student_id: The student ID
        job_profile_ids: Optional list of job profile IDs to include in report
        include_export: Whether to export PDF after generation

    Returns:
        Generated career report
    """
    # 验证学生存在
    from app.models.student import Student
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    requested_job_profile_ids = (
        request.job_profile_ids
        if request and request.job_profile_ids is not None
        else job_profile_ids
    )
    requested_include_export = request.include_export if request is not None else include_export

    # 生成报告
    report = await generate_full_report(
        student_id=student_id,
        db=db,
        target_job_ids=requested_job_profile_ids,
    )

    # 如果需要导出
    if requested_include_export:
        try:
            export_format = "pdf"
            if export_format == "pdf":
                await export_to_pdf(report.id, db)
            else:
                await export_to_docx(report.id, db)
        except Exception as e:
            # 导出失败不阻塞返回
            import logging
            logging.getLogger(__name__).warning("Export failed: %s", e)

    return CareerReportResponse.model_validate(report)


@router.post("/generate/stream")
async def generate_report_stream(
    student_id: UUID,
    job_profile_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """SSE 流式生成职业发展报告，逐章输出进度。

    Args:
        student_id: 学生 ID
        job_profile_id: 目标岗位画像 ID（可选）
        db: 数据库会话

    Returns:
        SSE 流，每个事件为 JSON 格式的章节内容或进度更新
    """
    from fastapi.responses import StreamingResponse
    from app.models.student import StudentProfile
    from app.models.job import JobProfile
    from app.services.report_generator import ReportGeneratorService

    # 1. 查询学生画像
    stmt = select(StudentProfile).where(StudentProfile.student_id == student_id)
    result = await db.execute(stmt)
    student_profile_model = result.scalar_one_or_none()

    if not student_profile_model:
        raise HTTPException(404, "学生画像不存在，请先上传简历")

    student_profile = student_profile_model.profile_json or {}

    # 2. 查询岗位画像（如果提供了 job_profile_id）
    job_profile = {}
    if job_profile_id:
        job_stmt = select(JobProfile).where(JobProfile.id == job_profile_id)
        job_result = await db.execute(job_stmt)
        job_profile_model = job_result.scalar_one_or_none()
        if job_profile_model:
            job_profile = job_profile_model.profile_json or {}
        else:
            raise HTTPException(404, "岗位画像不存在")

    # 3. 获取匹配结果（使用真实匹配服务）
    if job_profile_id and student_profile:
        try:
            match_result = await match_student_job(
                db=db,
                student_id=student_id,
                job_profile_id=job_profile_id,
            )
            # 转换为dict格式供报告使用
            matching_result = {
                "total_score": match_result.total_score or 0.0,
                "scores_json": match_result.scores_json or {},
                "gap_items": match_result.gaps_json or [],
            }
        except Exception as e:
            # 如果匹配失败，使用默认值
            logger.warning(f"Matching failed, using default: {e}")
            matching_result = {
                "total_score": 0.5,
                "scores_json": {
                    "basic": {"score": 0.5},
                    "skill": {"score": 0.5},
                    "competency": {"score": 0.5},
                    "potential": {"score": 0.5},
                },
                "gap_items": [],
            }
    else:
        # 没有岗位ID时使用默认值
        matching_result = {
            "total_score": 0.5,
            "scores_json": {
                "basic": {"score": 0.5},
                "skill": {"score": 0.5},
                "competency": {"score": 0.5},
                "potential": {"score": 0.5},
            },
            "gap_items": [],
        }

    # 4. 查询相关岗位（用于横向路径）
    related_jobs_stmt = select(JobProfile).limit(5)
    related_result = await db.execute(related_jobs_stmt)
    related_jobs = []
    for j in related_result.scalars().all():
        if j.id != job_profile_id:
            related_jobs.append({
                "role_name": j.role.name if j.role else None,
                "skill_overlap": "60%",
            })

    # 5. 启动流式生成
    service = ReportGeneratorService()

    return StreamingResponse(
        service.generate_report_stream(
            student_profile=student_profile,
            job_profile=job_profile,
            matching_result=matching_result,
            related_jobs=related_jobs,
            db=db,
            student_id=student_id,
            job_profile_id=job_profile_id or UUID("00000000-0000-0000-0000-000000000000"),
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Background report generation (Step 8 of optimization plan)
# ---------------------------------------------------------------------------


class ReportGenerationStatus(BaseModel):
    """Report generation status response."""
    report_id: UUID
    status: str  # generating, completed, failed
    progress: float = 0.0  # 0.0 to 1.0
    error: str | None = None
    created_at: str | None = None


@router.post("/generate/{student_id}/background", status_code=status.HTTP_202_ACCEPTED)
async def start_report_generation(
    student_id: UUID,
    background_tasks: BackgroundTasks,
    job_profile_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Start report generation in background, return immediately with report_id.

    Use GET /reports/generate/{report_id}/status to poll for completion.
    """
    from app.models.student import StudentProfile
    from app.models.job import JobProfile
    from app.models.report import CareerReport

    # Verify student profile exists
    stmt = select(StudentProfile).where(StudentProfile.student_id == student_id)
    result = await db.execute(stmt)
    student_profile_model = result.scalar_one_or_none()
    if not student_profile_model:
        raise HTTPException(404, "学生画像不存在，请先上传简历")

    student_profile = student_profile_model.profile_json or {}

    # Verify job profile if provided
    job_profile = {}
    if job_profile_id:
        job_stmt = select(JobProfile).where(JobProfile.id == job_profile_id)
        job_result = await db.execute(job_stmt)
        job_profile_model = job_result.scalar_one_or_none()
        if job_profile_model:
            job_profile = job_profile_model.profile_json or {}
        else:
            raise HTTPException(404, "岗位画像不存在")

    # Create pending report record
    db_report = CareerReport(
        student_id=student_id,
        content_json={"status": "generating", "chapters": []},
        status="generating",
    )
    db.add(db_report)
    await db.commit()
    await db.refresh(db_report)

    # Queue background generation using FastAPI BackgroundTasks

    async def _generate_in_background():
        """Background task to generate report chapters."""
        from app.database import async_session_factory
        from app.services.matching import match_student_job
        from app.services.report_generator import ReportGeneratorService

        async with async_session_factory() as bg_db:
            try:
                # Get matching result
                if job_profile_id and student_profile:
                    try:
                        match_result = await match_student_job(
                            db=bg_db,
                            student_id=student_id,
                            job_profile_id=job_profile_id,
                        )
                        matching_result = {
                            "total_score": match_result.total_score or 0.0,
                            "scores_json": match_result.scores_json or {},
                            "gap_items": match_result.gaps_json or [],
                        }
                    except Exception as e:
                        logger.warning(f"Matching failed in background: {e}")
                        matching_result = {
                            "total_score": 0.5,
                            "scores_json": {
                                "basic": {"score": 0.5},
                                "skill": {"score": 0.5},
                                "competency": {"score": 0.5},
                                "potential": {"score": 0.5},
                            },
                            "gap_items": [],
                        }
                else:
                    matching_result = {
                        "total_score": 0.5,
                        "scores_json": {
                            "basic": {"score": 0.5},
                            "skill": {"score": 0.5},
                            "competency": {"score": 0.5},
                            "potential": {"score": 0.5},
                        },
                        "gap_items": [],
                    }

                # Get related jobs
                from sqlalchemy import select as sa_select
                related_jobs_stmt = sa_select(JobProfile).limit(5)
                related_result = await bg_db.execute(related_jobs_stmt)
                related_jobs = []
                for j in related_result.scalars().all():
                    if j.id != job_profile_id:
                        related_jobs.append({
                            "role_name": j.role.name if j.role else None,
                            "skill_overlap": "60%",
                        })

                # Generate report (collect all chapters)
                service = ReportGeneratorService()
                chapters = []
                async for event in service.generate_report_stream(
                    student_profile=student_profile,
                    job_profile=job_profile,
                    matching_result=matching_result,
                    related_jobs=related_jobs,
                    db=bg_db,
                    student_id=student_id,
                    job_profile_id=job_profile_id or UUID("00000000-0000-0000-0000-000000000000"),
                ):
                    if event.get("event") == "chapter":
                        chapters.append(event.get("data"))

                # Update report with completed content
                report = await bg_db.get(CareerReport, db_report.id)
                if report:
                    report.content_json = {
                        "status": "completed",
                        "chapters": chapters,
                        "chapter_count": len(chapters),
                    }
                    report.status = "completed"
                    await bg_db.commit()

            except Exception as e:
                logger.error(f"Background report generation failed: {e}")
                try:
                    report = await bg_db.get(CareerReport, db_report.id)
                    if report:
                        report.content_json = {"status": "failed", "error": str(e)}
                        report.status = "failed"
                        await bg_db.commit()
                except Exception:
                    pass

    # Add background task for report generation
    # Note: For production, use an external task queue (Celery, etc.)
    # FastAPI BackgroundTasks is suitable for development/testing
    background_tasks.add_task(_generate_in_background)

    return {
        "report_id": str(db_report.id),
        "status": "generating",
        "message": "报告生成已启动，请使用 /reports/generate/{report_id}/status 轮询状态",
    }


@router.get("/generate/{report_id}/status", response_model=ReportGenerationStatus)
async def get_report_generation_status(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ReportGenerationStatus:
    """Poll for report generation status."""
    report = await db.get(CareerReport, report_id)
    if not report:
        raise HTTPException(404, "Report not found")

    content = report.content_json or {}
    progress = 1.0 if report.status == "completed" else 0.0

    if report.status == "generating":
        chapters = content.get("chapters", [])
        progress = min(len(chapters) / 5.0, 0.9)  # 5 chapters max

    return ReportGenerationStatus(
        report_id=report.id,
        status=report.status,
        progress=progress,
        error=content.get("error"),
        created_at=report.created_at.isoformat() if report.created_at else None,
    )


@router.post("/", response_model=CareerReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report: CareerReportCreate,
    db: AsyncSession = Depends(get_db),
) -> CareerReportResponse:
    """Create a career report."""
    db_report = CareerReport(
        student_id=report.student_id,
        content_json={
            "title": report.title,
            "summary": report.summary,
            "recommendations": report.recommendations,
            "suggested_jobs": report.suggested_jobs,
            "skill_gaps": report.skill_gaps,
            "career_path": report.career_path,
        },
        status="pending",
    )
    db.add(db_report)
    await db.flush()
    await db.refresh(db_report)
    return CareerReportResponse.model_validate(db_report)


# ---------------------------------------------------------------------------
# Report CRUD
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[CareerReportResponse])
async def list_reports(
    student_id: UUID | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[CareerReportResponse]:
    """List career reports.

    Args:
        student_id: Optional filter by student ID
        skip: Number of records to skip
        limit: Maximum number of records to return

    Returns:
        List of career reports
    """
    stmt = select(CareerReport).order_by(CareerReport.created_at.desc())

    if student_id:
        stmt = stmt.where(CareerReport.student_id == student_id)

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    reports = result.scalars().all()

    return [CareerReportResponse.model_validate(r) for r in reports]


@router.get("/{report_id}", response_model=CareerReportResponse)
async def get_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> CareerReportResponse:
    """Get a career report by ID.

    Returns the complete report including content_json.
    """
    report = await db.get(CareerReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return CareerReportResponse.model_validate(report)


@router.put("/{report_id}", response_model=CareerReportResponse)
async def update_report(
    report_id: UUID,
    report_update: CareerReportUpdate,
    db: AsyncSession = Depends(get_db),
) -> CareerReportResponse:
    """Update a career report content."""
    db_report = await db.get(CareerReport, report_id)
    if not db_report:
        raise HTTPException(status_code=404, detail="Report not found")

    # 更新字段
    update_data = report_update.model_dump(exclude_unset=True)

    # 如果传入了 content_json，合并到现有 content
    if "content_json" in update_data:
        existing_content = db_report.content_json or {}
        existing_content.update(update_data["content_json"])
        db_report.content_json = existing_content
        del update_data["content_json"]

    for field, value in update_data.items():
        setattr(db_report, field, value)

    await db.flush()
    await db.refresh(db_report)
    return CareerReportResponse.model_validate(db_report)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a career report."""
    report = await db.get(CareerReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    await db.delete(report)
    await db.flush()


# ---------------------------------------------------------------------------
# Report actions
# ---------------------------------------------------------------------------


@router.post("/{report_id}/polish")
async def polish_report_endpoint(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Polish/refine a career report.

    Returns:
        {"polished": bool, "changes": [...], "version": "..."}
    """
    result = await polish_report(report_id, db)

    if not result.get("polished") and result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    return result


@router.post("/{report_id}/check")
async def check_report_completeness(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Check report completeness.

    Returns:
        {"complete": bool, "missing_items": [...], "suggestions": [...]}
    """
    result = await check_completeness(report_id, db)
    return result


@router.post("/{report_id}/export", response_model=None)
async def export_report(
    report_id: UUID,
    format: str = Query(default="pdf", pattern="^(pdf|html|docx)$"),
    db: AsyncSession = Depends(get_db),
):
    """Export a report to PDF, HTML, or DOCX.

    Args:
        report_id: The report ID
        format: Export format (pdf/html/docx)

    Returns:
        File response or error
    """
    # 验证报告存在
    report = await db.get(CareerReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # 执行导出
    try:
        if format == "pdf":
            file_path = await export_to_pdf(report_id, db)
        elif format == "docx":
            file_path = await export_to_docx(report_id, db)
        else:  # html
            from app.services.report import _export_to_html
            file_path = await _export_to_html(report_id, db)

        # 检查文件是否存在
        if not os.path.exists(file_path):
            raise HTTPException(status_code=500, detail="Export file not found")

        # 返回文件 - 根据文件扩展名确定 media_type
        filename = os.path.basename(file_path)
        if file_path.endswith(".pdf"):
            media_type = "application/pdf"
        elif file_path.endswith(".html"):
            media_type = "text/html"
        elif file_path.endswith(".docx"):
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            media_type = "application/octet-stream"

        return FileResponse(
            path=file_path,
            filename=filename,
            media_type=media_type,
        )

    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Export failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


# ---------------------------------------------------------------------------
# Version management
# ---------------------------------------------------------------------------


@router.get("/{report_id}/versions", response_model=list[dict[str, Any]])
async def get_report_versions(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Get all versions of a report.

    Args:
        report_id: The report ID
        db: Database session

    Returns:
        List of report versions
    """
    from app.models.report import ReportVersion

    stmt = select(ReportVersion).where(
        ReportVersion.report_id == report_id
    ).order_by(ReportVersion.created_at.desc())

    result = await db.execute(stmt)
    versions = result.scalars().all()

    return [
        {
            "id": str(v.id),
            "report_id": str(v.report_id),
            "version": v.version,
            "content": v.content,
            "change_notes": v.change_notes,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in versions
    ]


@router.post("/{report_id}/versions", response_model=dict[str, Any])
async def create_report_version(
    report_id: UUID,
    version: str = Query(..., description="Version string"),
    change_notes: str | None = Query(default=None, description="Change notes"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Create a new version of a report manually.

    Args:
        report_id: The report ID
        version: Version string
        change_notes: Notes about changes
        db: Database session

    Returns:
        Created version data
    """
    from app.models.report import ReportVersion

    # 验证报告存在
    report = await db.get(CareerReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # 创建新版本
    report_version = ReportVersion(
        report_id=report_id,
        version=version,
        content=report.content_json,
        change_notes=change_notes,
    )
    db.add(report_version)
    await db.commit()
    await db.refresh(report_version)

    return {
        "id": str(report_version.id),
        "report_id": str(report_version.report_id),
        "version": report_version.version,
        "created_at": report_version.created_at.isoformat() if report_version.created_at else None,
    }
