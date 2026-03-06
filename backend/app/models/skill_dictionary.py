"""Skill dictionary model for semantic matching."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Float, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class SkillDictionary(Base):
    """Skill dictionary - 技能词典（用于语义匹配）."""
    __tablename__ = "skill_dictionary"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # 标准化技能名称
    canonical_name = Column(String(128), nullable=False, index=True)

    # 技能类别（如：编程语言/前端框架/数据库/软技能等）
    category = Column(String(64), nullable=False, index=True)

    # 技能域（如：技术类/通用类/业务类）
    domain = Column(String(64), nullable=False, index=True)

    # 同义词列表（JSON 数组）
    aliases_json = Column(JSON, default=[])

    # 技能等级定义（1-5）
    level_definitions = Column(JSON, default={})

    # 相关技能 ID 列表
    related_skill_ids = Column(ARRAY(UUID), default=[])

    # 向量嵌入（用于语义匹配，需要 pgvector 扩展）
    embedding = Column(ARRAY(Float))

    # 使用统计
    usage_count = Column(Integer, default=0)  # 在 JD 中出现次数
    resume_usage_count = Column(Integer, default=0)  # 在简历中出现次数

    # 版本管理
    version = Column(String(32), nullable=False, default="1.0")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 表级约束和索引
    __table_args__ = (
        # 同一类别下技能名称唯一
        UniqueConstraint('canonical_name', 'category', name='uq_skill_name_category'),
        # 向量索引在迁移脚本中单独创建（需要 pgvector 扩展）
        Index('ix_skill_dict_domain_category', 'domain', 'category'),
    )
