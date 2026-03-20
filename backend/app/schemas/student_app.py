"""Schemas for the student-facing mobile application."""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.matching import FourDimensionScores, GapItem
from app.schemas.student import StudentProfileResponse, StudentResponse


class StudentSessionRequest(BaseModel):
    """Lightweight student session bootstrap request."""

    email: str | None = None
    phone: str | None = None
    name: str | None = None


class StudentSessionResponse(BaseModel):
    """Student session bootstrap response."""

    student: StudentResponse
    created: bool = False
    has_profile: bool = False


class JobSnapshot(BaseModel):
    """Lightweight job snapshot used by the mobile recommendation cards."""

    title: str | None = None
    city: str | None = None
    company_name: str | None = None
    company_stage: str | None = None
    industries: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)


class StudentRecommendationItem(BaseModel):
    """Aggregated recommendation item for the student mobile app."""

    id: UUID
    job_profile_id: UUID
    role_id: UUID | None = None
    role_name: str | None = None
    role_category: str | None = None
    total_score: float
    scores: FourDimensionScores
    gaps: list[GapItem] = Field(default_factory=list)
    match_reasons: list[str] = Field(default_factory=list)
    job_snapshot: JobSnapshot | None = None
    created_at: datetime
    updated_at: datetime


class StudentRecommendationResponse(BaseModel):
    """Recommendation list for the student mobile app."""

    student_id: UUID
    results: list[StudentRecommendationItem] = Field(default_factory=list)


class CareerPathResponse(BaseModel):
    """Student-facing career path payload."""

    student_id: UUID
    job_profile_id: UUID
    role_id: UUID | None = None
    role_name: str | None = None
    role_category: str | None = None
    path: dict[str, Any]


class ProfileCompletionQuestion(BaseModel):
    """One structured question for profile completion."""

    question_id: str
    title: str
    prompt: str
    placeholder: str | None = None
    options: list[str] = Field(default_factory=list)


class ProfileCompletionSessionResponse(BaseModel):
    """Question session for profile completion."""

    student_id: UUID
    questions: list[ProfileCompletionQuestion] = Field(default_factory=list)


class ProfileCompletionAnswer(BaseModel):
    """Single completion answer."""

    question_id: str
    answer: str


class ProfileCompletionApplyRequest(BaseModel):
    """Apply completion answers to a student profile."""

    answers: list[ProfileCompletionAnswer] = Field(default_factory=list)


class ProfileCompletionApplyResponse(BaseModel):
    """Updated profile after applying completion answers."""

    profile: StudentProfileResponse
    applied_updates: list[str] = Field(default_factory=list)
