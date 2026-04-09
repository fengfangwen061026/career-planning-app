"""Career report related models."""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class CareerReport(Base):
    """Career report model."""

    __tablename__ = "career_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status = Column(String(32), nullable=False, default="pending")
    version = Column(String(32), nullable=False, default="1.0")

    pdf_path = Column(String(1000))
    docx_path = Column(String(1000))

    content_json = Column(JSON, nullable=True)
    summary = Column(Text)
    recommendations = Column(JSON)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", back_populates="career_reports")


class ReportVersion(Base):
    """Report version history."""

    __tablename__ = "report_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(
        UUID(as_uuid=True),
        ForeignKey("career_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    version = Column(String(50), nullable=False)
    content = Column(JSON)
    change_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
