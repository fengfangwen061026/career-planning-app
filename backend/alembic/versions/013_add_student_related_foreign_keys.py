"""Add missing student-related foreign key constraints.

Revision ID: 013_student_fks
Revises: 012_add_jobs_role_id
Create Date: 2026-04-20
"""
from typing import Sequence, Union

from alembic import op


revision: str = "013_student_fks"
down_revision: Union[str, None] = "012_add_jobs_role_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM report_versions rv
        WHERE NOT EXISTS (
            SELECT 1
            FROM career_reports cr
            WHERE cr.id = rv.report_id
        )
        """
    )
    op.execute(
        """
        DELETE FROM match_results mr
        WHERE NOT EXISTS (
            SELECT 1
            FROM student_profiles sp
            WHERE sp.id = mr.student_profile_id
        )
        OR NOT EXISTS (
            SELECT 1
            FROM job_profiles jp
            WHERE jp.id = mr.job_profile_id
        )
        """
    )
    op.execute(
        """
        DELETE FROM resumes r
        WHERE NOT EXISTS (
            SELECT 1
            FROM students s
            WHERE s.id = r.student_id
        )
        """
    )
    op.execute(
        """
        DELETE FROM student_profiles sp
        WHERE NOT EXISTS (
            SELECT 1
            FROM students s
            WHERE s.id = sp.student_id
        )
        """
    )
    op.execute(
        """
        DELETE FROM career_reports cr
        WHERE NOT EXISTS (
            SELECT 1
            FROM students s
            WHERE s.id = cr.student_id
        )
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'resumes_student_id_fkey'
            ) THEN
                ALTER TABLE resumes
                ADD CONSTRAINT resumes_student_id_fkey
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
            END IF;
        END
        $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'student_profiles_student_id_fkey'
            ) THEN
                ALTER TABLE student_profiles
                ADD CONSTRAINT student_profiles_student_id_fkey
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
            END IF;
        END
        $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'career_reports_student_id_fkey'
            ) THEN
                ALTER TABLE career_reports
                ADD CONSTRAINT career_reports_student_id_fkey
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
            END IF;
        END
        $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'report_versions_report_id_fkey'
            ) THEN
                ALTER TABLE report_versions
                ADD CONSTRAINT report_versions_report_id_fkey
                FOREIGN KEY (report_id) REFERENCES career_reports(id) ON DELETE CASCADE;
            END IF;
        END
        $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'match_results_student_profile_id_fkey'
            ) THEN
                ALTER TABLE match_results
                ADD CONSTRAINT match_results_student_profile_id_fkey
                FOREIGN KEY (student_profile_id) REFERENCES student_profiles(id) ON DELETE CASCADE;
            END IF;
        END
        $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'match_results_job_profile_id_fkey'
            ) THEN
                ALTER TABLE match_results
                ADD CONSTRAINT match_results_job_profile_id_fkey
                FOREIGN KEY (job_profile_id) REFERENCES job_profiles(id) ON DELETE CASCADE;
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE match_results DROP CONSTRAINT IF EXISTS match_results_job_profile_id_fkey")
    op.execute("ALTER TABLE match_results DROP CONSTRAINT IF EXISTS match_results_student_profile_id_fkey")
    op.execute("ALTER TABLE report_versions DROP CONSTRAINT IF EXISTS report_versions_report_id_fkey")
    op.execute("ALTER TABLE career_reports DROP CONSTRAINT IF EXISTS career_reports_student_id_fkey")
    op.execute("ALTER TABLE student_profiles DROP CONSTRAINT IF EXISTS student_profiles_student_id_fkey")
    op.execute("ALTER TABLE resumes DROP CONSTRAINT IF EXISTS resumes_student_id_fkey")
