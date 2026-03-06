"""Graph service - manages job/role knowledge graph.

Features:
1. 垂直晋升路径构建 - 基于 Role 职级信息
2. 横向换岗路径构建 - 基于技能重叠度
3. 路径规划 - Dijkstra/BFS 搜索最优路径
4. 图谱数据接口 - 兼容 Cytoscape.js 格式
"""
import heapq
import logging
import re
from collections import defaultdict
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.graph import GraphEdge, GraphNode
from app.models.job import Job, JobProfile, Role

logger = logging.getLogger(__name__)

# 职级顺序定义
LEVEL_ORDER = ["entry", "growing", "mature", "expert"]

# 职级中文映射
LEVEL_CN_MAP = {
    "entry": "初级",
    "growing": "中级",
    "mature": "高级",
    "expert": "负责人",
}

# 技能重叠度阈值
TRANSITION_THRESHOLD = 0.3

# 从 JD 年限推断职级的映射
EXPERIENCE_TO_LEVEL = {
    (0, 1): "entry",
    (1, 3): "entry",
    (3, 5): "growing",
    (5, 8): "mature",
    (8, 100): "expert",
}


def _parse_experience_years(exp_str: str | None) -> tuple[int, int]:
    """解析工作经验字符串，返回 (min_years, max_years)。"""
    if not exp_str:
        return (0, 100)

    # 处理 "3-5年" 格式
    match = re.search(r"(\d+)\s*[-~至]\s*(\d+)\s*年", exp_str)
    if match:
        return (int(match.group(1)), int(match.group(2)))

    # 处理 "3年以上" 格式
    match = re.search(r"(\d+)\s*\+\s*年", exp_str)
    if match:
        return (int(match.group(1)), 100)

    # 处理 "1-3年" 格式
    match = re.search(r"(\d+)\s*年", exp_str)
    if match:
        years = int(match.group(1))
        return (years, years + 2)

    return (0, 100)


def _infer_level_from_exp(exp_str: str | None) -> str:
    """从工作经验要求推断职级。"""
    min_yr, max_yr = _parse_experience_years(exp_str)

    for (low, high), level in EXPERIENCE_TO_LEVEL.items():
        if low <= max_yr < high:
            return level

    return "entry"


def _get_skills_from_profile(profile_json: dict[str, Any]) -> list[str]:
    """从 JobProfile 的 profile_json 中提取技能列表。"""
    skills: list[str] = []

    dims = profile_json.get("dimensions", {})
    prof_skills = dims.get("professional_skills", [])

    for skill in prof_skills:
        skill_name = skill.get("skill_name", "")
        if skill_name:
            skills.append(skill_name.lower())

    return skills


def _calculate_skill_overlap(
    skills1: list[str],
    skills2: list[str],
) -> tuple[float, list[str], list[str]]:
    """计算两个技能列表的重叠度。

    Returns:
        (overlap_ratio, transferable_skills, gap_skills)
    """
    set1 = set(skills1)
    set2 = set(skills2)

    if not set1 or not set2:
        return (0.0, [], list(set2 - set1))

    intersection = set1 & set2
    union = set1 | set2

    overlap_ratio = len(intersection) / len(union) if union else 0.0

    # 可迁移技能 = 交集
    transferable = list(intersection)

    # 差距技能 = target 有但 source 没有的
    gap = list(set2 - set1)

    return (overlap_ratio, transferable, gap)


# ---------------------------------------------------------------------------
# 1. 垂直晋升路径构建
# ---------------------------------------------------------------------------


