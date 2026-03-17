"""Add companies table and migrate company data

Revision ID: 004_companies_table
Revises: 003_vector_indexes
Create Date: 2026-03-08 00:00:00.000000

Changes:
- Create companies table (name, industries, company_size, company_stage, intro, stats)
- Add company_id to jobs table
- Migrate company data from jobs to companies
- Update jobs.company_id foreign key
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '004_companies_table'
down_revision: Union[str, None] = '003_vector_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create companies table
    op.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            industries VARCHAR(500),
            company_size VARCHAR(100),
            company_stage VARCHAR(100),
            intro TEXT,
            job_count INTEGER DEFAULT 0,
            avg_salary_min INTEGER,
            avg_salary_max INTEGER,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(name)
        )
    """)

    # 2. Create indexes
    op.execute("CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name)")

    # 3. Add company_id to jobs table
    op.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id)")

    # 4. Create index on jobs.company_id
    op.execute("CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id)")

    # 5. Migrate company data (distinct companies)
    op.execute("""
        INSERT INTO companies (name, industries, company_size, company_stage, intro, job_count)
        SELECT DISTINCT ON (company_name)
            company_name,
            industries,
            company_size,
            company_stage,
            company_intro,
            0
        FROM jobs
        WHERE company_name IS NOT NULL AND company_name != ''
        ON CONFLICT (name) DO NOTHING
    """)

    # 6. Update job_count
    op.execute("""
        UPDATE companies c
        SET job_count = (
            SELECT COUNT(*) FROM jobs j WHERE j.company_name = c.name
        )
    """)

    # 7. Update jobs.company_id
    op.execute("""
        UPDATE jobs j
        SET company_id = c.id
        FROM companies c
        WHERE j.company_name = c.name AND j.company_id IS NULL
    """)

    # 8. Update average salary
    op.execute("""
        UPDATE companies c
        SET avg_salary_min = sub.avg_min, avg_salary_max = sub.avg_max
        FROM (
            SELECT company_id,
                   AVG(salary_min)::INTEGER as avg_min,
                   AVG(salary_max)::INTEGER as avg_max
            FROM jobs
            WHERE company_id IS NOT NULL AND salary_min > 0
            GROUP BY company_id
        ) sub
        WHERE c.id = sub.company_id
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE jobs DROP COLUMN IF EXISTS company_id")
    op.execute("DROP TABLE IF EXISTS companies")
