"""Graph cache model for job graph data."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import JSON, Column, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import ARRAY

from app.database import Base


class GraphCache(Base):
    """Graph cache table - stores precomputed job graph data.

    This is a single-row table (id=1) that caches the job graph structure
    to avoid rebuilding on every request.
    """
    __tablename__ = "graph_cache"

    id = Column(Integer, primary_key=True, default=1)
    data = Column(JSON, nullable=False)
    generated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class CareerPathCache(Base):
    """Career path query cache - caches Dijkstra path search results.

    Stores computed career paths between roles to avoid repeated expensive
    graph searches. Cache is invalidated when the graph is rebuilt.
    """
    __tablename__ = "career_path_cache"

    # Composite primary key via cache_key
    cache_key = Column(String(256), primary_key=True)
    query_type = Column(String(32), nullable=False)  # 'dijkstra', 'student_path', 'career_paths'
    from_role = Column(String(128), nullable=True)  # source role name
    to_role = Column(String(128), nullable=True)  # target role name
    student_id = Column(String(64), nullable=True)  # for student_path queries
    result_json = Column(JSON, nullable=False)
    graph_version = Column(String(64), nullable=False)  # graph build version
    expires_at = Column(DateTime, nullable=True)  # TTL-based expiry
    created_at = Column(DateTime, server_default=func.now())