async def build_vertical_paths(db: AsyncSession) -> dict[str, Any]:
    """构建垂直晋升路径（同一 Role 的不同职级之间）。"""
    # 获取所有 Role
    result = await db.execute(
        select(Role).options(selectinload(Role.jobs))
    )
    roles = list(result.scalars().all())

    nodes_created = 0
    edges_created = 0

    for role in roles:
        # 为该 Role 创建不同职级的节点
        role_levels = set()

        # 1. 首先检查 Role 本身的 level 字段
        if role.level:
            role_levels.add(role.level)

        # 2. 从关联的 Job 推断职级
        for job in role.jobs:
            inferred = _infer_level_from_exp(job.experience_req)
            role_levels.add(inferred)

        # 确保至少有一个职级
        if not role_levels:
            role_levels.add("entry")

        # 按顺序排序职级
        sorted_levels = sorted(role_levels, key=lambda x: LEVEL_ORDER.index(x) if x in LEVEL_ORDER else 0)

        # 创建节点
        level_nodes: dict[str, GraphNode] = {}
        for level in sorted_levels:
            node_name = f"{role.name}-{LEVEL_CN_MAP.get(level, level)}"

            # 检查节点是否已存在
            existing = await db.execute(
                select(GraphNode).where(
                    GraphNode.role_id == role.id,
                    GraphNode.level == level,
                )
            )
            node = existing.scalar_one_or_none()

            if not node:
                node = GraphNode(
                    role_id=role.id,
                    node_type="role",
                    name=node_name,
                    level=level,
                    description=role.description or f"{role.name} {LEVEL_CN_MAP.get(level, level)}级别",
                    metadata_json={
                        "role_name": role.name,
                        "category": role.category,
                    },
                )
                db.add(node)
                await db.flush()
                nodes_created += 1

            level_nodes[level] = node

        # 创建垂直边（相邻职级之间）
        for i in range(len(sorted_levels) - 1):
            source_level = sorted_levels[i]
            target_level = sorted_levels[i + 1]

            source_node = level_nodes[source_level]
            target_node = level_nodes[target_level]

            # 检查边是否已存在
            existing_edge = await db.execute(
                select(GraphEdge).where(
                    GraphEdge.source_node_id == source_node.id,
                    GraphEdge.target_node_id == target_node.id,
                    GraphEdge.edge_type == "vertical",
                )
            )
            if not existing_edge.scalar_one_or_none():
                # 计算晋升难度（职级差距越大，难度越高）
                difficulty = (i + 1) * 0.3 + 0.5

                edge = GraphEdge(
                    source_node_id=source_node.id,
                    target_node_id=target_node.id,
                    edge_type="vertical",
                    weight=1.0 / difficulty,  # 难度越高，权重越低
                    explanation_json={
                        "type": "vertical_promotion",
                        "from_level": source_level,
                        "to_level": target_level,
                        "difficulty": difficulty,
                        "description": f"从{LEVEL_CN_MAP.get(source_level, source_level)}到{LEVEL_CN_MAP.get(target_level, target_level)}的晋升路径",
                        "action_items": [
                            "提升专业技术深度",
                            "积累项目经验",
                            "培养团队协作能力",
                        ],
                    },
                )
                db.add(edge)
                edges_created += 1

    await db.commit()

    return {
        "nodes_created": nodes_created,
        "edges_created": edges_created,
    }


# ---------------------------------------------------------------------------
# 2. 横向换岗路径构建
# ---------------------------------------------------------------------------


async def build_transition_paths(db: AsyncSession) -> dict[str, Any]:
    """构建横向换岗路径（不同 Role 之间基于技能重叠度）。"""
    # 获取所有有 profile 的 Role
    result = await db.execute(
        select(JobProfile)
        .options(selectinload(JobProfile.role))
        .where(JobProfile.profile_json.isnot(None))
    )
    profiles = list(result.scalars().all())

    # 按 role_id 分组，取最新版本
    latest_profiles: dict[UUID, JobProfile] = {}
    for p in profiles:
        if p.role_id not in latest_profiles or p.version > latest_profiles[p.role_id].version:
            latest_profiles[p.role_id] = p

    # 获取所有角色节点
    role_nodes_result = await db.execute(
        select(GraphNode).where(
            GraphNode.node_type == "role",
            GraphNode.level == "entry",
        )
    )
    role_nodes = {n.role_id: n for n in role_nodes_result.scalars().all()}

    edges_created = 0

    # 计算所有 Role 对之间的技能重叠度
    role_list = list(latest_profiles.keys())

    for i, role_id1 in enumerate(role_list):
        for role_id2 in role_list[i + 1:]:
            profile1 = latest_profiles[role_id1]
            profile2 = latest_profiles[role_id2]

            skills1 = _get_skills_from_profile(profile1.profile_json)
            skills2 = _get_skills_from_profile(profile2.profile_json)

            overlap_ratio, transferable, gap = _calculate_skill_overlap(skills1, skills2)

            if overlap_ratio >= TRANSITION_THRESHOLD:
                node1 = role_nodes.get(role_id1)
                node2 = role_nodes.get(role_id2)

                if not node1 or not node2:
                    continue

                # 检查边是否已存在
                existing = await db.execute(
                    select(GraphEdge).where(
                        GraphEdge.source_node_id == node1.id,
                        GraphEdge.target_node_id == node2.id,
                        GraphEdge.edge_type == "transition",
                    )
                )
                if existing.scalar_one_or_none():
                    continue

                # 计算转岗可行性分数
                feasibility = overlap_ratio * (1 - len(gap) * 0.1)
                feasibility = max(0.1, min(1.0, feasibility))

                edge = GraphEdge(
                    source_node_id=node1.id,
                    target_node_id=node2.id,
                    edge_type="transition",
                    weight=feasibility,
                    explanation_json={
                        "type": "lateral_transfer",
                        "overlap_ratio": round(overlap_ratio, 2),
                        "transferable_skills": transferable,
                        "gap_skills": gap,
                        "description": f"从{profile1.role.name}转岗到{profile2.role.name}的路径",
                        "action_items": [
                            f"学习新技能: {', '.join(gap[:5])}" if gap else "巩固现有技能",
                            "积累相关项目经验",
                            "获取相关证书",
                        ],
                    },
                )
                db.add(edge)
                edges_created += 1

    await db.commit()

    return {
        "edges_created": edges_created,
    }


