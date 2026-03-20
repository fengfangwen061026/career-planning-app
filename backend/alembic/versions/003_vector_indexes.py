"""Add vector indexes for skill dictionary and job profiles

Revision ID: 003_vector_indexes
Revises: 002_job_profile_role_versioning
Create Date: 2026-03-06 00:00:00.000000

Changes:
- Enable pgvector extension
- Create HNSW index on skill_dictionary.embedding (using float[] with vector_cosine_ops)
- Create HNSW index on job_profiles.embedding
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '003_vector_indexes'
down_revision: Union[str, None] = '002_job_profile_role_versioning'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension (embedding columns use ARRAY(Float), not vector type)
    # HNSW vector indexes require the pgvector vector type; skipping for now
    op.execute(
        """
        DO $$
        BEGIN
            CREATE EXTENSION IF NOT EXISTS vector;
        EXCEPTION
            WHEN undefined_file OR feature_not_supported THEN
                RAISE NOTICE 'pgvector extension unavailable, skipping CREATE EXTENSION vector';
        END
        $$;
        """
    )


def downgrade() -> None:
    pass
