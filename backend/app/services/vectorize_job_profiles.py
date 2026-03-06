"""Vectorize job profiles for semantic matching.

This service ensures all JobProfile records have embeddings
and provides utilities for profile similarity search.
"""
import asyncio
import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embedding import embedding
from app.database import async_session_factory
from app.models.job import JobProfile, Role
from app.services.job_profile import _build_profile_summary

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BATCH_SIZE = 20


async def _ensure_pgvector_extension(session: AsyncSession) -> None:
    """确保 pgvector 扩展已安装。"""
    try:
        await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await session.commit()
    except Exception as e:
        logger.warning(f"Could not create vector extension: {e}")


async def vectorize_job_profiles(batch_size: int = BATCH_SIZE) -> int:
    """为没有 embedding 的 JobProfile 生成向量。

    Returns:
        Number of profiles vectorized
    """
    await _ensure_pgvector_extension(async_session_factory)

    async with async_session_factory() as session:
        # 获取需要向量化的画像
        result = await session.execute(
            select(JobProfile).where(
                JobProfile.embedding.is_(None)
            )
        )
        profiles_to_vectorize = result.scalars().all()

        if not profiles_to_vectorize:
            logger.info("All job profiles already have embeddings")
            return 0

        logger.info(f"Vectorizing {len(profiles_to_vectorize)} job profiles...")

        count = 0
        for i in range(0, len(profiles_to_vectorize), batch_size):
            batch = profiles_to_vectorize[i:i + batch_size]

            for profile in batch:
                # 获取 role 名称
                role = await session.get(Role, profile.role_id)
                role_name = role.name if role else "unknown"

                # 构建摘要并生成 embedding
                summary = _build_profile_summary(profile.profile_json, role_name)
                profile.embedding = await embedding.embed(summary)
                count += 1

            await session.commit()
            logger.info(f"Processed {min(i + batch_size, len(profiles_to_vectorize))}/{len(profiles_to_vectorize)}")

        logger.info(f"Vectorized {count} job profiles")
        return count


async def rebuild_job_profile_embeddings() -> int:
    """重新生成所有 JobProfile 的 embedding。

    Returns:
        Number of profiles rebuilt
    """
    async with async_session_factory() as session:
        result = await session.execute(select(JobProfile))
        all_profiles = result.scalars().all()

        logger.info(f"Rebuilding embeddings for {len(all_profiles)} job profiles...")

        count = 0
        for i in range(0, len(all_profiles), BATCH_SIZE):
            batch = all_profiles[i:i + BATCH_SIZE]

            for profile in batch:
                role = await session.get(Role, profile.role_id)
                role_name = role.name if role else "unknown"

                summary = _build_profile_summary(profile.profile_json, role_name)
                profile.embedding = await embedding.embed(summary)
                count += 1

            await session.commit()
            logger.info(f"Rebuilt {min(i + BATCH_SIZE, len(all_profiles))}/{len(all_profiles)}")

        logger.info(f"Rebuilt {count} job profile embeddings")
        return count


def _cosine_similarity_sql(column: str, query_param: str) -> str:
    """生成计算余弦相似度的 SQL 片段。

    由于 embedding 是 float[] 类型，我们需要使用 pgvector 的操作符。
    pgvector 的 <=> 操作符可以用于 float[] 类型。
    """
    return f"1 - ({column} <=> {query_param}::float[])"


