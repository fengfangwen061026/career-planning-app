"""add job_transitions table

Revision ID: 008_add_job_transitions
Revises: 007_expand_job_code_length
Create Date: 2026-03-23 23:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '008_add_job_transitions'
down_revision: Union[str, None] = '007_expand_job_code_length'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('job_transitions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('source_job_profile_id', sa.UUID(), nullable=False),
    sa.Column('target_job_profile_id', sa.UUID(), nullable=False),
    sa.Column('source_role_name', sa.String(length=100), nullable=False),
    sa.Column('target_role_name', sa.String(length=100), nullable=False),
    sa.Column('skill_overlap_ratio', sa.Float(), nullable=False),
    sa.Column('transition_difficulty', sa.Float(), nullable=False),
    sa.Column('shared_skills', sa.JSON(), nullable=True),
    sa.Column('gap_skills', sa.JSON(), nullable=True),
    sa.Column('transferable_skills', sa.JSON(), nullable=True),
    sa.Column('transition_advice', sa.String(length=500), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['source_job_profile_id'], ['job_profiles.id'], ),
    sa.ForeignKeyConstraint(['target_job_profile_id'], ['job_profiles.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_job_transitions_id'), 'job_transitions', ['id'], unique=False)
    op.create_index(op.f('ix_job_transitions_source_job_profile_id'), 'job_transitions', ['source_job_profile_id'], unique=False)
    op.create_index(op.f('ix_job_transitions_target_job_profile_id'), 'job_transitions', ['target_job_profile_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_job_transitions_target_job_profile_id'), table_name='job_transitions')
    op.drop_index(op.f('ix_job_transitions_source_job_profile_id'), table_name='job_transitions')
    op.drop_index(op.f('ix_job_transitions_id'), table_name='job_transitions')
    op.drop_table('job_transitions')
