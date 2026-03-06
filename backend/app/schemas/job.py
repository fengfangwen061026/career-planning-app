"""Job related schemas."""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class JobBase(BaseModel):
    """Base job schema."""
    title: str
    role: str
    sub_role: str | None = None
    city: str
    district: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    salary_months: int = 12
    company_name: str
    industries: list[str] | None = None
    company_size: str | None = None
    company_stage: str | None = None
    description: str | None = None
    skills: list[str] | None = None
    education_req: str | None = None
    experience_req: str | None = None
    company_intro: str | None = None


class JobCreate(JobBase):
    """Job creation schema."""
    job_code: str


class JobUpdate(BaseModel):
    """Job update schema."""
    title: str | None = None
    role: str | None = None
    sub_role: str | None = None
    city: str | None = None
    district: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    salary_months: int | None = None
    company_name: str | None = None
    industries: list[str] | None = None
    company_size: str | None = None
    company_stage: str | None = None
    description: str | None = None
    skills: list[str] | None = None
    education_req: str | None = None
    experience_req: str | None = None
    company_intro: str | None = None
    role_id: UUID | None = None


class JobResponse(JobBase):
    """Job response schema."""
    id: UUID
    job_code: str
    role_id: UUID | None = None
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoleBase(BaseModel):
    """Base role schema."""
    name: str
    category: str
    level: str | None = None
    description: str | None = None


class RoleCreate(RoleBase):
    """Role creation schema."""
    pass


class RoleResponse(RoleBase):
    """Role response schema."""
    id: UUID
    job_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JobProfileBase(BaseModel):
    """Base job profile schema."""
    skills: list[str] | None = None
    experience_years: dict[str, Any] | None = None
    education: list[dict[str, Any]] | None = None
    competencies: list[str] | None = None
    career_path: list[dict[str, Any]] | None = None


class JobProfileCreate(JobProfileBase):
    """Job profile creation schema."""
    job_id: UUID


class JobProfileResponse(BaseModel):
    """Job profile response schema."""
    id: UUID
    job_id: UUID | None = None
    role_id: UUID
    profile_json: dict[str, Any]
    evidence_json: dict[str, Any] | None = None
    version: int = 1
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JobProfileUpdate(BaseModel):
    """人工微调画像请求体."""
    profile_json: dict[str, Any]


class JobProfileGenerateResponse(BaseModel):
    """画像生成结果."""
    role_id: UUID
    role_name: str
    version: int
    profile: JobProfileResponse
    stats: dict[str, Any] | None = None


class JobProfileHistoryResponse(BaseModel):
    """画像历史版本列表."""
    role_id: UUID
    role_name: str
    profiles: list[JobProfileResponse]


class BatchGenerateResponse(BaseModel):
    """批量生成结果."""
    total: int
    succeeded: int
    failed: int
    results: list[JobProfileGenerateResponse]
    errors: list[dict[str, Any]]


# Paginated response schemas
class PaginatedJobResponse(BaseModel):
    """Paginated job list response."""
    items: list[JobResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
