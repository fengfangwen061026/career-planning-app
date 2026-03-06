"""Report related schemas."""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CareerReportBase(BaseModel):
    """Base career report schema."""
    title: str | None = None
    summary: str | None = None
    recommendations: list[dict[str, Any]] | None = None
    suggested_jobs: list[dict[str, Any]] | None = None
    skill_gaps: list[dict[str, Any]] | None = None
    career_path: list[dict[str, Any]] | None = None


class CareerReportCreate(CareerReportBase):
    """Career report creation schema."""
    student_id: UUID


class CareerReportUpdate(BaseModel):
    """Career report update schema."""
    title: str | None = None
    summary: str | None = None
    recommendations: list[dict[str, Any]] | None = None
    suggested_jobs: list[dict[str, Any]] | None = None
    skill_gaps: list[dict[str, Any]] | None = None
    career_path: list[dict[str, Any]] | None = None


class CareerReportResponse(CareerReportBase):
    """Career report response schema."""
    id: UUID
    student_id: UUID
    status: str = "pending"
    version: str = "1.0"
    content_json: dict[str, Any] | None = None
    pdf_path: str | None = None
    docx_path: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReportVersionBase(BaseModel):
    """Base report version schema."""
    version: str
    content: dict[str, Any]
    change_notes: str | None = None


class ReportVersionCreate(ReportVersionBase):
    """Report version creation schema."""
    report_id: UUID


class ReportVersionResponse(ReportVersionBase):
    """Report version response schema."""
    id: UUID
    report_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReportGenerateRequest(BaseModel):
    """Request schema for generating a report."""
    student_id: UUID
    job_ids: list[UUID] | None = None
    include_export: bool = False


class ReportExportRequest(BaseModel):
    """Request schema for exporting a report."""
    report_id: UUID
    format: str = "pdf"  # pdf, docx
