from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.constants.job_categories import JOB_CATEGORIES

_cache: dict | None = None


async def get_graph_cache(_db: AsyncSession) -> dict | None:
    return _cache


async def build_and_cache_graph(db: AsyncSession) -> dict:
    global _cache
    from app.models.job import Job
    result = await db.execute(
        select(Job.role, func.count().label("cnt")).group_by(Job.role)
    )
    job_counts = {row.role: row.cnt for row in result}
    nodes, edges = _assemble(job_counts)
    _cache = {"nodes": nodes, "edges": edges, "generated_at": datetime.utcnow().isoformat()}
    return _cache


def _assemble(job_counts: dict) -> tuple[list, list]:
    nodes: list = [{"id": "root", "label": "职业图谱", "type": "root"}]
    edges: list = []
    for category, meta in JOB_CATEGORIES.items():
        cat_id = f"cat_{category}"
        nodes.append({"id": cat_id, "label": category, "type": "category",
                      "color": meta["color"], "icon": meta["icon"], "count": len(meta["jobs"])})
        edges.append({"source": "root", "target": cat_id})
        for job in meta["jobs"]:
            nodes.append({"id": f"job_{job}", "label": job, "type": "job",
                          "category": category, "color": meta["color"],
                          "jd_count": job_counts.get(job, 0)})
            edges.append({"source": cat_id, "target": f"job_{job}"})
    return nodes, edges
