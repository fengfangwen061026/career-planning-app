"""Add career path cache table.

Revision ID: 010
Revises: 009_add_skill_embeddings
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa


revision = "010"
down_revision = "009_add_skill_embeddings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "career_path_cache",
        sa.Column("cache_key", sa.String(256), primary_key=True),
        sa.Column("query_type", sa.String(32), nullable=False),
        sa.Column("from_role", sa.String(128), nullable=True),
        sa.Column("to_role", sa.String(128), nullable=True),
        sa.Column("student_id", sa.String(64), nullable=True),
        sa.Column("result_json", sa.JSON, nullable=False),
        sa.Column("graph_version", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    # Index for cache lookup by query params
    op.create_index("ix_career_path_cache_query_type", "career_path_cache", ["query_type"])
    op.create_index("ix_career_path_cache_graph_version", "career_path_cache", ["graph_version"])


def downgrade() -> None:
    op.drop_index("ix_career_path_cache_graph_version", table_name="career_path_cache")
    op.drop_index("ix_career_path_cache_query_type", table_name="career_path_cache")
    op.drop_table("career_path_cache")
