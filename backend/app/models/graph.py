"""Graph related models for job/role knowledge graph."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, ForeignKey, Column, DateTime, Float, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class GraphNode(Base):
    """Graph node - 岗位角色图谱节点（关联 Role 和 Level）."""
    __tablename__ = "graph_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # 关联 Role（可选，用于 Role 相关的节点）
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), index=True)

    # 节点级别：entry/growing/mature/expert
    level = Column(String(32), nullable=False, index=True)

    # 节点类型：role, skill, company, concept
    node_type = Column(String(50), nullable=False, index=True)

    # 节点名称
    name = Column(String(500), nullable=False)

    # 描述
    description = Column(Text)

    # 元数据（JSONB 存储额外属性）
    metadata_json = Column(JSON, default={})

    # 向量嵌入（用于语义搜索）
    embedding = Column(ARRAY(Float))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    role = relationship("Role", back_populates="graph_nodes")
    source_edges = relationship("GraphEdge", foreign_keys="GraphEdge.source_node_id", back_populates="source_node")
    target_edges = relationship("GraphEdge", foreign_keys="GraphEdge.target_node_id", back_populates="target_node")

    # 表级索引
    __table_args__ = (
        Index('ix_graph_node_role_level', 'role_id', 'level'),
    )


class GraphEdge(Base):
    """Graph edge - 岗位角色图谱边（表示职业发展路径）."""
    __tablename__ = "graph_edges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # 关联节点
    source_node_id = Column(UUID(as_uuid=True), ForeignKey("graph_nodes.id"), nullable=False, index=True)
    target_node_id = Column(UUID(as_uuid=True), ForeignKey("graph_nodes.id"), nullable=False, index=True)

    # 边类型：vertical（纵向发展/晋升）, transition（横向转岗）
    edge_type = Column(String(32), nullable=False, index=True)

    # 权重（关系强度）
    weight = Column(Float, default=1.0)

    # 说明（JSONB 存储）
    explanation_json = Column(JSON, default={})

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    source_node = relationship("GraphNode", foreign_keys=[source_node_id], back_populates="source_edges")
    target_node = relationship("GraphNode", foreign_keys=[target_node_id], back_populates="target_edges")

    # 表级约束和索引
    __table_args__ = (
        Index('ix_graph_edge_source_target', 'source_node_id', 'target_node_id'),
    )