async def find_similar_profiles(
    profile_id: UUID,
    top_k: int = 5,
    threshold: float = 0.7,
) -> list[dict[str, Any]]:
    """查找与指定画像相似的其他画像。

    Args:
        profile_id: 要查找相似的画像ID
        top_k: 返回前K个最相似的画像
        threshold: 最小相似度阈值

    Returns:
        相似画像列表，每个包含 id, role_name, version, similarity
    """
    async with async_session_factory() as session:
        # 获取目标画像的 embedding
        profile = await session.get(JobProfile, profile_id)
        if not profile or not profile.embedding:
            raise ValueError(f"Profile {profile_id} not found or has no embedding")

        # 查询相似画像
        result = await session.execute(
            text("""
                SELECT
                    jp.id,
                    r.name as role_name,
                    jp.version,
                    1 - (jp.embedding <=> :query_vector::float[]) as similarity
                FROM job_profiles jp
                JOIN roles r ON jp.role_id = r.id
                WHERE jp.id != :exclude_id
                  AND jp.embedding IS NOT NULL
                  AND 1 - (jp.embedding <=> :query_vector::float[]) > :threshold
                ORDER BY jp.embedding <=> :query_vector::float[]
                LIMIT :top_k
            """),
            {
                "query_vector": profile.embedding,
                "exclude_id": str(profile_id),
                "threshold": threshold,
                "top_k": top_k,
            }
        )

        rows = result.fetchall()
        return [
            {
                "id": str(row.id),
                "role_name": row.role_name,
                "version": row.version,
                "similarity": float(row.similarity),
            }
            for row in rows
        ]


async def find_similar_profiles_by_text(
    text_query: str,
    top_k: int = 5,
    threshold: float = 0.7,
) -> list[dict[str, Any]]:
    """根据文本描述查找相似的岗位画像。

    Args:
        text_query: 文本描述（如：需要Python后端开发技能）
        top_k: 返回前K个最相似的画像
        threshold: 最小相似度阈值

    Returns:
        相似画像列表
    """
    # 生成查询文本的 embedding
    query_embedding = await embedding.embed(text_query)

    async with async_session_factory() as session:
        result = await session.execute(
            text("""
                SELECT
                    jp.id,
                    r.name as role_name,
                    jp.version,
                    jp.profile_json->>'basic_info'->>'title' as title,
                    1 - (jp.embedding <=> :query_vector::float[]) as similarity
                FROM job_profiles jp
                JOIN roles r ON jp.role_id = r.id
                WHERE jp.embedding IS NOT NULL
                  AND 1 - (jp.embedding <=> :query_vector::float[]) > :threshold
                ORDER BY jp.embedding <=> :query_vector::float[]
                LIMIT :top_k
            """),
            {
                "query_vector": query_embedding,
                "threshold": threshold,
                "top_k": top_k,
            }
        )

        rows = result.fetchall()
        return [
            {
                "id": str(row.id),
                "role_name": row.role_name,
                "version": row.version,
                "title": row.title,
                "similarity": float(row.similarity),
            }
            for row in rows
        ]


async def compute_profile_similarity(
    profile_id_a: UUID,
    profile_id_b: UUID,
) -> float:
    """计算两个画像之间的相似度。

    Args:
        profile_id_a: 画像A的ID
        profile_id_b: 画像B的ID

    Returns:
        相似度分数 (0-1)
    """
    async with async_session_factory() as session:
        result = await session.execute(
            text("""
                SELECT
                    1 - (a.embedding <=> b.embedding::float[]) as similarity
                FROM job_profiles a
                JOIN job_profiles b ON a.id = :id_a AND b.id = :id_b
                WHERE a.embedding IS NOT NULL AND b.embedding IS NOT NULL
            """),
            {"id_a": str(profile_id_a), "id_b": str(profile_id_b)}
        )

        row = result.fetchone()
        return float(row.similarity) if row else 0.0


async def create_job_profile_index() -> None:
    """为 job_profiles 表创建向量索引。"""
    async with async_session_factory() as session:
        try:
            # 确保 pgvector 扩展已启用
            await _ensure_pgvector_extension(session)

            # 检查是否已存在索引
            result = await session.execute(text("""
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'job_profiles'
                AND indexname LIKE '%embedding%'
            """))
            existing_indexes = result.fetchall()

            if existing_indexes:
                logger.info(f"Vector indexes already exist: {existing_indexes}")
                return

            # 创建 HNSW 索引
            # 注意：embedding 列是 float[] 类型，pgvector 支持这种类型
            await session.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_job_profiles_embedding_hnsw
                ON job_profiles
                USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64)
            """))

            await session.commit()
            logger.info("Job profile vector index created successfully")
        except Exception as e:
            logger.warning(f"Could not create vector index: {e}")


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
        asyncio.run(create_job_profile_index())
