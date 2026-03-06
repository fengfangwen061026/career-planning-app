"""Student related models."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Student(Base):
    """Student user model - 学生基本信息."""
    __tablename__ = "students"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # 基本信息
    email = Column(String(500), unique=True, nullable=False, index=True)
    name = Column(String(200))
    phone = Column(String(50))
    gender = Column(String(10))
    birth_date = Column(DateTime)

    # 位置信息
    location = Column(String(200))  # 当前所在城市
    hometown = Column(String(200))  # 籍贯

    # 求职意向
    job_intention = Column(String(200))  # 期望职位
    expected_salary_min = Column(Integer)  # 期望最低月薪
    expected_salary_max = Column(Integer)  # 期望最高月薪

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    resumes = relationship("Resume", back_populates="student")
    student_profile = relationship("StudentProfile", back_populates="student", uselist=False)
    career_reports = relationship("CareerReport", back_populates="student")


class Resume(Base):
    """Resume/CV model - 简历文件."""
    __tablename__ = "resumes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)

    # 文件信息
    filename = Column(String(500))
    file_path = Column(String(1000))
    file_type = Column(String(20))  # pdf, docx 等

    # 解析内容
    raw_text = Column(Text)  # 提取的原始文本
    parsed_json = Column(JSON)  # 解析后的结构化数据

    # 是否为主简历
    is_primary = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    student = relationship("Student", back_populates="resumes")


class StudentProfile(Base):
    """Student profile model - 学生画像（基于统一四维框架）."""
    __tablename__ = "student_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # 画像内容（JSONB 存储四维结构化数据）
    profile_json = Column(JSON, nullable=False)  # 完整画像结构

    # 完整度评分（0-1）
    completeness_score = Column(Float, default=0.0)

    # 证据来源
    evidence_json = Column(JSON, default={})

    # 版本管理
    version = Column(String(32), nullable=False, default="1.0")

    # 向量嵌入（用于语义匹配）
    embedding = Column(ARRAY(Float))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    student = relationship("Student", back_populates="student_profile")
    match_results = relationship("MatchResult", back_populates="student_profile")

    # 表级索引
    __table_args__ = (
        # GIN 索引用于 JSONB 查询
        # 向量索引在迁移脚本中单独创建（需要 pgvector 扩展）
    )
