"""Graph API routes - 岗位图谱相关接口."""
from collections import Counter
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.models.graph import GraphNode, GraphEdge
from app.models.job import Job
from app.services import graph as graph_service
from app.services.graph_mindmap import get_graph_cache, build_and_cache_graph

router = APIRouter()


class GraphNodeCreate(BaseModel):
    """Schema for creating a graph node."""
    node_type: str
    name: str
    description: str | None = None
    level: str | None = None
    metadata: dict[str, Any] | None = None


class GraphNodeResponse(BaseModel):
    """Schema for graph node response."""
    id: str
    node_type: str
    name: str
    level: str | None = None
    description: str | None = None
    metadata: dict[str, Any] | None = None


class GraphEdgeResponse(BaseModel):
    """Schema for graph edge response."""
    id: str
    source: str
    target: str
    edge_type: str
    weight: float
    explanation: dict[str, Any] | None = None


class CytoscapeElementsResponse(BaseModel):
    """Cytoscape.js 兼容的图谱数据格式."""
    elements: list[dict[str, Any]]


class PathRequest(BaseModel):
    """路径查询请求."""
    source_id: UUID
    target_id: UUID


class CareerPathRequest(BaseModel):
    """职业路径查询请求."""
    from_role: str
    to_role: str
    from_level: str = "entry"


class StudentPathRequest(BaseModel):
    """基于学生画像的路径查询请求."""
    student_profile: dict[str, Any]
    target_role: str
    target_level: str = "expert"


class BuildGraphResponse(BaseModel):
    """图谱构建结果."""
    vertical: dict[str, Any]
    transition: dict[str, Any]


@router.post("/build", response_model=BuildGraphResponse, status_code=status.HTTP_201_CREATED)
async def build_graph(db: AsyncSession = Depends(get_db)) -> BuildGraphResponse:
    """构建/更新岗位知识图谱。

    执行以下操作：
    1. 垂直晋升路径构建
    2. 横向换岗路径构建
    """
    result = await graph_service.build_job_graph(db)
    return BuildGraphResponse(**result)


