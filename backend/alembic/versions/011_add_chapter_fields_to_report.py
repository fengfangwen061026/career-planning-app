"""Add chapter fields to career_reports.

Revision ID: 011
Revises: 010
Create Date: 2026-03-26
"""
from alembic import op
import sqlalchemy as sa

revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('career_reports', sa.Column('chapter_1_text', sa.Text(), nullable=True))
    op.add_column('career_reports', sa.Column('chapter_2_text', sa.Text(), nullable=True))
    op.add_column('career_reports', sa.Column('chapter_2_data', sa.Text(), nullable=True))
    op.add_column('career_reports', sa.Column('chapter_3_text', sa.Text(), nullable=True))
    op.add_column('career_reports', sa.Column('chapter_3_data', sa.Text(), nullable=True))
    op.add_column('career_reports', sa.Column('chapter_4_text', sa.Text(), nullable=True))
    op.add_column('career_reports', sa.Column('chapter_4_data', sa.Text(), nullable=True))
    op.add_column('career_reports', sa.Column('chapter_5_text', sa.Text(), nullable=True))
    op.add_column('career_reports', sa.Column('chapters_done',  sa.Integer(), nullable=False, server_default='0'))

    # status 枚举扩展：原来有 'completed'，新增 'done'（兼容旧数据，两者均表示完成）
    # 只更新 nullable 约束，不改类型
    op.alter_column('career_reports', 'content_json',
                    existing_type=sa.JSON(),
                    nullable=True)


def downgrade() -> None:
    op.drop_column('career_reports', 'chapters_done')
    op.drop_column('career_reports', 'chapter_5_text')
    op.drop_column('career_reports', 'chapter_4_data')
    op.drop_column('career_reports', 'chapter_4_text')
    op.drop_column('career_reports', 'chapter_3_data')
    op.drop_column('career_reports', 'chapter_3_text')
    op.drop_column('career_reports', 'chapter_2_data')
    op.drop_column('career_reports', 'chapter_2_text')
    op.drop_column('career_reports', 'chapter_1_text')

    op.alter_column('career_reports', 'content_json',
                    existing_type=sa.JSON(),
                    nullable=False)
