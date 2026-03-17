"""Graph service for building and caching job graph data."""
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.graph_cache import GraphCache
from app.services.graph_mindmap import assemble_from_roles, fetch_roles_with_counts


async def get_graph_cache(db: AsyncSession) -> dict[str, Any] | None:
    """Get cached graph data if available."""
    row = await db.get(GraphCache, 1)
    if row and row.data:
        return dict(row.data)
    return None


async def build_and_cache_graph(db: AsyncSession) -> dict[str, Any]:
    """Build job graph from live role/job data and cache it."""
    roles = await fetch_roles_with_counts(db)
    nodes, edges, totals = assemble_from_roles(roles)

    data: dict[str, Any] = {
        "nodes": nodes,
        "edges": edges,
        "totals": totals,
        "generated_at": datetime.utcnow().isoformat(),
    }

    cached = GraphCache(id=1, data=data)
    await db.merge(cached)
    await db.commit()

    return data
