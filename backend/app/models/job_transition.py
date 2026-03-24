# backend/app/models/job_transition.py
from sqlalchemy import Column, Integer, String, Float, JSON, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class JobTransition(Base):
    """岗位间横向换岗关系"""
    __tablename__ = "job_transitions"

    id = Column(Integer, primary_key=True, index=True)
    source_job_profile_id = Column(UUID(as_uuid=True), ForeignKey("job_profiles.id"), nullable=False, index=True)
    target_job_profile_id = Column(UUID(as_uuid=True), ForeignKey("job_profiles.id"), nullable=False, index=True)

    source_role_name = Column(String(100), nullable=False)
    target_role_name = Column(String(100), nullable=False)

    # 核心指标
    skill_overlap_ratio = Column(Float, nullable=False)  # 技能重叠度 0.0 ~ 1.0
    transition_difficulty = Column(Float, nullable=False)  # 转岗难度 0.0 ~ 1.0（越高越难）

    # 详细数据
    shared_skills = Column(JSON, nullable=True)       # 共有技能列表 ["Python", "SQL", ...]
    gap_skills = Column(JSON, nullable=True)           # 目标岗位需要但来源岗位没有的技能
    transferable_skills = Column(JSON, nullable=True)  # 可迁移的技能（来源有但目标没明确要求的）

    # 转岗建议
    transition_advice = Column(String(500), nullable=True)  # 一句话转岗建议

    created_at = Column(DateTime(timezone=True), server_default=func.now())
