"""Job related models."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, Integer, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Job(Base):
    """Job posting model - 原始 JD 数据."""
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # 原始岗位编码（去重键）
    job_code = Column(String(200), unique=True, nullable=False, index=True)

    # 基础信息
    title = Column(String(128), nullable=False)  # 原始岗位名称
    role = Column(String(64), nullable=False, index=True)  # 归一化 Role 大类
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), index=True)  # Role 外键
    sub_role = Column(String(64))  # 细分方向

    # 地址
    city = Column(String(32), nullable=False, index=True)
    district = Column(String(32))

    # 薪资
    salary_min = Column(Integer)  # 最低月薪（元）
    salary_max = Column(Integer)  # 最高月薪（元）
    salary_months = Column(SmallInteger, default=12)  # 年薪月数

    # 公司信息
    company_name = Column(String(256), nullable=False)
    industries = Column(ARRAY(String), default=[])  # 所属行业数组
    company_size = Column(String(32))  # 公司规模
    company_stage = Column(String(32))  # 融资阶段

    # 岗位详情
    description = Column(Text)  # 清洗后的岗位详情
    skills = Column(ARRAY(String), default=[])  # 提取的技能关键词数组
    education_req = Column(String(32))  # 最低学历要求
    experience_req = Column(String(32))  # 工作经验要求

    # 公司简介
    company_intro = Column(Text)

    # 发布日期
    published_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    job_profile = relationship("JobProfile", back_populates="job", uselist=False)
    role_obj = relationship("Role", back_populates="jobs")


class Role(Base):
    """归一化岗位角色表."""
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    name = Column(String(64), nullable=False, unique=True, index=True)  # Role 名称
    category = Column(String(64), nullable=False, index=True)  # 类别（如：技术类/运营类/销售类）
    level = Column(String(32))  # 级别：entry/growing/mature/expert
    description = Column(Text)  # Role 描述

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    jobs = relationship("Job", back_populates="role_obj")
    job_profiles = relationship("JobProfile", back_populates="role")
    graph_nodes = relationship("GraphNode", back_populates="role")


class JobProfile(Base):
    """Job profile model - 岗位画像（基于统一四维框架）."""
    __tablename__ = "job_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # 关联（role_id 为主键关联，job_id 保留向后兼容）
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False, index=True)

    # 画像内容（JSONB 存储四维结构化数据）
    profile_json = Column(JSON, nullable=False)  # 完整画像结构
    evidence_json = Column(JSON, default={})  # 证据来源

    # 版本管理（整数自增，同一 role 新版本不覆盖旧版本）
    version = Column(Integer, nullable=False, default=1)

    # 向量嵌入（用于语义匹配）
    embedding = Column(ARRAY(Float))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    job = relationship("Job", back_populates="job_profile", foreign_keys=[job_id])
    role = relationship("Role", back_populates="job_profiles")
    match_results = relationship("MatchResult", back_populates="job_profile")

    # 表级约束：同一 Role 的版本号唯一
    __table_args__ = (
        UniqueConstraint("role_id", "version", name="uq_job_profiles_role_version"),
    )