async def build_job_graph(db: AsyncSession) -> dict[str, Any]:
    """构建或更新岗位知识图谱。

    依次执行：
    1. 垂直晋升路径构建
    2. 横向换岗路径构建
    """
    logger.info("Starting job graph construction...")

    vertical_result = await build_vertical_paths(db)
    logger.info(f"Vertical paths built: {vertical_result}")

    transition_result = await build_transition_paths(db)
    logger.info(f"Transition paths built: {transition_result}")

    return {
        "vertical": vertical_result,
        "transition": transition_result,
    }


# ---------------------------------------------------------------------------
# 3. 路径规划（Dijkstra/BFS）
# ---------------------------------------------------------------------------


class PathNode:
    """路径搜索节点。"""

    def __init__(self, node_id: UUID, cost: float = 0.0, path: list[UUID] | None = None):
        self.node_id = node_id
        self.cost = cost
        self.path = path or [node_id]

    def __lt__(self, other: "PathNode") -> bool:
        return self.cost < other.cost


async def find_path_dijkstra(
    db: AsyncSession,
    source_node_id: UUID,
    target_node_id: UUID,
) -> list[dict[str, Any]]:
    """使用 Dijkstra 算法找到最短路径。"""
    # 获取所有相关边
    result = await db.execute(
        select(GraphEdge).where(
            (GraphEdge.source_node_id == source_node_id) |
            (GraphEdge.target_node_id == source_node_id)
        )
    )
    all_edges = list(result.scalars().all())

    # 构建邻接表
    adjacency: dict[UUID, list[tuple[UUID, float, dict[str, Any]]]] = defaultdict(list)

    for edge in all_edges:
        if edge.source_node_id == source_node_id:
            adjacency[source_node_id].append((edge.target_node_id, edge.weight, edge.explanation_json or {}))
        # 对于反向路径，降低优先级
        if edge.target_node_id == source_node_id and edge.edge_type == "vertical":
            # 垂直路径只能向上，不能向下
            pass

    # 获取所有可达节点和边
    result = await db.execute(select(GraphEdge))
    all_graph_edges = list(result.scalars().all())

    adjacency.clear()
    for edge in all_graph_edges:
        # 获取边的权重和说明
        edge_info = {
            "edge_type": edge.edge_type,
            "weight": edge.weight,
            "explanation": edge.explanation_json or {},
        }
        adjacency[edge.source_node_id].append((edge.target_node_id, edge.weight, edge_info))

        # 垂直路径只能向上，不允许反向
        if edge.edge_type != "vertical":
            adjacency[edge.target_node_id].append((edge.source_node_id, edge.weight * 0.5, {
                **edge_info,
                "reverse": True,
            }))

    # Dijkstra 搜索
    dist: dict[UUID, float] = {source_node_id: 0}
    prev: dict[UUID, tuple[UUID, dict[str, Any]] | None] = {source_node_id: (source_node_id, None)}
    pq: list[PathNode] = [PathNode(source_node_id, 0.0)]
    visited: set[UUID] = set()

    while pq:
        current = heapq.heappop(pq)

        if current.node_id in visited:
            continue

        visited.add(current.node_id)

        if current.node_id == target_node_id:
            break

        for neighbor_id, weight, edge_info in adjacency.get(current.node_id, []):
            if neighbor_id in visited:
                continue

            # 如果是反向的垂直路径，跳过
            if edge_info.get("edge_type") == "vertical" and edge_info.get("reverse"):
                continue

            new_cost = current.cost + (1.0 - weight + 0.1)  # 权重越高，cost 越低

            if neighbor_id not in dist or new_cost < dist[neighbor_id]:
                dist[neighbor_id] = new_cost
                prev[neighbor_id] = (current.node_id, edge_info)
                heapq.heappush(pq, PathNode(neighbor_id, new_cost, current.path + [neighbor_id]))

    # 重建路径
    if target_node_id not in prev:
        return []

    path_ids: list[UUID] = []
    current = target_node_id
    edge_info_list: list[dict[str, Any]] = []

    while current != source_node_id:
        path_ids.append(current)
        prev_info = prev.get(current)
        if prev_info:
            edge_info_list.append(prev_info[1] or {} if prev_info[1] else {})
            current = prev_info[0]
        else:
            break

    path_ids.append(source_node_id)
    path_ids.reverse()
    edge_info_list.reverse()

    # 构建结果
    result_path: list[dict[str, Any]] = []

    for i, node_id in enumerate(path_ids):
        node = await db.get(GraphNode, node_id)
        if not node:
            continue

        step_info: dict[str, Any] = {
            "node_id": str(node.id),
            "name": node.name,
            "level": node.level,
            "node_type": node.node_type,
        }

        if i > 0 and i <= len(edge_info_list):
            step_info["edge"] = edge_info_list[i - 1]

        result_path.append(step_info)

    return result_path


