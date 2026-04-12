"""Reports API routes."""

from __future__ import annotations

import json
import os
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.report import CareerReport, ReportVersion
from app.models.student import Student
from app.schemas.report import CareerReportCreate, CareerReportResponse, ReportGenerateRequest
from app.services.report import (
    _export_to_html,
    check_completeness,
    create_report_version,
    export_to_docx,
    export_to_pdf,
    generate_full_report,
    normalize_report_content,
    polish_report,
    serialize_career_report,
)
from app.services.report_generator import ReportGeneratorService


class CareerReportUpdate(BaseModel):
    """Career report update schema with content_json support."""

    title: str | None = None
    summary: str | None = None
    recommendations: list[dict[str, Any]] | None = None
    content_json: dict[str, Any] | None = None
    status: str | None = None


router = APIRouter()


def _response(report: CareerReport) -> CareerReportResponse:
    return CareerReportResponse.model_validate(serialize_career_report(report))


@router.post("/generate/stream")
async def generate_report_stream(
    student_id: UUID = Query(...),
    job_profile_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Generate a report through SSE."""

    service = ReportGeneratorService()

    async def stream_events():
        async for event in service.generate_report_stream(
            student_id=student_id,
            job_profile_id=job_profile_id,
            db=db,
        ):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        stream_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/generate/{student_id}", response_model=CareerReportResponse)
async def generate_report(
    student_id: UUID,
    job_profile_ids: list[UUID] | None = Query(default=None),
    include_export: bool = Query(default=False),
    request: ReportGenerateRequest | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
) -> CareerReportResponse:
    """Generate one report synchronously."""

    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    requested_job_ids = request.job_profile_ids if request and request.job_profile_ids is not None else job_profile_ids
    requested_include_export = request.include_export if request is not None else include_export

    try:
        report = await generate_full_report(student_id=student_id, db=db, target_job_ids=requested_job_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if requested_include_export:
        await export_to_pdf(report.id, db)

    return _response(report)


@router.post("/", response_model=CareerReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(report: CareerReportCreate, db: AsyncSession = Depends(get_db)) -> CareerReportResponse:
    db_report = CareerReport(
        student_id=report.student_id,
        content_json=normalize_report_content(
            {
                "title": report.title,
                "summary": report.summary,
                "actions": report.skill_gaps or [],
                "paths": {"primary_path": report.career_path or [], "alt_paths": []},
                "chapters": [],
            }
        ),
        summary=report.summary,
        recommendations=report.recommendations,
        status="completed",
    )
    db.add(db_report)
    await db.commit()
    await db.refresh(db_report)
    return _response(db_report)


@router.get("/", response_model=list[CareerReportResponse])
async def list_reports(
    student_id: UUID | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[CareerReportResponse]:
    stmt = select(CareerReport).order_by(desc(CareerReport.updated_at), desc(CareerReport.created_at))
    if student_id:
        stmt = stmt.where(CareerReport.student_id == student_id)
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    reports = result.scalars().all()
    return [_response(report) for report in reports]


@router.get("/{report_id}", response_model=CareerReportResponse)
async def get_report(report_id: UUID, db: AsyncSession = Depends(get_db)) -> CareerReportResponse:
    report = await db.get(CareerReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return _response(report)


@router.put("/{report_id}", response_model=CareerReportResponse)
async def update_report(
    report_id: UUID,
    report_update: CareerReportUpdate,
    db: AsyncSession = Depends(get_db),
) -> CareerReportResponse:
    report = await db.get(CareerReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    update_data = report_update.model_dump(exclude_unset=True)
    if "content_json" in update_data:
        normalized = normalize_report_content(update_data["content_json"])
        report.content_json = normalized
        report.summary = normalized.get("summary") or report.summary
        update_data.pop("content_json")
    for field, value in update_data.items():
        setattr(report, field, value)

    await db.commit()
    await db.refresh(report)
    return _response(report)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(report_id: UUID, db: AsyncSession = Depends(get_db)) -> None:
    report = await db.get(CareerReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await db.delete(report)
    await db.commit()


@router.post("/{report_id}/polish")
async def polish_report_endpoint(report_id: UUID, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    result = await polish_report(report_id, db)
    if not result.get("polished") and result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/{report_id}/check")
async def check_report_completeness(report_id: UUID, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    try:
        return await check_completeness(report_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{report_id}/export", response_model=None)
@router.post("/{report_id}/export", response_model=None)
async def export_report(
    report_id: UUID,
    format: str = Query(default="pdf", pattern="^(pdf|html|docx)$"),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(CareerReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        if format == "pdf":
            file_path = await export_to_pdf(report_id, db)
        elif format == "docx":
            file_path = await export_to_docx(report_id, db)
        else:
            file_path = await _export_to_html(report_id, db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="Export file not found")

    if file_path.endswith(".pdf"):
        media_type = "application/pdf"
    elif file_path.endswith(".docx"):
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    else:
        media_type = "text/html"

    return FileResponse(path=file_path, filename=os.path.basename(file_path), media_type=media_type)


@router.get("/{report_id}/versions", response_model=list[dict[str, Any]])
async def get_report_versions(report_id: UUID, db: AsyncSession = Depends(get_db)) -> list[dict[str, Any]]:
    result = await db.execute(
        select(ReportVersion)
        .where(ReportVersion.report_id == report_id)
        .order_by(desc(ReportVersion.created_at))
    )
    versions = result.scalars().all()
    return [
        {
            "id": str(version.id),
            "report_id": str(version.report_id),
            "version": version.version,
            "content": version.content,
            "change_notes": version.change_notes,
            "created_at": version.created_at.isoformat() if version.created_at else None,
        }
        for version in versions
    ]


@router.post("/{report_id}/versions", response_model=dict[str, Any])
async def create_manual_report_version(
    report_id: UUID,
    version: str = Query(..., description="Version string"),
    change_notes: str | None = Query(default=None, description="Change notes"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    try:
        return await create_report_version(report_id, version, db, change_notes)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
