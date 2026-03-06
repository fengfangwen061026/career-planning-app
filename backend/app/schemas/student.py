"""Student related schemas."""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StudentBase(BaseModel):
    """Base student schema."""
    email: str
    name: str | None = None
    phone: str | None = None


class StudentCreate(StudentBase):
    """Student creation schema."""
    pass


class StudentUpdate(BaseModel):
    """Student update schema."""
    name: str | None = None
    phone: str | None = None


class StudentResponse(StudentBase):
    """Student response schema."""
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ResumeBase(BaseModel):
    """Base resume schema."""
    filename: str | None = None
    file_type: str | None = None
    is_primary: bool = False


class ResumeCreate(ResumeBase):
    """Resume creation schema."""
    student_id: UUID
    file_path: str | None = None


class ResumeUpdate(BaseModel):
    """Resume update schema."""
    filename: str | None = None
    is_primary: bool | None = None


class ResumeResponse(ResumeBase):
    """Resume response schema."""
    id: UUID
    student_id: UUID
    file_path: str | None = None
    raw_text: str | None = None
    parsed_data: dict[str, Any] | None = Field(None, validation_alias="parsed_json")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class StudentProfileBase(BaseModel):
    """Base student profile schema."""
    skills: list[str] | None = None
    experience: list[dict[str, Any]] | None = None
    education: list[dict[str, Any]] | None = None
    projects: list[dict[str, Any]] | None = None
    interests: list[str] | None = None
    goals: list[str] | None = None


class StudentProfileCreate(StudentProfileBase):
    """Student profile creation schema."""
    student_id: UUID


class StudentProfileUpdate(BaseModel):
    """Student profile update schema."""
    profile_json: dict[str, Any] | None = None


class StudentProfileResponse(BaseModel):
    """Student profile response schema."""
    id: UUID
    student_id: UUID
    profile_json: dict[str, Any]
    completeness_score: float = 0.0
    evidence_json: dict[str, Any] | None = None
    version: str = "1.0"
    missing_suggestions: list[str] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ResumeUploadResponse(BaseModel):
    """Response for resume upload with parsing results."""
    resume: ResumeResponse
    parsed_data: dict[str, Any]
    completeness_score: float
    missing_suggestions: list[str]
    normalization_log: list[dict[str, str]]
