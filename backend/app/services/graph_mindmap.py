from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.job import Job, JobProfile, Role

_cache: dict[str, Any] | None = None

COMMUNITY_COLORS = [
    "#2F6FED",
    "#159A9C",
    "#E07A2E",
    "#C85272",
    "#7C6DC8",
    "#4D7C57",
    "#B75D69",
    "#4E6FA8",
]

LEVEL_VALUE_MAP = {
    "unknown": 0,
    "entry": 1,
    "stable": 2,
    "growing": 3,
    "mature": 4,
    "expert": 5,
}

EDUCATION_VALUE_MAP = {
    "不限": 0,
    "大专及以上": 1,
    "本科及以上": 2,
    "硕士及以上": 3,
    "博士及以上": 4,
}

SOFT_DIMENSION_KEYS = (
    "communication",
    "teamwork",
    "stress_tolerance",
    "innovation",
    "learning_ability",
)

TRANSITION_WEIGHT_THRESHOLD = 0.24
COMMUNITY_EDGE_THRESHOLD = 0.45
TRANSITION_TOP_N = 3


async def get_graph_cache(_db: AsyncSession) -> dict[str, Any] | None:
    return _cache


async def build_and_cache_graph(db: AsyncSession) -> dict[str, Any]:
    global _cache
    _cache = await assemble_graph_payload(db)
    return _cache


async def fetch_roles_with_counts(db: AsyncSession) -> list[Any]:
    result = await db.execute(
        select(
            Role.name,
            Role.id,
            Role.category,
            func.count(Job.id).label("jd_count"),
        )
        .outerjoin(Job, Job.role_id == Role.id)
        .group_by(Role.id, Role.name, Role.category)
        .having(func.count(Job.id) > 0)
        .order_by(Role.category, Role.name)
    )
    return list(result.all())


async def assemble_graph_payload(db: AsyncSession) -> dict[str, Any]:
    latest_profiles = await _fetch_latest_profiles(db)
    if not latest_profiles:
        return {
            "nodes": [],
            "edges": [],
            "communities": [],
            "totals": {
                "role_count": 0,
                "jd_count": 0,
                "community_count": 0,
                "edge_count": 0,
            },
            "meta": {
                "generated_at": datetime.utcnow().isoformat(),
                "edge_policy": f"top-{TRANSITION_TOP_N}-transition-plus-community-progression",
                "transition_edge_count": 0,
                "vertical_edge_count": 0,
            },
            "generated_at": datetime.utcnow().isoformat(),
        }

    job_counts = await _fetch_job_counts(db)
    node_payloads = _build_node_payloads(latest_profiles, job_counts)
    pair_metrics = _build_pair_metrics(node_payloads)
    transition_edges = _select_transition_edges(pair_metrics)
    communities = _build_communities(node_payloads, transition_edges)
    community_lookup = {item["community_id"]: item for item in communities}

    for node in node_payloads:
        community = community_lookup[node["community_id"]]
        node["community_color"] = community["color"]
        node["community_size"] = community["node_count"]
        node["color"] = community["color"]

    vertical_edges = _build_vertical_edges(node_payloads, pair_metrics, transition_edges)
    all_edges = transition_edges + vertical_edges

    totals = {
        "role_count": len(node_payloads),
        "jd_count": sum(int(node["job_count"]) for node in node_payloads),
        "community_count": len(communities),
        "edge_count": len(all_edges),
    }
    generated_at = datetime.utcnow().isoformat()

    return {
        "nodes": node_payloads,
        "edges": all_edges,
        "communities": communities,
        "totals": totals,
        "meta": {
            "generated_at": generated_at,
            "edge_policy": f"top-{TRANSITION_TOP_N}-transition-plus-community-progression",
            "transition_edge_count": len(transition_edges),
            "vertical_edge_count": len(vertical_edges),
        },
        "generated_at": generated_at,
    }


async def _fetch_latest_profiles(db: AsyncSession) -> dict[UUID, JobProfile]:
    result = await db.execute(
        select(JobProfile).options(selectinload(JobProfile.role))
    )
    profiles = list(result.scalars().all())

    latest: dict[UUID, JobProfile] = {}
    for profile in profiles:
        existing = latest.get(profile.role_id)
        if existing is None or profile.version > existing.version:
            latest[profile.role_id] = profile
    return latest


async def _fetch_job_counts(db: AsyncSession) -> dict[UUID, int]:
    result = await db.execute(
        select(Job.role_id, func.count(Job.id))
        .where(Job.role_id.is_not(None))
        .group_by(Job.role_id)
    )
    return {role_id: int(count) for role_id, count in result.all() if role_id is not None}