async def find_career_paths(
    db: AsyncSession,
    from_role: str,
    to_role: str,
    from_level: str = "entry",
) -> list[dict[str, Any]]:
    """查找两个 Role 之间的职业发展路径。

    Args:
        db: 数据库会话
        from_role: 起始 Role 名称
        to_role: 目标 Role 名称
        from_level: 起始职级

    Returns:
        职业发展路径列表
    """
    # 查找起始节点
    from_node_result = await db.execute(
        select(GraphNode).where(
            GraphNode.name.like(f"{from_role}%"),
            GraphNode.level == from_level,
        )
    )
    from_node = from_node_result.scalar_one_or_none()

    # 查找目标节点（任意职级）
    to_node_result = await db.execute(
        select(GraphNode).where(
            GraphNode.name.like(f"{to_role}%"),
        )
    )
    to_nodes = list(to_node_result.scalars().all())

    if not from_node or not to_nodes:
        return []

    # 对每个目标节点找路径
    all_paths: list[dict[str, Any]] = []

    for to_node in to_nodes:
        path = await find_path_dijkstra(db, from_node.id, to_node.id)
        if path:
            all_paths.append({
                "from_role": from_role,
                "from_level": from_level,
                "to_role": to_role,
                "to_level": to_node.level,
                "path": path,
                "total_steps": len(path) - 1,
            })

    # 按路径长度排序
    all_paths.sort(key=lambda x: x["total_steps"])

    return all_paths


