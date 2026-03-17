"""Graph service for building and caching job graph data."""
from datetime import datetime
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.job_categories import JOB_CATEGORIES
from app.models.graph_cache import GraphCache
from app.models.job import Job


async def get_graph_cache(db: AsyncSession) -> dict[str, Any] | None:
    """Get cached graph data if available.

    Returns the cached graph data or None if not found.
    """
    row = await db.get(GraphCache, 1)
    if row and row.data:
        return dict(row.data)
    return None


async def build_and_cache_graph(db: AsyncSession) -> dict[str, Any]:
    """Build job graph from job data and cache it.

    This function:
    1. Queries job counts from the database
    2. Assembles nodes and edges using JOB_CATEGORIES
    3. Caches the result in graph_cache table

    Returns the assembled graph data.
    """
    # Query job counts - group by title (normalized job name)
    result = await db.execute(
        select(Job.title, func.count(Job.id).label("count")).group_by(Job.title)
    )
    # mypy can't correctly infer the type from func.count, using cast to avoid
    job_counts: dict[str, int] = {}
    for row in result:
        count_value = row.count  # type: ignore[attr-defined]
        job_counts[str(row.title)] = count_value  # type: ignore[assignment]

    # Assemble nodes and edges
    nodes, edges = assemble_graph(job_counts)

    # Prepare cache data
    data: dict[str, Any] = {
        "nodes": nodes,
        "edges": edges,
        "generated_at": datetime.utcnow().isoformat(),
    }

    # Upsert cache (INSERT ... ON CONFLICT DO UPDATE)
    cached = GraphCache(id=1, data=data)
    await db.merge(cached)
    await db.commit()

    return data


def assemble_graph(job_counts: dict[str, int]) -> tuple[list[dict], list[dict]]:
    """Assemble graph nodes and edges from job counts and category mapping.

    Args:
        job_counts: Dictionary mapping job title to JD count

    Returns:
        Tuple of (nodes list, edges list)
    """
    nodes: list[dict] = []
    edges: list[dict] = []

    # Root node
    nodes.append(
        {
            "id": "root",
            "label": "职业图谱",
            "type": "root",
        }
    )

    # Category nodes and their job nodes
    for category, meta in JOB_CATEGORIES.items():
        cat_id = f"cat_{category}"
        nodes.append(
            {
                "id": cat_id,
                "label": category,
                "type": "category",
                "color": meta["color"],
                "icon": meta["icon"],
                "count": len(meta["jobs"]),
            }
        )
        edges.append({"source": "root", "target": cat_id})

        # Add job nodes under this category
        for job in meta["jobs"]:
            job_id = f"job_{job}"
            nodes.append(
                {
                    "id": job_id,
                    "label": job,
                    "type": "job",
                    "category": category,
                    "color": meta["color"],
                    "jd_count": job_counts.get(job, 0),
                }
            )
            edges.append({"source": cat_id, "target": job_id})

    # Handle jobs not in any category - add to "其他"
    categorized_jobs = set()
    for meta in JOB_CATEGORIES.values():
        categorized_jobs.update(meta["jobs"])

    uncategorized = set(job_counts.keys()) - categorized_jobs
    if uncategorized:
        cat_id = "cat_其他"
        nodes.append(
            {
                "id": cat_id,
                "label": "其他",
                "type": "category",
                "color": "#94a3b8",
                "icon": "📋",
                "count": len(uncategorized),
            }
        )
        edges.append({"source": "root", "target": cat_id})

        for job in uncategorized:
            job_id = f"job_{job}"
            nodes.append(
                {
                    "id": job_id,
                    "label": job,
                    "type": "job",
                    "category": "其他",
                    "color": "#94a3b8",
                    "jd_count": job_counts.get(job, 0),
                }
            )
            edges.append({"source": cat_id, "target": job_id})

    return nodes, edges