def _build_node_payloads(latest_profiles: dict[UUID, JobProfile], job_counts: dict[UUID, int]) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []

    for role_id, profile in latest_profiles.items():
        role = profile.role
        if role is None:
            continue

        profile_json = profile.profile_json or {}
        skill_names = _extract_skill_names(profile_json)
        soft_scores = _extract_soft_scores(profile_json)
        exp_min = _extract_experience_min(profile_json)

        nodes.append(
            {
                "id": f"role:{role_id}",
                "type": "job",
                "role_id": str(role_id),
                "profile_id": str(profile.id),
                "label": profile_json.get("role_name") or role.name,
                "summary": profile_json.get("summary") or "",
                "job_count": int(job_counts.get(role_id, 0)),
                "profile_version": int(profile.version),
                "level": role.level or "unknown",
                "heat": int(job_counts.get(role_id, 0)),
                "skills": skill_names,
                "top_skills": skill_names[:6],
                "soft_scores": soft_scores,
                "education": _extract_education_value(profile_json),
                "experience_min": exp_min,
                "maturity_score": _calc_maturity_score(role.level, exp_min),
                "community_id": f"community:{role_id}",
                "community_color": COMMUNITY_COLORS[0],  # will be overwritten by _build_communities
                "color": COMMUNITY_COLORS[0],  # will be overwritten by _build_communities
            }
        )

    nodes.sort(key=lambda item: item["label"])
    return nodes


def _build_pair_metrics(nodes: list[dict[str, Any]]) -> dict[frozenset[str], dict[str, Any]]:
    metrics: dict[frozenset[str], dict[str, Any]] = {}

    for index, source in enumerate(nodes):
        for target in nodes[index + 1:]:
            source_skills = source["skills"]
            target_skills = target["skills"]
            shared_skills = sorted(set(source_skills) & set(target_skills))
            gap_to_target = sorted(set(target_skills) - set(source_skills))
            gap_to_source = sorted(set(source_skills) - set(target_skills))

            skill_overlap = _jaccard_similarity(source_skills, target_skills)
            soft_similarity = _soft_similarity(source["soft_scores"], target["soft_scores"])
            requirement_proximity = _requirement_proximity(source, target)
            experience_proximity = _experience_proximity(
                int(source["experience_min"]),
                int(target["experience_min"]),
            )
            weight = round(
                min(
                    1.0,
                    0.55 * skill_overlap
                    + 0.20 * soft_similarity
                    + 0.15 * requirement_proximity
                    + 0.10 * experience_proximity,
                ),
                3,
            )

            edge_key = frozenset((source["id"], target["id"]))
            metrics[edge_key] = {
                "source_id": source["id"],
                "target_id": target["id"],
                "weight": weight,
                "skill_overlap": round(skill_overlap, 3),
                "soft_similarity": round(soft_similarity, 3),
                "requirement_proximity": round(requirement_proximity, 3),
                "experience_proximity": round(experience_proximity, 3),
                "shared_skills": shared_skills[:6],
                "gap_to_target": gap_to_target[:6],
                "gap_to_source": gap_to_source[:6],
            }

    return metrics


def _select_transition_edges(pair_metrics: dict[frozenset[str], dict[str, Any]]) -> list[dict[str, Any]]:
    candidates_by_node: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for metric in pair_metrics.values():
        if metric["weight"] < TRANSITION_WEIGHT_THRESHOLD:
            continue
        candidates_by_node[metric["source_id"]].append(metric)
        candidates_by_node[metric["target_id"]].append(metric)

    selected_pairs: set[frozenset[str]] = set()
    for node_id, candidates in candidates_by_node.items():
        candidates.sort(
            key=lambda item: (
                item["weight"],
                item["skill_overlap"],
                len(item["shared_skills"]),
            ),
            reverse=True,
        )
        for metric in candidates[:TRANSITION_TOP_N]:
            pair_key = frozenset((metric["source_id"], metric["target_id"]))
            selected_pairs.add(pair_key)

    edges: list[dict[str, Any]] = []
    for pair_key in sorted(selected_pairs, key=lambda item: sorted(item)):
        metric = pair_metrics[pair_key]
        strength_level = _strength_level(metric["weight"])
        source_id, target_id = sorted((metric["source_id"], metric["target_id"]))
        edges.append(
            {
                "id": f"transition:{source_id}:{target_id}",
                "source": source_id,
                "target": target_id,
                "edge_type": "transition",
                "weight": metric["weight"],
                "strength_level": strength_level,
                "directional": False,
                "skill_overlap": metric["skill_overlap"],
                "shared_skills": metric["shared_skills"],
                "gap_skills": metric["gap_to_target"],
                "reasons": _build_transition_reasons(metric),
            }
        )

    edges.sort(key=lambda item: item["weight"], reverse=True)
    return edges


