"""Add published_at and source_url to jobs table

Revision ID: 005_add_published_at_source_url
Revises: 004_companies_table
Create Date: 2026-03-08 00:00:00.000000

Changes:
- Add published_at column to jobs (already exists, adjust type to VARCHAR)
- Add source_url column to jobs
- Migrate data from Excel file
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '005_add_published_at_source_url'
down_revision: Union[str, None] = '004_companies_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # published_at already exists as timestamp, change to VARCHAR to preserve original format
    op.execute("ALTER TABLE jobs ALTER COLUMN published_at TYPE VARCHAR(50)")

    # Add source_url column
    op.execute("""
        ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS source_url TEXT
    """)

    # Create index
    op.execute("CREATE INDEX IF NOT EXISTS idx_jobs_published_at ON jobs(published_at)")


def downgrade() -> None:
    op.execute("ALTER TABLE jobs DROP COLUMN IF EXISTS source_url")
    op.execute("ALTER TABLE jobs ALTER COLUMN published_at TYPE TIMESTAMP")