async def find_path_with_student_profile(
    db: AsyncSession,
    student_profile: dict[str, Any],
    target_role: str,
    target_level: str = "expert",
) -> dict[str, Any]:
    """根据学生画像和目标岗位找出推荐路径。

    Args:
        student_profile: 学生画像数据
        target_role: 目标 Role 名称
        target_level: 目标职级

    Returns:
        包含主路径和备选路径的推荐
    """
    # 从学生画像获取当前技能
    student_skills: list[str] = []
    dims = student_profile.get("dimensions", {})
    prof_skills = dims.get("professional_skills", [])
    for skill in prof_skills:
        name = skill.get("skill_name", "")
        if name:
            student_skills.append(name.lower())

    # 从学生画像获取当前 Role（如果有）
    current_role = student_profile.get("basic_info", {}).get("target_role", "")
    current_level = student_profile.get("basic_info", {}).get("level", "entry")

    # 查找起始节点
    if current_role:
        from_node_result = await db.execute(
            select(GraphNode).where(
                GraphNode.name.like(f"{current_role}%"),
                GraphNode.level == current_level,
            )
        )
        from_node = from_node_result.scalar_one_or_none()
    else:
        # 尝试根据技能匹配起始节点
        from_node = None

    # 查找目标节点
    to_node_result = await db.execute(
        select(GraphNode).where(
            GraphNode.name.like(f"{target_role}%"),
            GraphNode.level == target_level,
        )
    )
    to_node = to_node_result.scalar_one_or_none()

    if not to_node:
        return {
            "error": f"目标节点未找到: {target_role} - {target_level}",
        }

    # 主路径：直接晋升路径
    main_path: list[dict[str, Any]] = []
    if from_node:
        main_path = await find_path_dijkstra(db, from_node.id, to_node.id)

    # 备选路径：横向转岗 + 垂直发展
    alternative_paths: list[dict[str, Any]] = []

    # 获取所有角色节点
    all_nodes_result = await db.execute(
        select(GraphNode).where(
            GraphNode.node_type == "role",
            GraphNode.level == "entry",
        )
    )
    all_role_nodes = list(all_nodes_result.scalars().all())

    # 尝试从每个节点到达目标节点
    for node in all_role_nodes:
        if from_node and node.id == from_node.id:
            continue

        # 检查是否有转岗路径
        path = await find_path_dijkstra(db, node.id, to_node.id)
        if path and len(path) > 1:
            # 检查第一步是否是横向转岗
            first_edge = path[0].get("edge", {})
            if first_edge.get("edge_type") == "transition":
                alternative_paths.append({
                    "intermediate_role": path[0]["name"],
                    "path": path,
                    "steps": len(path) - 1,
                })

    # 排序备选路径
    alternative_paths.sort(key=lambda x: x["steps"])

    # 生成行动计划
    action_plan = _generate_action_plan(main_path, student_skills, target_role)

    return {
        "student_skills": student_skills,
        "target_role": target_role,
        "target_level": target_level,
        "main_path": main_path,
        "alternative_paths": alternative_paths[:3],  # 最多返回3条备选路径
        "action_plan": action_plan,
    }


def _generate_action_plan(
    path: list[dict[str, Any]],
    student_skills: list[str],
    target_role: str,
) -> list[dict[str, Any]]:
    """根据路径生成具体的行动计划。"""
    if not path:
        return []

    student_skills_set = set(student_skills)
    plan: list[dict[str, Any]] = []

    for i, step in enumerate(path):
        step_skills: list[str] = []
        actions: list[str] = []

        edge = step.get("edge", {})
        explanation = edge.get("explanation", {})

        if edge.get("edge_type") == "vertical":
            # 垂直晋升行动计划
            actions = explanation.get("action_items", [])
            plan.append({
                "step": i + 1,
                "type": "promotion",
                "target": step["name"],
                "level": step.get("level", ""),
                "actions": actions,
                "estimated_time": "1-2年",
            })

        elif edge.get("edge_type") == "transition":
            # 横向转岗行动计划
            gap_skills = explanation.get("gap_skills", [])
            transferable = explanation.get("transferable_skills", [])

            for skill in gap_skills:
                if skill.lower() not in student_skills_set:
                    step_skills.append(skill)

            actions = [
                f"学习: {', '.join(step_skills[:5])}" if step_skills else "巩固现有技能",
                "获取相关项目经验",
                "考取相关证书",
            ]

            plan.append({
                "step": i + 1,
                "type": "transfer",
                "target": step["name"],
                "level": step.get("level", ""),
                "skills_to_learn": step_skills,
                "transferable_skills": transferable,
                "actions": actions,
                "estimated_time": "6个月-1年",
            })

    return plan


# ---------------------------------------------------------------------------
# 4. 图谱数据接口
# ---------------------------------------------------------------------------


