"""Student profile schemas - 简历解析结果、学生画像、匹配结果定义."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── 简历解析结果 ─────────────────────────────────────────────────────


class EducationItem(BaseModel):
    """教育经历条目."""
    school: str
    degree: Literal["大专", "本科", "硕士", "博士"]
    major: str
    gpa: Optional[float] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    evidence: str


class ExperienceItem(BaseModel):
    """实习/工作经历条目."""
    company: str
    role: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: str
    is_internship: bool = True
    evidence: str


class ProjectItem(BaseModel):
    """项目经历条目."""
    name: str
    description: str
    tech_stack: list[str] = []
    role: str
    outcome: Optional[str] = None
    evidence: str


class SkillItem(BaseModel):
    """技能条目（解析后原始数据）."""
    name: str
    category: Literal["编程语言", "框架", "工具", "领域知识", "软技能", "其他"]
    proficiency: Literal["熟练", "掌握", "了解", "入门"]
    evidence: str


class CertificateItem(BaseModel):
    """证书条目."""
    name: str
    level: Optional[str] = None
    obtained_date: Optional[str] = None
    evidence: str


class AwardItem(BaseModel):
    """获奖条目."""
    name: str
    level: Literal["国家级", "省级", "校级", "其他"]
    date: Optional[str] = None
    evidence: str


class ResumeParseResult(BaseModel):
    """简历解析结果（LLM 输出）."""
    raw_text: str
    education: list[EducationItem] = []
    experience: list[ExperienceItem] = []
    projects: list[ProjectItem] = []
    skills: list[SkillItem] = []
    certificates: list[CertificateItem] = []
    awards: list[AwardItem] = []
    self_intro: Optional[str] = None
    parse_confidence: float = 0.0
    missing_fields: list[str] = []

    model_config = ConfigDict(from_attributes=True)


# ── 学生画像 ───────────────────────────────────────────────────────


class NormalizedSkill(BaseModel):
    """标准化后的技能."""
    name: str
    category: str
    proficiency: str
    source: str  # "resume" / "inferred"


class SoftSkillEvidence(BaseModel):
    """软技能证据与评分."""
    dimension: Literal["沟通能力", "团队协作", "抗压能力", "创新能力", "学习能力"]
    score: float  # 0-1
    evidence: str


class StudentProfile(BaseModel):
    """完整学生画像."""
    student_id: int
    completeness_score: float
    competitiveness_score: float
    education_level: Literal["大专", "本科", "硕士", "博士"]
    major: str
    graduation_year: Optional[int] = None
    skills: list[NormalizedSkill] = []
    experience_months: int = 0
    project_count: int = 0
    certificate_names: list[str] = []
    award_level: Literal["无", "校级", "省级", "国家级"] = "无"
    soft_skills: list[SoftSkillEvidence] = []
    missing_suggestions: list[str] = []
    version: str = "v1"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ── 匹配结果 ───────────────────────────────────────────────────────


class GapItem(BaseModel):
    """差距分析条目."""
    item: str
    current: str
    required: str
    priority: Literal["高", "中", "低"]
    suggestion: str


class MatchingResult(BaseModel):
    """人岗匹配结果."""
    student_id: int
    role_id: int
    total_score: float
    basic_score: float
    skill_score: float
    quality_score: float
    potential_score: float
    weights: dict
    gap_items: list[GapItem] = []
    matched_skills: list[str] = []
    missing_skills: list[str] = []
    bonus_skills: list[str] = []
    evidence_summary: str = ""
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ── API 请求/响应 ─────────────────────────────────────────────────


class ResumeUploadRequest(BaseModel):
    """简历上传请求."""
    student_id: Optional[int] = None


class ResumeUploadResponse(BaseModel):
    """简历上传响应."""
    resume_id: int
    student_id: int
    parse_result: ResumeParseResult
    warnings: list[str] = []


class ProfileGenerateRequest(BaseModel):
    """画像生成请求."""
    resume_id: int


class MatchingRequest(BaseModel):
    """单岗位匹配请求."""
    student_id: int
    role_id: int


class RecommendRequest(BaseModel):
    """推荐请求."""
    top_n: int = Field(default=5, ge=1, le=20)


class RecommendResponse(BaseModel):
    """推荐响应."""
    results: list[dict]
    total: int