"""Initial migration - create all tables

Revision ID: 001_initial
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension (requires superuser or CREATE permission)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Create jobs table (原始 JD 数据)
    op.create_table(
        'jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('job_code', sa.String(64), unique=True, nullable=False),
        sa.Column('title', sa.String(128), nullable=False),
        sa.Column('role', sa.String(64), nullable=False),
        sa.Column('sub_role', sa.String(64)),
        sa.Column('city', sa.String(32), nullable=False),
        sa.Column('district', sa.String(32)),
        sa.Column('salary_min', sa.Integer),
        sa.Column('salary_max', sa.Integer),
        sa.Column('salary_months', sa.SmallInteger, server_default='12'),
        sa.Column('company_name', sa.String(256), nullable=False),
        sa.Column('industries', postgresql.ARRAY(sa.String), default=[]),
        sa.Column('company_size', sa.String(32)),
        sa.Column('company_stage', sa.String(32)),
        sa.Column('description', sa.Text),
        sa.Column('skills', postgresql.ARRAY(sa.String), default=[]),
        sa.Column('education_req', sa.String(32)),
        sa.Column('experience_req', sa.String(32)),
        sa.Column('company_intro', sa.Text),
        sa.Column('published_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()')),
    )
    op.create_index('ix_jobs_job_code', 'jobs', ['job_code'])
    op.create_index('ix_jobs_role', 'jobs', ['role'])
    op.create_index('ix_jobs_city', 'jobs', ['city'])

    # Create roles table (归一化岗位角色)
    op.create_table(
        'roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(64), unique=True, nullable=False),
        sa.Column('category', sa.String(64), nullable=False),
        sa.Column('level', sa.String(32)),
        sa.Column('description', sa.Text),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()')),
    )
    op.create_index('ix_roles_name', 'roles', ['name'])
    op.create_index('ix_roles_category', 'roles', ['category'])

    # Create job_profiles table (岗位画像)
    op.create_table(
        'job_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('job_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('role_id', postgresql.UUID(as_uuid=True)),
        sa.Column('profile_json', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('evidence_json', postgresql.JSON, default={}),
        sa.Column('version', sa.String(32), nullable=False, server_default='1.0'),
        sa.Column('embedding', postgresql.ARRAY(sa.Float)),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()')),
    )
    op.create_index('ix_job_profiles_job_id', 'job_profiles', ['job_id'])
    op.create_index('ix_job_profiles_role_id', 'job_profiles', ['role_id'])

    # Create students table (学生基本信息)
    op.create_table(
        'students',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(500), unique=True, nullable=False),
        sa.Column('name', sa.String(200)),
        sa.Column('phone', sa.String(50)),
        sa.Column('gender', sa.String(10)),
        sa.Column('birth_date', sa.DateTime),
        sa.Column('location', sa.String(200)),
        sa.Column('hometown', sa.String(200)),
        sa.Column('job_intention', sa.String(200)),
        sa.Column('expected_salary_min', sa.Integer),
        sa.Column('expected_salary_max', sa.Integer),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()')),
    )
    op.create_index('ix_students_email', 'students', ['email'])

    # Create resumes table (简历文件)
    op.create_table(
        'resumes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('filename', sa.String(500)),
        sa.Column('file_path', sa.String(1000)),
        sa.Column('file_type', sa.String(20)),
        sa.Column('raw_text', sa.Text),
        sa.Column('parsed_json', postgresql.JSON),
        sa.Column('is_primary', sa.String(10), server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()')),
    )
    op.create_index('ix_resumes_student_id', 'resumes', ['student_id'])

    # Create student_profiles table (学生画像)
    op.create_table(
        'student_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('profile_json', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('completeness_score', sa.Float, server_default='0.0'),
        sa.Column('evidence_json', postgresql.JSON, default={}),
        sa.Column('version', sa.String(32), nullable=False, server_default='1.0'),
        sa.Column('embedding', postgresql.ARRAY(sa.Float)),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()')),
    )
    op.create_index('ix_student_profiles_student_id', 'student_profiles', ['student_id'])

    # Create match_results table (匹配结果)
    op.create_table(
        'match_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_profile_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('job_profile_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('total_score', sa.Float, nullable=False),
        sa.Column('scores_json', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('gaps_json', postgresql.JSON, default={}),
        sa.Column('version', sa.String(32), nullable=False, server_default='1.0'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()')),
    )
    op.create_index('ix_match_results_student_profile_id', 'match_results', ['student_profile_id'])
    op.create_index('ix_match_results_job_profile_id', 'match_results', ['job_profile_id'])
    op.create_index('ix_match_results_total_score', 'match_results', ['total_score'])
    op.create_index('ix_match_unique', 'match_results', ['student_profile_id', 'job_profile_id'], unique=True)

    # Create match_scores table (deprecated, kept for compatibility)
    op.create_table(
        'match_scores',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('match_result_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('score_type', sa.String(100), nullable=False),
        sa.Column('score', sa.Float, nullable=False),
        sa.Column('details', postgresql.JSON),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
    )
    op.create_index('ix_match_scores_match_result_id', 'match_scores', ['match_result_id'])

    # Create career_reports table (职业报告)
    op.create_table(
        'career_reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content_json', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('status', sa.String(32), nullable=False, server_default='pending'),
        sa.Column('version', sa.String(32), nullable=False, server_default='1.0'),
        sa.Column('pdf_path', sa.String(1000)),
        sa.Column('docx_path', sa.String(1000)),
        sa.Column('summary', sa.Text),
        sa.Column('recommendations', postgresql.JSON),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()')),
    )
    op.create_index('ix_career_reports_student_id', 'career_reports', ['student_id'])

    # Create report_versions table (报告版本历史)
    op.create_table(
        'report_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('report_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version', sa.String(50), nullable=False),
        sa.Column('content', postgresql.JSON),
        sa.Column('change_notes', sa.Text),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
    )
    op.create_index('ix_report_versions_report_id', 'report_versions', ['report_id'])

    # Create graph_nodes table (图谱节点)
    op.create_table(
        'graph_nodes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('role_id', postgresql.UUID(as_uuid=True)),
        sa.Column('level', sa.String(32), nullable=False),
        sa.Column('node_type', sa.String(50), nullable=False),
        sa.Column('name', sa.String(500), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('metadata_json', postgresql.JSON, default={}),
        sa.Column('embedding', postgresql.ARRAY(sa.Float)),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()')),
    )
    op.create_index('ix_graph_nodes_role_id', 'graph_nodes', ['role_id'])
    op.create_index('ix_graph_nodes_level', 'graph_nodes', ['level'])
    op.create_index('ix_graph_nodes_node_type', 'graph_nodes', ['node_type'])
    op.create_index('ix_graph_node_role_level', 'graph_nodes', ['role_id', 'level'])

    # Create graph_edges table (图谱边)
    op.create_table(
        'graph_edges',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('source_node_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('target_node_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('edge_type', sa.String(32), nullable=False),
        sa.Column('weight', sa.Float, server_default='1.0'),
        sa.Column('explanation_json', postgresql.JSON, default={}),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
    )
    op.create_index('ix_graph_edges_source_node_id', 'graph_edges', ['source_node_id'])
    op.create_index('ix_graph_edges_target_node_id', 'graph_edges', ['target_node_id'])
    op.create_index('ix_graph_edges_edge_type', 'graph_edges', ['edge_type'])
    op.create_index('ix_graph_edge_source_target', 'graph_edges', ['source_node_id', 'target_node_id'])

    # Create skill_dictionary table (技能词典)
    op.create_table(
        'skill_dictionary',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('canonical_name', sa.String(128), nullable=False),
        sa.Column('category', sa.String(64), nullable=False),
        sa.Column('domain', sa.String(64), nullable=False),
        sa.Column('aliases_json', postgresql.JSON, default=[]),
        sa.Column('level_definitions', postgresql.JSON, default={}),
        sa.Column('related_skill_ids', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), default=[]),
        sa.Column('embedding', postgresql.ARRAY(sa.Float)),
        sa.Column('usage_count', sa.Integer, server_default='0'),
        sa.Column('resume_usage_count', sa.Integer, server_default='0'),
        sa.Column('version', sa.String(32), nullable=False, server_default='1.0'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()')),
    )
    op.create_index('ix_skill_dictionary_canonical_name', 'skill_dictionary', ['canonical_name'])
    op.create_index('ix_skill_dictionary_category', 'skill_dictionary', ['category'])
    op.create_index('ix_skill_dictionary_domain', 'skill_dictionary', ['domain'])
    op.create_index('ix_skill_dict_domain_category', 'skill_dictionary', ['domain', 'category'])
    op.execute("CREATE UNIQUE INDEX uq_skill_name_category ON skill_dictionary (canonical_name, category)")

    # Create vector indexes for pgvector (commented out as they require specific embedding dimensions)
    # Uncomment and adjust dimension (e.g., 1536 for OpenAI ada-002) based on your embedding model
    # op.execute("CREATE INDEX ix_job_profiles_embedding ON job_profiles USING ivfflat (embedding vector_cosine_ops)")
    # op.execute("CREATE INDEX ix_student_profiles_embedding ON student_profiles USING ivfflat (embedding vector_cosine_ops)")
    # op.execute("CREATE INDEX ix_graph_nodes_embedding ON graph_nodes USING ivfflat (embedding vector_cosine_ops)")
    # op.execute("CREATE INDEX ix_skill_dictionary_embedding ON skill_dictionary USING ivfflat (embedding vector_cosine_ops)")


def downgrade() -> None:
    op.drop_table('skill_dictionary')
    op.drop_table('graph_edges')
    op.drop_table('graph_nodes')
    op.drop_table('report_versions')
    op.drop_table('career_reports')
    op.drop_table('match_scores')
    op.drop_table('match_results')
    op.drop_table('student_profiles')
    op.drop_table('resumes')
    op.drop_table('students')
    op.drop_table('job_profiles')
    op.drop_table('roles')
    op.drop_table('jobs')