async def get_graph_nodes(
    db: AsyncSession,
    node_type: str | None = None,
    level: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """获取图谱节点列表。"""
    query = select(GraphNode)

    if node_type:
        query = query.where(GraphNode.node_type == node_type)
    if level:
        query = query.where(GraphNode.level == level)

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    nodes = result.scalars().all()

    return [
        {
            "id": str(n.id),
            "node_type": n.node_type,
            "name": n.name,
            "level": n.level,
            "description": n.description,
            "metadata": n.metadata_json,
        }
        for n in nodes
    ]


async def get_graph_edges(
    db: AsyncSession,
    edge_type: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """获取图谱边列表。"""
    query = select(GraphEdge)

    if edge_type:
        query = query.where(GraphEdge.edge_type == edge_type)

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    edges = result.scalars().all()

    return [
        {
            "id": str(e.id),
            "source": str(e.source_node_id),
            "target": str(e.target_node_id),
            "edge_type": e.edge_type,
            "weight": e.weight,
            "explanation": e.explanation_json,
        }
        for e in edges
    ]


async def get_path(
    db: AsyncSession,
    source_node_id: UUID,
    target_node_id: UUID,
) -> list[dict[str, Any]]:
    """获取两点之间的路径。"""
    return await find_path_dijkstra(db, source_node_id, target_node_id)


async def get_cytoscape_elements(
    db: AsyncSession,
    edge_type: str | None = None,
) -> dict[str, Any]:
    """获取兼容 Cytoscape.js 的图谱数据格式。"""
    # 获取节点
    nodes = await get_graph_nodes(db, limit=1000)

    # 获取边
    edges_result = await db.execute(select(GraphEdge))
    if edge_type:
        edges_result = await db.execute(
            select(GraphEdge).where(GraphEdge.edge_type == edge_type)
        )
    all_edges = list(edges_result.scalars().all())

    # 转换为 Cytoscape 格式
    elements: list[dict[str, Any]] = []

    for node in nodes:
        elements.append({
            "data": {
                "id": node["id"],
                "label": node["name"],
                "node_type": node["node_type"],
                "level": node["level"],
            }
        })

    for edge in all_edges:
        elements.append({
            "data": {
                "id": str(edge.id),
                "source": str(edge.source_node_id),
                "target": str(edge.target_node_id),
                "edge_type": edge.edge_type,
                "weight": edge.weight,
            }
        })

    return {"elements": elements}


async def get_job_requirements(job_id: UUID, db: AsyncSession) -> dict[str, Any]:
    """获取岗位的完整要求图谱。"""
    job = await db.get(Job, job_id)
    if not job:
        raise ValueError(f"Job {job_id} not found")

    # 获取关联的 JobProfile
    result = await db.execute(
        select(JobProfile)
        .where(JobProfile.role_id == job.role_id)
        .order_by(JobProfile.version.desc())
    )
    profile = result.scalar_one_or_none()

    if not profile:
        return {
            "job": {
                "id": str(job.id),
                "title": job.title,
                "role": job.role,
            },
            "error": "No profile found",
        }

    profile_json = profile.profile_json
    dims = profile_json.get("dimensions", {})

    return {
        "job": {
            "id": str(job.id),
            "title": job.title,
            "role": job.role,
            "experience_req": job.experience_req,
            "education_req": job.education_req,
        },
        "skills": dims.get("professional_skills", []),
        "basic_requirements": dims.get("basic_requirements", {}),
        "work_conditions": dims.get("work_conditions", {}),
        "development_space": dims.get("development_space", {}),
    }


async def find_related_skills(skill: str, db: AsyncSession) -> list[dict[str, Any]]:
    """查找与给定技能相关的技能。"""
    # 从所有 JobProfile 中查找包含该技能的
    result = await db.execute(
        select(JobProfile).where(JobProfile.profile_json.isnot(None))
    )
    profiles = list(result.scalars().all())

    skill_lower = skill.lower()
    related: list[dict[str, Any]] = []

    # 收集所有技能及其出现次数
    skill_counts: dict[str, int] = defaultdict(int)

    for profile in profiles:
        skills = _get_skills_from_profile(profile.profile_json)
        if skill_lower in skills:
            for s in skills:
                if s != skill_lower:
                    skill_counts[s] += 1

    # 按出现次数排序
    sorted_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    for skill_name, count in sorted_skills:
        related.append({
            "skill": skill_name,
            "co_occurrence_count": count,
            "relationship": "co_occurrence",
        })

    return related
