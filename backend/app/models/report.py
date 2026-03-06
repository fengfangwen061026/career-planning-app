"""Career report related models."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class CareerReport(Base):
    """Career report model - 职业报告."""
    __tablename__ = "career_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)

    # 报告内容（JSONB 存储）
    content_json = Column(JSON, nullable=False)  # 完整报告结构

    # 状态
    status = Column(String(32), nullable=False, default="pending")  # pending/generating/completed/failed

    # 版本管理
    version = Column(String(32), nullable=False, default="1.0")

    # 导出文件路径
    pdf_path = Column(String(1000))
    docx_path = Column(String(1000))

    # 元信息
    summary = Column(Text)  # 执行摘要
    recommendations = Column(JSON)  # 推荐建议列表

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    student = relationship("Student", back_populates="career_reports")


class ReportVersion(Base):
    """Report version history - 报告版本历史."""
    __tablename__ = "report_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("career_reports.id", ondelete="CASCADE"), nullable=False, index=True)

    version = Column(String(50), nullable=False)
    content = Column(JSON)  # 完整报告内容快照

    change_notes = Column(Text)  # 变更说明

    created_at = Column(DateTime, default=datetime.utcnow)
