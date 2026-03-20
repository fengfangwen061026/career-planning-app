"""Matching related models."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class MatchResult(Base):
    """Match result between student profile and job profile."""
    __tablename__ = "match_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # 关联
    student_profile_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    job_profile_id = Column(UUID(as_uuid=True), ForeignKey("job_profiles.id", ondelete="CASCADE"), nullable=False, index=True)

    # 评分结果
    total_score = Column(Float, nullable=False, index=True)  # 总分 0-1

    # 详细评分（JSONB 存储四维评分结构）
    scores_json = Column(JSONB, nullable=False)  # 各维度评分详情

    # 技能差距分析
    gaps_json = Column(JSONB, default=list)  # 技能缺口详情

    # 版本管理
    version = Column(String(32), nullable=False, default="1.0")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    student_profile = relationship("StudentProfile", back_populates="match_results")
    job_profile = relationship("JobProfile", back_populates="match_results")

    # 表级约束和索引
    __table_args__ = (
        # 唯一约束：同一学生-岗位组合只保留一条
        Index('ix_match_unique', 'student_profile_id', 'job_profile_id', unique=True),
    )


class MatchScore(Base):
    """Individual match score component (deprecated - use scores_json in MatchResult)."""
    __tablename__ = "match_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_result_id = Column(UUID(as_uuid=True), nullable=False)
    score_type = Column(String(100), nullable=False)  # skill, experience, education, etc.
    score = Column(Float, nullable=False)
    details = Column(JSON)

    created_at = Column(DateTime, default=datetime.utcnow)
