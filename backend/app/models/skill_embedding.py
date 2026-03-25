"""Skill embedding model - persistent cache for skill name embeddings."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, UUID

from app.database import Base


class SkillEmbedding(Base):
    """Skill embedding cache table - stores pre-computed embeddings for skill names.

    Uses skill text as unique key (normalized lowercase) to avoid duplicate embeddings
    for the same skill. Embeddings are computed once and reused across all matching
    operations.
    """

    __tablename__ = "skill_embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Normalized skill name (lowercase, no spaces) - unique key for cache lookups
    skill_name_normalized = Column(String(255), nullable=False, unique=True, index=True)

    # Original skill name for display purposes
    skill_name_original = Column(String(255), nullable=False)

    # The embedding vector (1536 dimensions for text-embedding-v4)
    embedding = Column(ARRAY(Float), nullable=False)

    # Model used to generate this embedding (for cache invalidation if model changes)
    model_name = Column(String(100), nullable=False, default="text-embedding-v4")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("skill_name_normalized", name="uq_skill_embeddings_normalized_name"),
    )
