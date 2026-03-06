"""Job profile: role-level versioning support

Revision ID: 002_job_profile_role_versioning
Revises: 001_initial
Create Date: 2026-03-05 00:00:00.000000

Changes:
- job_id: remove unique constraint, make nullable
- role_id: make NOT NULL
- version: change from varchar to integer
- Add unique constraint on (role_id, version)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '002_job_profile_role_versioning'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop old unique constraint on job_id
    op.drop_constraint('job_profiles_job_id_key', 'job_profiles', type_='unique')

    # 2. Make job_id nullable
    op.alter_column('job_profiles', 'job_id',
                     existing_type=postgresql.UUID(as_uuid=True),
                     nullable=True)

    # 3. Make role_id NOT NULL
    op.alter_column('job_profiles', 'role_id',
                     existing_type=postgresql.UUID(as_uuid=True),
                     nullable=False)

    # 4. Change version from varchar to integer (drop default first to avoid cast conflict)
    op.execute("ALTER TABLE job_profiles ALTER COLUMN version DROP DEFAULT")
    op.execute("ALTER TABLE job_profiles ALTER COLUMN version TYPE integer USING 1")
    op.alter_column('job_profiles', 'version',
                     server_default='1',
                     nullable=False)

    # 5. Add foreign key on job_id -> jobs.id
    op.create_foreign_key('fk_job_profiles_job_id', 'job_profiles', 'jobs',
                          ['job_id'], ['id'], ondelete='SET NULL')

    # 6. Add unique constraint (role_id, version)
    op.create_unique_constraint('uq_job_profiles_role_version', 'job_profiles',
                                ['role_id', 'version'])


def downgrade() -> None:
    op.drop_constraint('uq_job_profiles_role_version', 'job_profiles', type_='unique')
    op.drop_constraint('fk_job_profiles_job_id', 'job_profiles', type_='foreignkey')
    op.execute("ALTER TABLE job_profiles ALTER COLUMN version TYPE varchar(32) USING version::text")
    op.alter_column('job_profiles', 'version',
                     server_default='1.0',
                     nullable=False)
    op.alter_column('job_profiles', 'role_id',
                     existing_type=postgresql.UUID(as_uuid=True),
                     nullable=True)
    op.alter_column('job_profiles', 'job_id',
                     existing_type=postgresql.UUID(as_uuid=True),
                     nullable=False)
    op.create_unique_constraint('job_profiles_job_id_key', 'job_profiles', ['job_id'])
