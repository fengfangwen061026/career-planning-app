"""Add role_id to jobs table.

Revision ID: 012_add_jobs_role_id
Revises: 011
Create Date: 2026-04-11
"""
from typing import Sequence, Union


revision: str = "012_add_jobs_role_id"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from alembic import op

    op.execute(
        """
        ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS role_id UUID
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_jobs_role_id
        ON jobs(role_id)
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'jobs_role_id_fkey'
            ) THEN
                ALTER TABLE jobs
                ADD CONSTRAINT jobs_role_id_fkey
                FOREIGN KEY (role_id) REFERENCES roles(id);
            END IF;
        END
        $$;
        """
    )
    op.execute(
        """
        UPDATE jobs j
        SET role_id = r.id
        FROM roles r
        WHERE j.role = r.name
          AND j.role_id IS NULL
        """
    )


def downgrade() -> None:
    from alembic import op

    op.execute("ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_role_id_fkey")
    op.execute("DROP INDEX IF EXISTS ix_jobs_role_id")
    op.execute("ALTER TABLE jobs DROP COLUMN IF EXISTS role_id")
