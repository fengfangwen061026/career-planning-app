"""Convert recommendation JSON fields to JSONB and add indexes.

Revision ID: 006_recommendation_jsonb_indexes
Revises: 005_add_published_at_source_url
Create Date: 2026-03-19 00:00:00.000000
"""

from typing import Sequence, Union


revision: str = "006_recommendation_jsonb_indexes"
down_revision: Union[str, None] = "005_add_published_at_source_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from alembic import op

    op.execute(
        """
        ALTER TABLE job_profiles
        ALTER COLUMN profile_json TYPE JSONB USING profile_json::jsonb,
        ALTER COLUMN evidence_json TYPE JSONB USING evidence_json::jsonb
        """
    )
    op.execute(
        """
        ALTER TABLE student_profiles
        ALTER COLUMN profile_json TYPE JSONB USING profile_json::jsonb,
        ALTER COLUMN evidence_json TYPE JSONB USING evidence_json::jsonb
        """
    )
    op.execute(
        """
        ALTER TABLE match_results
        ALTER COLUMN scores_json TYPE JSONB USING scores_json::jsonb,
        ALTER COLUMN gaps_json TYPE JSONB USING gaps_json::jsonb
        """
    )

    op.execute(
        """
        UPDATE match_results
        SET gaps_json = '[]'::jsonb
        WHERE gaps_json IS NULL OR jsonb_typeof(gaps_json) != 'array'
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_match_results_student_total
        ON match_results (student_profile_id, total_score DESC)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_match_results_job_profile_id
        ON match_results (job_profile_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_job_profiles_profile_json_gin
        ON job_profiles USING GIN (profile_json)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_student_profiles_profile_json_gin
        ON student_profiles USING GIN (profile_json)
        """
    )


def downgrade() -> None:
    from alembic import op

    op.execute("DROP INDEX IF EXISTS ix_student_profiles_profile_json_gin")
    op.execute("DROP INDEX IF EXISTS ix_job_profiles_profile_json_gin")
    op.execute("DROP INDEX IF EXISTS ix_match_results_job_profile_id")
    op.execute("DROP INDEX IF EXISTS ix_match_results_student_total")

    op.execute(
        """
        ALTER TABLE match_results
        ALTER COLUMN scores_json TYPE JSON USING scores_json::json,
        ALTER COLUMN gaps_json TYPE JSON USING gaps_json::json
        """
    )
    op.execute(
        """
        ALTER TABLE student_profiles
        ALTER COLUMN profile_json TYPE JSON USING profile_json::json,
        ALTER COLUMN evidence_json TYPE JSON USING evidence_json::json
        """
    )
    op.execute(
        """
        ALTER TABLE job_profiles
        ALTER COLUMN profile_json TYPE JSON USING profile_json::json,
        ALTER COLUMN evidence_json TYPE JSON USING evidence_json::json
        """
    )
