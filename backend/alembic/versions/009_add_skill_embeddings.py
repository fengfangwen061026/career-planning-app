"""add skill_embeddings table

Revision ID: 009_add_skill_embeddings
Revises: 008_add_job_transitions
Create Date: 2026-03-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY


# revision identifiers, used by Alembic.
revision: str = '009_add_skill_embeddings'
down_revision: Union[str, None] = '008_add_job_transitions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'skill_embeddings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('skill_name_normalized', sa.String(length=255), nullable=False),
        sa.Column('skill_name_original', sa.String(length=255), nullable=False),
        sa.Column('embedding', ARRAY(sa.Float()), nullable=False),
        sa.Column('model_name', sa.String(length=100), nullable=False, server_default='text-embedding-v4'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('skill_name_normalized', name='uq_skill_embeddings_normalized_name'),
    )
    op.create_index(
        op.f('ix_skill_embeddings_skill_name_normalized'),
        'skill_embeddings',
        ['skill_name_normalized'],
        unique=True
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_skill_embeddings_skill_name_normalized'),
        table_name='skill_embeddings'
    )
    op.drop_table('skill_embeddings')
