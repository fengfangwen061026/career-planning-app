from collections import defaultdict
from datetime import datetime
from typing import Any, Iterable

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job, Role

_cache: dict | None = None

CATEGORY_COLORS = [
    "#6366f1",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#ef4444",
    "#06b6d4",
    "#ec4899",
]

CATEGORY_ICONS = {
    "技术": "⚙️",
    "研发": "⚙️",
    "工程": "⚙️",
    "销售": "💼",
    "商务": "💼",
    "运营": "📢",
    "市场": "📢",
    "推广": "📢",
    "管理": "🏢",
    "行政": "🏢",
    "法律": "⚖️",
    "咨询": "💡",
    "质量": "🔍",
    "测试": "🔍",
    "服务": "🎯",
    "其他": "📋",
}


async def get_graph_cache(_db: AsyncSession) -> dict | None:
    return _cache


async def build_and_cache_graph(db: AsyncSession) -> dict:
    global _cache

    roles = await fetch_roles_with_counts(db)
    nodes, edges, totals = assemble_from_roles(roles)
    _cache = {
        "nodes": nodes,
        "edges": edges,
        "totals": totals,
        "generated_at": datetime.utcnow().isoformat(),
    }
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


def get_icon(category: str) -> str:
    for keyword, icon in CATEGORY_ICONS.items():
        if keyword in category:
            return icon
    return "📋"


def assemble_from_roles(roles: Iterable[Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, int]]:
    nodes: list[dict[str, Any]] = [
        {"id": "root", "label": "\u804c\u4e1a\u56fe\u8c31", "type": "root"}
    ]
    edges: list[dict[str, Any]] = []

    categories: dict[str, list[Any]] = defaultdict(list)
    for role in roles:
        category = role.category or "其他"
        categories[category].append(role)

    total_roles = 0
    total_jds = 0

    for index, category in enumerate(sorted(categories)):
        color = CATEGORY_COLORS[index % len(CATEGORY_COLORS)]
        cat_roles = categories[category]
        cat_id = f"cat_{category}"
        jd_total = sum(int(role.jd_count or 0) for role in cat_roles)
        job_count = len(cat_roles)

        total_roles += job_count
        total_jds += jd_total

        nodes.append(
            {
                "id": cat_id,
                "label": category,
                "type": "category",
                "color": color,
                "icon": get_icon(category),
                "count": job_count,
                "job_count": job_count,
                "jd_total": jd_total,
            }
        )
        edges.append({"source": "root", "target": cat_id})

        for role in cat_roles:
            job_id = f"job_{role.id}"
            nodes.append(
                {
                    "id": job_id,
                    "label": role.name,
                    "type": "job",
                    "role_id": str(role.id),
                    "category": category,
                    "color": color,
                    "icon": get_icon(category),
                    "jd_count": int(role.jd_count or 0),
                }
            )
            edges.append({"source": cat_id, "target": job_id})

    totals = {
        "role_count": total_roles,
        "jd_count": total_jds,
        "category_count": len(categories),
    }

    return nodes, edges, totals
