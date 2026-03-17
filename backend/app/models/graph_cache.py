"""Graph cache model for job graph data."""
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Integer, func

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