def _build_communities(
    nodes: list[dict[str, Any]],
    transition_edges: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    parents = {node["id"]: node["id"] for node in nodes}

    def find(node_id: str) -> str:
        parent = parents[node_id]
        if parent != node_id:
            parents[node_id] = find(parent)
        return parents[node_id]

    def union(left: str, right: str) -> None:
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parents[right_root] = left_root

    for edge in transition_edges:
        if edge["weight"] >= COMMUNITY_EDGE_THRESHOLD:
            union(edge["source"], edge["target"])

    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for node in nodes:
        groups[find(node["id"])].append(node)

    ordered_groups = sorted(
        groups.values(),
        key=lambda items: (-len(items), items[0]["label"]),
    )

    communities: list[dict[str, Any]] = []
    for index, members in enumerate(ordered_groups, start=1):
        community_id = f"community:{index}"
        color = COMMUNITY_COLORS[(index - 1) % len(COMMUNITY_COLORS)]
        for node in members:
            node["community_id"] = community_id
            node["community_color"] = color
            node["color"] = color

        communities.append(
            {
                "community_id": community_id,
                "label": f"关系簇 {index:02d}",
                "color": color,
                "node_ids": [node["id"] for node in sorted(members, key=lambda item: item["label"])],
                "node_count": len(members),
                "jd_total": sum(int(node["job_count"]) for node in members),
            }
        )

    return communities


def _build_vertical_edges(
    nodes: list[dict[str, Any]],
    pair_metrics: dict[frozenset[str], dict[str, Any]],
    transition_edges: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    transition_pairs = {
        frozenset((edge["source"], edge["target"])) for edge in transition_edges
    }
    nodes_by_id = {node["id"]: node for node in nodes}
    nodes_by_community: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for node in nodes:
        nodes_by_community[node["community_id"]].append(node)

    edges: list[dict[str, Any]] = []
    for community_nodes in nodes_by_community.values():
        for source in sorted(community_nodes, key=lambda item: item["maturity_score"]):
            candidates: list[tuple[float, dict[str, Any], dict[str, Any]]] = []
            for target in community_nodes:
                if source["id"] == target["id"]:
                    continue

                maturity_gap = target["maturity_score"] - source["maturity_score"]
                if maturity_gap <= 0:
                    continue

                pair_key = frozenset((source["id"], target["id"]))
                metric = pair_metrics.get(pair_key)
                if metric is None:
                    continue

                relationship_score = metric["weight"] - min(maturity_gap / 20, 0.35)
                if relationship_score < 0.20:
                    continue
                candidates.append((relationship_score, target, metric))

            candidates.sort(key=lambda item: item[0], reverse=True)

            chosen: tuple[float, dict[str, Any], dict[str, Any]] | None = None
            for item in candidates:
                pair_key = frozenset((source["id"], item[1]["id"]))
                if pair_key not in transition_pairs:
                    chosen = item
                    break
            if chosen is None and candidates:
                chosen = candidates[0]

            if chosen is None:
                continue

            _, target, metric = chosen
            edge_id = f"vertical:{source['id']}:{target['id']}"
            edges.append(
                {
                    "id": edge_id,
                    "source": source["id"],
                    "target": target["id"],
                    "edge_type": "vertical",
                    "weight": round(min(0.95, 0.4 + 0.5 * metric["weight"]), 3),
                    "strength_level": _strength_level(metric["weight"]),
                    "directional": True,
                    "skill_overlap": metric["skill_overlap"],
                    "shared_skills": metric["shared_skills"],
                    "gap_skills": sorted(set(target["skills"]) - set(source["skills"]))[:6],
                    "reasons": _build_vertical_reasons(source, target, metric, nodes_by_id),
                }
            )

    deduped: dict[tuple[str, str], dict[str, Any]] = {}
    for edge in edges:
        key = (edge["source"], edge["target"])
        current = deduped.get(key)
        if current is None or edge["weight"] > current["weight"]:
            deduped[key] = edge
    return sorted(deduped.values(), key=lambda item: item["weight"], reverse=True)


def _build_transition_reasons(metric: dict[str, Any]) -> list[str]:
    reasons: list[str] = []
    if metric["shared_skills"]:
        reasons.append(f"共享技能：{'、'.join(metric['shared_skills'][:3])}")
    if metric["gap_to_target"]:
        reasons.append(f"需补齐：{'、'.join(metric['gap_to_target'][:3])}")
    reasons.append(f"技能重合度 {int(metric['skill_overlap'] * 100)}%")
    return reasons[:3]


def _build_vertical_reasons(
    source: dict[str, Any],
    target: dict[str, Any],
    metric: dict[str, Any],
    _nodes_by_id: dict[str, dict[str, Any]],
) -> list[str]:
    reasons = [
        f"成熟度从 {source['level']} 向 {target['level']} 递进",
        f"共享技能：{'、'.join(metric['shared_skills'][:3])}" if metric["shared_skills"] else "岗位能力谱相邻",
    ]
    if metric["gap_to_target"]:
        reasons.append(f"需强化：{'、'.join(metric['gap_to_target'][:3])}")
    return reasons[:3]


def _extract_skill_names(profile_json: dict[str, Any]) -> list[str]:
    raw_skills = profile_json.get("technical_skills", [])
    skill_names: list[str] = []

    if isinstance(raw_skills, list):
        for item in raw_skills:
            if isinstance(item, str):
                normalized = item.strip()
            elif isinstance(item, dict):
                normalized = str(item.get("skill_name") or item.get("name") or item.get("skill") or "").strip()
            else:
                normalized = ""
            if normalized:
                skill_names.append(normalized)

    deduped: list[str] = []
    seen: set[str] = set()
    for skill in skill_names:
        normalized = skill.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(skill)
    return deduped


def _extract_soft_scores(profile_json: dict[str, Any]) -> dict[str, float]:
    raw = profile_json.get("soft_competencies", {})
    if not isinstance(raw, dict):
        return {}

    scores: dict[str, float] = {}
    for key in SOFT_DIMENSION_KEYS:
        item = raw.get(key)
        if not isinstance(item, dict):
            continue
        value = item.get("value")
        if isinstance(value, (int, float)):
            scores[key] = max(0.0, min(float(value), 5.0)) / 5.0
    return scores


def _extract_experience_min(profile_json: dict[str, Any]) -> int:
    basic_requirements = profile_json.get("basic_requirements", {})
    if not isinstance(basic_requirements, dict):
        return 0

    experience_years = basic_requirements.get("experience_years", {})
    if isinstance(experience_years, dict):
        min_value = experience_years.get("min", 0)
        if isinstance(min_value, (int, float)):
            return int(min_value)
    return 0


def _extract_education_value(profile_json: dict[str, Any]) -> int:
    basic_requirements = profile_json.get("basic_requirements", {})
    if not isinstance(basic_requirements, dict):
        return 0
    education = str(basic_requirements.get("education") or "不限")
    return EDUCATION_VALUE_MAP.get(education, 0)


def _jaccard_similarity(left: list[str], right: list[str]) -> float:
    left_set = {item.lower() for item in left if item}
    right_set = {item.lower() for item in right if item}
    if not left_set and not right_set:
        return 0.0
    union = left_set | right_set
    if not union:
        return 0.0
    return len(left_set & right_set) / len(union)


def _soft_similarity(left: dict[str, float], right: dict[str, float]) -> float:
    shared_keys = set(left) & set(right)
    if not shared_keys:
        return 0.5
    distance = sum(abs(left[key] - right[key]) for key in shared_keys) / len(shared_keys)
    return max(0.0, 1.0 - distance)


def _requirement_proximity(left: dict[str, Any], right: dict[str, Any]) -> float:
    education_gap = abs(int(left["education"]) - int(right["education"]))
    education_score = max(0.0, 1.0 - education_gap / 4)
    return education_score


def _experience_proximity(left: int, right: int) -> float:
    gap = abs(left - right)
    return max(0.0, 1.0 - gap / 8)


def _calc_maturity_score(level: str | None, exp_min: int) -> int:
    return LEVEL_VALUE_MAP.get(level or "unknown", 0) * 10 + max(0, exp_min)


def _strength_level(weight: float) -> str:
    if weight >= 0.72:
        return "high"
    if weight >= 0.48:
        return "medium"
    return "low"


def _soft_key_to_label(key: str) -> str:
    mapping = {
        "communication": "沟通能力",
        "teamwork": "团队协作",
        "stress_tolerance": "抗压能力",
        "innovation": "创新能力",
        "learning_ability": "学习能力",
    }
    return mapping.get(key, key)
