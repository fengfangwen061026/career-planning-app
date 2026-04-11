"""Graph service compatibility wrappers."""
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.graph_mindmap import build_and_cache_graph, get_graph_cache


async def fetch_roles_with_counts(_db: AsyncSession) -> list[Any]:
    """Legacy placeholder retained for compatibility."""
    return []