@router.get("/nodes", response_model=list[GraphNodeResponse])
async def list_nodes(
    node_type: str | None = Query(None, description="节点类型过滤"),
    level: str | None = Query(None, description="职级过滤"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> list[GraphNodeResponse]:
    """获取图谱节点列表。

    支持按 node_type 和 level 过滤。
    """
    nodes = await graph_service.get_graph_nodes(
        db, node_type=node_type, level=level, skip=skip, limit=limit
    )
    return [GraphNodeResponse(**n) for n in nodes]


@router.get("/nodes/{node_id}", response_model=GraphNodeResponse)
async def get_node(
    node_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> GraphNodeResponse:
    """获取指定节点详情。"""
    node = await db.get(GraphNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    return GraphNodeResponse(
        id=str(node.id),
        node_type=node.node_type,
        name=node.name,
        level=node.level,
        description=node.description,
        metadata=node.metadata_json,
    )


@router.get("/edges", response_model=list[GraphEdgeResponse])
async def list_edges(
    edge_type: str | None = Query(None, description="边类型过滤: vertical/transition"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> list[GraphEdgeResponse]:
    """获取图谱边列表。

    支持按 edge_type 过滤（vertical: 垂直晋升, transition: 横向转岗）。
    """
    edges = await graph_service.get_graph_edges(
        db, edge_type=edge_type, skip=skip, limit=limit
    )
    return [GraphEdgeResponse(**e) for e in edges]


@router.post("/path", response_model=list[dict[str, Any]])
async def get_path(
    request: PathRequest,
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """获取两个节点之间的最短路径。

    使用 Dijkstra 算法搜索最优路径。
    """
    path = await graph_service.get_path(
        db, request.source_id, request.target_id
    )
    if not path:
        raise HTTPException(status_code=404, detail="No path found between nodes")

    return path


@router.get("/path", response_model=list[dict[str, Any]])
async def get_path_by_params(
    source_id: UUID = Query(..., description="起始节点ID"),
    target_id: UUID = Query(..., description="目标节点ID"),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """获取两个节点之间的最短路径（GET 版本）。"""
    path = await graph_service.get_path(db, source_id, target_id)
    if not path:
        raise HTTPException(status_code=404, detail="No path found between nodes")

    return path


@router.post("/career-path", response_model=list[dict[str, Any]])
async def get_career_path(
    request: CareerPathRequest,
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """查询两个 Role 之间的职业发展路径。

    返回多条可能的路径，按步骤数排序。
    """
    paths = await graph_service.find_career_paths(
        db,
        from_role=request.from_role,
        to_role=request.to_role,
        from_level=request.from_level,
    )

    if not paths:
        raise HTTPException(
            status_code=404,
            detail=f"No career path found from '{request.from_role}' to '{request.to_role}'"
        )

    return paths


@router.post("/student-path", response_model=dict[str, Any])
async def get_student_path(
    request: StudentPathRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """根据学生画像和目标岗位返回推荐发展路径。

    包含：
    - 主路径（垂直发展）
    - 备选路径（横向转岗 + 垂直发展）
    - 具体行动计划
    """
    result = await graph_service.find_path_with_student_profile(
        db,
        student_profile=request.student_profile,
        target_role=request.target_role,
        target_level=request.target_level,
    )

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@router.get("/cytoscape", response_model=CytoscapeElementsResponse)
async def get_cytoscape(
    edge_type: str | None = Query(None, description="边类型过滤"),
    db: AsyncSession = Depends(get_db),
) -> CytoscapeElementsResponse:
    """获取 Cytoscape.js 兼容的图谱数据格式。

    用于前端可视化。
    """
    elements = await graph_service.get_cytoscape_elements(db, edge_type=edge_type)
    return CytoscapeElementsResponse(**elements)


@router.get("/nodes/{node_id}/related")
async def get_related_nodes(
    node_id: UUID,
    edge_type: str | None = Query(None, description="边类型过滤"),
    db: AsyncSession = Depends(get_db),
) -> list[GraphNodeResponse]:
    """获取与指定节点相关的节点。"""
    node = await db.get(GraphNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # 获取相关的边
    query = select(GraphEdge).where(
        (GraphEdge.source_node_id == node_id) | (GraphEdge.target_node_id == node_id)
    )

    if edge_type:
        query = query.where(GraphEdge.edge_type == edge_type)

    result = await db.execute(query)
    edges = result.scalars().all()

    # 收集相关节点ID
    related_ids: set[UUID] = set()
    for edge in edges:
        if edge.source_node_id == node_id:
            related_ids.add(edge.target_node_id)
        else:
            related_ids.add(edge.source_node_id)

    # 获取相关节点
    nodes_result = await db.execute(
        select(GraphNode).where(GraphNode.id.in_(related_ids))
    )
    related_nodes = nodes_result.scalars().all()

    return [
        GraphNodeResponse(
            id=str(n.id),
            node_type=n.node_type,
            name=n.name,
            level=n.level,
            description=n.description,
            metadata=n.metadata_json,
        )
        for n in related_nodes
    ]


@router.get("/skills/{skill}/related", response_model=list[dict[str, Any]])
async def get_related_skills(
    skill: str,
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """查找与指定技能相关的技能。

    基于岗位画像中共现关系计算。
    """
    return await graph_service.find_related_skills(skill, db)


@router.get("/jobs/{job_id}/requirements", response_model=dict[str, Any])
async def get_job_requirements(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """获取岗位的完整要求图谱。

    包含技能、经验、学历要求等。
    """
    return await graph_service.get_job_requirements(job_id, db)


# ── 思维导图接口（新增）──────────────────────────────────────────────


@router.get("/mindmap")
async def get_mindmap(db: AsyncSession = Depends(get_db)):
    """获取思维导图数据（带缓存）。首次请求或缓存不存在时自动构建。"""
    cached = await get_graph_cache(db)
    if cached:
        return cached
    return await build_and_cache_graph(db)


@router.post("/mindmap/rebuild")
async def rebuild_mindmap(db: AsyncSession = Depends(get_db)):
    """强制重建思维导图缓存。数据导入完成后可自动调用此函数，或由前端手动触发。"""
    result = await build_and_cache_graph(db)
    return {
        "status": "ok",
        "rebuilt_at": result["generated_at"],
        "node_count": len(result["nodes"]),
    }


@router.get("/job-stats")
async def get_job_stats(
    role: str = Query(..., description="Role name"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Job.salary_min, Job.salary_max, Job.city, Job.skills).where(Job.role == role)
    )
    rows = result.all()

    if not rows:
        return {
            "jd_count": 0,
            "salary_min": None,
            "salary_max": None,
            "top_cities": [],
            "top_skills": [],
        }

    city_counter: Counter[str] = Counter()
    skill_counter: Counter[str] = Counter()
    salary_mins: list[int] = []
    salary_maxs: list[int] = []

    for row in rows:
        if row.city:
            city_counter[row.city] += 1
        if row.salary_min is not None:
            salary_mins.append(row.salary_min)
        if row.salary_max is not None:
            salary_maxs.append(row.salary_max)
        for skill in row.skills or []:
            if skill:
                skill_counter[skill] += 1

    return {
        "jd_count": len(rows),
        "salary_min": min(salary_mins) if salary_mins else None,
        "salary_max": max(salary_maxs) if salary_maxs else None,
        "top_cities": [city for city, _ in city_counter.most_common(3)],
        "top_skills": [skill for skill, _ in skill_counter.most_common(5)],
    }
