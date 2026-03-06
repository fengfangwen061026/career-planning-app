"""Reports API routes."""
import os
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
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

# PDF 导出目录
PDF_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "static", "exports")


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------


@router.post("/generate/{student_id}", response_model=CareerReportResponse)
async def generate_report(
    student_id: UUID,
    job_ids: list[UUID] | None = Query(default=None),
    include_export: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
) -> CareerReportResponse:
    """Generate a career report for a student.

    Args:
        student_id: The student ID
        job_ids: Optional list of job IDs to include in report
        include_export: Whether to export PDF after generation

    Returns:
        Generated career report
    """
    # 验证学生存在
    from app.models.student import Student
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # 生成报告
    report = await generate_full_report(
        student_id=student_id,
        db=db,
        target_job_ids=job_ids,
    )

    # 如果需要导出
    if include_export:
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

        # 返回文件
        filename = os.path.basename(file_path)
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/octet-stream",
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
