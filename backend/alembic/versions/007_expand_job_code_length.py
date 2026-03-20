"""Expand jobs.job_code length to match current model.

Revision ID: 007_expand_job_code_length
Revises: 006_recommendation_jsonb_indexes
Create Date: 2026-03-20 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "007_expand_job_code_length"
down_revision: Union[str, None] = "006_recommendation_jsonb_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "jobs",
        "job_code",
        existing_type=sa.String(length=64),
        type_=sa.String(length=200),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "jobs",
        "job_code",
        existing_type=sa.String(length=200),
        type_=sa.String(length=64),
        existing_nullable=False,
    )
