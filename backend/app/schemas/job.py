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
    source_url: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CompanyBrief(BaseModel):
    """Brief company info for job response."""
    id: UUID
    name: str
    industries: str | None = None  # 逗号分隔的字符串
    company_size: str | None = None
    company_stage: str | None = None

    model_config = ConfigDict(from_attributes=True)


class JobWithCompanyResponse(BaseModel):
    """Job with company info for frontend filtering."""
    id: UUID
    title: str
    role: str
    role_id: UUID | None = None
    city: str
    district: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    salary_months: int = 12
    description: str | None = None
    published_at: str | None = None
    source_url: str | None = None
    company_id: UUID | None = None
    company: CompanyBrief | None = None
    benefits: list[str] = []

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


# ---------------------------------------------------------------------------
# Company schemas
# ---------------------------------------------------------------------------
class CompanyBase(BaseModel):
    """Base company schema."""
    name: str
    industries: str | None = None
    company_size: str | None = None
    company_stage: str | None = None
    intro: str | None = None


class CompanyResponse(CompanyBase):
    """Company response schema."""
    id: UUID
    job_count: int = 0
    avg_salary_min: int | None = None
    avg_salary_max: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoleCompanyItem(CompanyResponse):
    """Role-Company association item (for role detail page)."""
    job_count: int = 0  # 该公司在该role下的岗位数
    salary_range: str | None = None  # "8K-15K"
    cities: list[str] = []  # 该公司该role的工作城市

    model_config = ConfigDict(from_attributes=True)


class SalaryDistributionItem(BaseModel):
    """薪资分布项."""
    range: str  # e.g., "3-5K", "5-8K", "8-12K", "12-20K", "20K+"
    count: int


class CityDistributionItem(BaseModel):
    """城市分布项."""
    city: str
    count: int
    avg_salary_min: int | None = None
    avg_salary_max: int | None = None
    top_companies: list[str] = []


class BenefitItem(BaseModel):
    """福利统计项."""
    name: str
    frequency: int


# Role-Company 关联列表响应
class PaginatedRoleCompaniesResponse(BaseModel):
    """Role 下的公司列表响应."""
    items: list[RoleCompanyItem]
    total: int
    page: int
    page_size: int
    total_pages: int
