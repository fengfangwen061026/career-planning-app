"""Utilities for job-profile embeddings and similarity search."""

from __future__ import annotations

import asyncio
import logging
import math
from typing import Any
from uuid import UUID

from sqlalchemy import select

from app.ai.embedding import embedding
from app.database import async_session_factory
from app.models.job import JobProfile, Role
from app.services.job_profile import _build_profile_summary

logger = logging.getLogger(__name__)

BATCH_SIZE = 20


def _cosine_similarity(left: list[float] | None, right: list[float] | None) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    numerator = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0
    return numerator / (left_norm * right_norm)


async def _load_role_names(session) -> dict[UUID, str]:
    result = await session.execute(select(Role.id, Role.name))
    return {role_id: name for role_id, name in result.all()}


async def vectorize_job_profiles(batch_size: int = BATCH_SIZE) -> int:
    """Generate embeddings for job profiles that do not have one."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(JobProfile).where(JobProfile.embedding.is_(None))
        )
        profiles = list(result.scalars().all())
        if not profiles:
            logger.info("All job profiles already have embeddings")
            return 0

        role_names = await _load_role_names(session)
        count = 0
        for start in range(0, len(profiles), batch_size):
            batch = profiles[start:start + batch_size]
            for profile in batch:
                role_name = role_names.get(profile.role_id, "unknown")
                summary = _build_profile_summary(profile.profile_json, role_name)
                profile.embedding = await embedding.embed(summary)
                count += 1
            await session.commit()
            logger.info(
                "Vectorized %s/%s job profiles",
                min(start + batch_size, len(profiles)),
                len(profiles),
            )

        return count


async def rebuild_job_profile_embeddings() -> int:
    """Regenerate embeddings for all job profiles."""
    async with async_session_factory() as session:
        result = await session.execute(select(JobProfile))
        profiles = list(result.scalars().all())
        role_names = await _load_role_names(session)

        count = 0
        for start in range(0, len(profiles), BATCH_SIZE):
            batch = profiles[start:start + BATCH_SIZE]
            for profile in batch:
                role_name = role_names.get(profile.role_id, "unknown")
                summary = _build_profile_summary(profile.profile_json, role_name)
                profile.embedding = await embedding.embed(summary)
                count += 1
            await session.commit()
            logger.info(
                "Rebuilt %s/%s embeddings",
                min(start + BATCH_SIZE, len(profiles)),
                len(profiles),
            )

        return count


async def _load_profiles_with_embeddings() -> list[tuple[JobProfile, Role | None]]:
    async with async_session_factory() as session:
        result = await session.execute(
            select(JobProfile, Role)
            .join(Role, JobProfile.role_id == Role.id)
            .where(JobProfile.embedding.is_not(None))
        )
        return list(result.all())


async def find_similar_profiles(
    profile_id: UUID,
    top_k: int = 5,
    threshold: float = 0.7,
) -> list[dict[str, Any]]:
    """Find job profiles similar to the given profile id."""
    async with async_session_factory() as session:
        current = await session.get(JobProfile, profile_id)
        if current is None or not current.embedding:
            raise ValueError(f"Profile {profile_id} not found or has no embedding")

        result = await session.execute(
            select(JobProfile, Role)
            .join(Role, JobProfile.role_id == Role.id)
            .where(JobProfile.id != profile_id, JobProfile.embedding.is_not(None))
        )
        rows = list(result.all())

    scored = []
    for profile, role in rows:
        similarity = _cosine_similarity(current.embedding, profile.embedding)
        if similarity >= threshold:
            scored.append({
                "id": str(profile.id),
                "role_name": role.name if role else None,
                "version": profile.version,
                "similarity": round(similarity, 6),
            })

    scored.sort(key=lambda item: item["similarity"], reverse=True)
    return scored[:top_k]


async def find_similar_profiles_by_text(
    text_query: str,
    top_k: int = 5,
    threshold: float = 0.7,
) -> list[dict[str, Any]]:
    """Find job profiles similar to a text query."""
    query_embedding = await embedding.embed(text_query)
    rows = await _load_profiles_with_embeddings()

    scored = []
    for profile, role in rows:
        similarity = _cosine_similarity(query_embedding, profile.embedding)
        if similarity >= threshold:
            job_info = profile.profile_json or {}
            scored.append({
                "id": str(profile.id),
                "role_name": role.name if role else None,
                "version": profile.version,
                "title": job_info.get("role_name") or role.name if role else None,
                "similarity": round(similarity, 6),
            })

    scored.sort(key=lambda item: item["similarity"], reverse=True)
    return scored[:top_k]


async def compute_profile_similarity(
    profile_id_a: UUID,
    profile_id_b: UUID,
) -> float:
    """Compute cosine similarity between two embedded profiles."""
    async with async_session_factory() as session:
        profile_a = await session.get(JobProfile, profile_id_a)
        profile_b = await session.get(JobProfile, profile_id_b)

    if profile_a is None or profile_b is None:
        return 0.0
    return round(_cosine_similarity(profile_a.embedding, profile_b.embedding), 6)


async def create_job_profile_index() -> None:
    """Document the current non-pgvector indexing limitation."""
    logger.info(
        "Skipping vector index creation: job_profiles.embedding uses ARRAY(Float), "
        "so pgvector operators and vector indexes are not valid in the current schema."
    )


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        if sys.argv[1] == "rebuild":
            count = asyncio.run(rebuild_job_profile_embeddings())
            print(f"Rebuilt {count} profiles")
        elif sys.argv[1] == "create-index":
            asyncio.run(create_job_profile_index())
        else:
            print("Usage: python vectorize_job_profiles.py [rebuild|create-index]")
    else:
        count = asyncio.run(vectorize_job_profiles())
        print(f"Vectorized {count} profiles")
