"""Career report related models."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class CareerReport(Base):
    """Career report model - 职业报告."""
    __tablename__ = "career_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)

    # 状态
    status = Column(String(32), nullable=False, default="pending")  # pending/generating/done/failed

    # 版本管理
    version = Column(String(32), nullable=False, default="1.0")

    # 导出文件路径
    pdf_path = Column(String(1000))
    docx_path = Column(String(1000))

    # 旧版整体 JSON（保留向后兼容）
    content_json = Column(JSON, nullable=True)
    summary = Column(Text)
    recommendations = Column(JSON)

    # 五章分字段存储（新版）
    # 第一章：个人优势总结（纯文字）
    chapter_1_text = Column(Text, nullable=True)

    # 第二章：目标岗位分析（文字 + 四维分数 JSON）
    chapter_2_text = Column(Text, nullable=True)
    chapter_2_data = Column(Text, nullable=True)  # JSON string: {overall_score, dimensions}

    # 第三章：差距与行动计划（文字引言 + 行动项 JSON）
    chapter_3_text = Column(Text, nullable=True)
    chapter_3_data = Column(Text, nullable=True)  # JSON string: [{priority, item, action, timeline, ...}]

    # 第四章：职业路径规划（文字 + 路径节点 JSON）
    chapter_4_text = Column(Text, nullable=True)
    chapter_4_data = Column(Text, nullable=True)  # JSON string: {primary_path, alt_paths}

    # 第五章：评估周期（纯文字）
    chapter_5_text = Column(Text, nullable=True)

    # 已完成章节数（0–5），前端轮询用
    chapters_done = Column(Integer, default=0, nullable=False)

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
