"""Matching related schemas - 四维度人岗匹配评分体系."""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ── 技能匹配明细 ──────────────────────────────────────────────────

class SkillMatchItem(BaseModel):
    """单项技能匹配结果."""
    skill_name: str
    importance: str = "required"  # required / preferred / bonus
    weight: float = 1.0
    matched: bool = False
    score: float = 0.0  # 0-100
    semantic_similarity: float | None = None  # 向量语义补偿分
    evidence: str = ""  # 来自简历的哪个部分
    matched_by: str = ""  # exact / semantic / none


# ── 职业素养维度 ──────────────────────────────────────────────────

class CompetencyItem(BaseModel):
    """单项职业素养评估."""
    dimension: str  # communication / teamwork / stress_tolerance / ...
    score: float = 0.0  # 0-100
    evidence: str = ""
    confidence: float = 0.0  # 0-1


# ── 发展潜力维度 ──────────────────────────────────────────────────

class PotentialItem(BaseModel):
    """单项发展潜力评估."""
    dimension: str  # growth_trajectory / self_driven / learning_speed
    score: float = 0.0  # 0-100
    evidence: str = ""
    confidence: float = 0.0  # 0-1


# ── 四维评分详情 ──────────────────────────────────────────────────

class BasicScore(BaseModel):
    """基础要求评分详情."""
    score: float = 0.0  # 总分 0-100
    education_match: dict[str, Any] = Field(default_factory=dict)
    major_match: dict[str, Any] = Field(default_factory=dict)
    experience_match: dict[str, Any] = Field(default_factory=dict)
    hard_conditions: list[dict[str, Any]] = Field(default_factory=list)
    penalties: list[dict[str, Any]] = Field(default_factory=list)


class SkillScore(BaseModel):
    """职业技能评分详情."""
    score: float = 0.0  # 总分 0-100
    required_score: float = 0.0
    preferred_score: float = 0.0
    bonus_score: float = 0.0
    items: list[SkillMatchItem] = Field(default_factory=list)


class CompetencyScore(BaseModel):
    """职业素养评分详情."""
    score: float = 0.0  # 总分 0-100
    items: list[CompetencyItem] = Field(default_factory=list)


class PotentialScore(BaseModel):
    """发展潜力评分详情."""
    score: float = 0.0  # 总分 0-100
    items: list[PotentialItem] = Field(default_factory=list)


class FourDimensionScores(BaseModel):
    """四维评分汇总."""
    basic: BasicScore = Field(default_factory=BasicScore)
    skill: SkillScore = Field(default_factory=SkillScore)
    competency: CompetencyScore = Field(default_factory=CompetencyScore)
    potential: PotentialScore = Field(default_factory=PotentialScore)
    weights: dict[str, float] = Field(default_factory=dict)
    total_score: float = 0.0  # 加权总分 0-100


# ── 差距分析 ──────────────────────────────────────────────────────

class GapItem(BaseModel):
    """差距分析条目."""
    gap_item: str
    dimension: str  # basic / skill / competency / potential
    current_level: str
    required_level: str
    priority: str  # high / medium / low
    suggestion: str


# ── API 请求/响应 ─────────────────────────────────────────────────

class MatchResultBase(BaseModel):
    """Base match result schema."""
    total_score: float = 0.0
    scores: FourDimensionScores = Field(default_factory=FourDimensionScores)
    gaps: list[GapItem] = Field(default_factory=list)
    match_reasons: list[str] = Field(default_factory=list)


class MatchResultCreate(BaseModel):
    """Match result creation schema (internal)."""
    student_profile_id: UUID
    job_profile_id: UUID
    total_score: float
    scores_json: dict[str, Any]
    gaps_json: list[dict[str, Any]]


class MatchResultResponse(MatchResultBase):
    """Match result response schema."""
    id: UUID
    student_profile_id: UUID
    job_profile_id: UUID
    job_title: str | None = None  # 岗位名称
    role_name: str | None = None  # 角色名称
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MatchingRequest(BaseModel):
    """Request schema for single match."""
    student_id: UUID
    job_profile_id: UUID


class RecommendRequest(BaseModel):
    """Request schema for job recommendation."""
    top_k: int = Field(default=10, ge=1, le=50)
    role_category: str | None = None  # 可选：按岗位类别过滤


class MatchingResponse(BaseModel):
    """Response schema for matching results."""
    student_id: UUID
    results: list[MatchResultResponse]


# ── 权重配置 ──────────────────────────────────────────────────────

class WeightConfig(BaseModel):
    """四维权重配置，可按 Role 类型调整."""
    basic: float = 0.20
    skill: float = 0.35
    competency: float = 0.25
    potential: float = 0.20

    def normalized(self) -> "WeightConfig":
        total = self.basic + self.skill + self.competency + self.potential
        if total == 0:
            return WeightConfig()
        return WeightConfig(
            basic=self.basic / total,
            skill=self.skill / total,
            competency=self.competency / total,
            potential=self.potential / total,
        )


# 预设权重
WEIGHT_PRESETS: dict[str, WeightConfig] = {
    "技术类": WeightConfig(basic=0.15, skill=0.40, competency=0.20, potential=0.25),
    "运营类": WeightConfig(basic=0.20, skill=0.30, competency=0.30, potential=0.20),
    "销售类": WeightConfig(basic=0.15, skill=0.25, competency=0.40, potential=0.20),
    "管理类": WeightConfig(basic=0.15, skill=0.20, competency=0.40, potential=0.25),
    "设计类": WeightConfig(basic=0.15, skill=0.40, competency=0.25, potential=0.20),
    "default": WeightConfig(basic=0.20, skill=0.35, competency=0.25, potential=0.20),
}
