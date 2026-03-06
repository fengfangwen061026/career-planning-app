"""Vectorize skills in skill_dictionary table.

This script:
1. Generates embeddings for each skill in skill_dictionary
2. Stores them in the vector column
3. Creates IVFFlat or HNSW index for fast similarity search
"""
import asyncio
import logging

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embedding import embedding
from app.database import async_session_factory, engine
from app.models.skill_dictionary import SkillDictionary

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BATCH_SIZE = 50
SIMILARITY_THRESHOLD = 0.85


async def _ensure_pgvector_extension(session: AsyncSession) -> None:
    """确保 pgvector 扩展已安装。"""
    try:
        await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await session.commit()
        logger.info("pgvector extension ready")
    except Exception as e:
        logger.warning(f"Could not create vector extension: {e}")


async def _create_vector_index(session: AsyncSession) -> None:
    """创建向量索引以加速相似度搜索。"""
    try:
        # 检查是否已存在索引
        result = await session.execute(text("""
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'skill_dictionary'
            AND indexname LIKE '%embedding%'
        """))
        existing_indexes = result.fetchall()

        if existing_indexes:
            logger.info(f"Vector indexes already exist: {existing_indexes}")
            return

        # 创建 HNSW 索引（更快的近似搜索）
        await session.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_skill_dictionary_embedding_hnsw
            ON skill_dictionary
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
        """))

        # 或者使用 IVFFlat 索引（适合大数据集）
        # await session.execute(text("""
        #     CREATE INDEX IF NOT EXISTS ix_skill_dictionary_embedding_ivfflat
        #     ON skill_dictionary
        #     USING ivfflat (embedding vector_cosine_ops)
        #     WITH (lists = 100)
        # """))

        await session.commit()
        logger.info("Vector index created successfully")
    except Exception as e:
        logger.warning(f"Could not create vector index: {e}")


async def _generate_skill_embedding(skill_name: str, category: str) -> list[float]:
    """为技能生成语义embedding。"""
    # 构建丰富的文本描述以获得更好的向量表示
    text = f"Skill: {skill_name}. Category: {category}."
    return await embedding.embed(text)


async def vectorize_skills(batch_size: int = BATCH_SIZE) -> None:
    """为技能词典中的每个技能生成embedding。"""
    await _ensure_pgvector_extension(async_session_factory)

    async with async_session_factory() as session:
        # 获取需要向量化的技能
        result = await session.execute(
            select(SkillDictionary).where(
                SkillDictionary.embedding.is_(None)
            )
        )
        skills_to_vectorize = result.scalars().all()

        if not skills_to_vectorize:
            logger.info("All skills already have embeddings")
            return

        logger.info(f"Vectorizing {len(skills_to_vectorize)} skills...")

        # 批量处理
        for i in range(0, len(skills_to_vectorize), batch_size):
            batch = skills_to_vectorize[i:i + batch_size]

            # 准备文本
            texts = [
                f"Skill: {s.canonical_name}. Category: {s.category}. Domain: {s.domain}."
                for s in batch
            ]

            # 批量生成embedding
            embeddings = await embedding.embed_batch(texts)

            # 更新数据库
            for skill, emb in zip(batch, embeddings):
                skill.embedding = emb
                logger.debug(f"Vectorized: {skill.canonical_name}")

            await session.commit()
            logger.info(f"Processed {min(i + batch_size, len(skills_to_vectorize))}/{len(skills_to_vectorize)} skills")

        logger.info("Skill vectorization completed")


async def find_similar_skills(
    skill_name: str,
    category: str = "技术类",
    top_k: int = 5,
    threshold: float = SIMILARITY_THRESHOLD,
) -> list[dict]:
    """查找相似技能（用于测试）。"""
    async with async_session_factory() as session:
        # 生成查询embedding
        query_embedding = await _generate_skill_embedding(skill_name, category)

        # 计算余弦相似度（使用 float[] 类型）
        result = await session.execute(
            text("""
                SELECT
                    id,
                    canonical_name,
                    category,
                    1 - (embedding <=> :query_vector::float[]) as similarity
                FROM skill_dictionary
                WHERE 1 - (embedding <=> :query_vector::float[]) > :threshold
                ORDER BY embedding <=> :query_vector::float[]
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
                "canonical_name": row.canonical_name,
                "category": row.category,
                "similarity": float(row.similarity),
            }
            for row in rows
        ]


async def rebuild_embeddings() -> None:
    """重新生成所有技能的embedding（用于更新模型后）。"""
    async with async_session_factory() as session:
        result = await session.execute(
            select(SkillDictionary)
        )
        all_skills = result.scalars().all()

        logger.info(f"Rebuilding embeddings for {len(all_skills)} skills...")

        for i in range(0, len(all_skills), BATCH_SIZE):
            batch = all_skills[i:i + BATCH_SIZE]

            texts = [
                f"Skill: {s.canonical_name}. Category: {s.category}. Domain: {s.domain}."
                for s in batch
            ]

            embeddings = await embedding.embed_batch(texts)

            for skill, emb in zip(batch, embeddings):
                skill.embedding = emb

            await session.commit()
            logger.info(f"Rebuilt {min(i + BATCH_SIZE, len(all_skills))}/{len(all_skills)}")

        logger.info("Rebuild completed")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        if sys.argv[1] == "rebuild":
            asyncio.run(rebuild_embeddings())
        elif sys.argv[1] == "create-index":
            asyncio.run(_create_vector_index(async_session_factory()))
        else:
            print("Usage: python vectorize_skills.py [rebuild|create-index]")
    else:
        asyncio.run(vectorize_skills())
        asyncio.run(_create_vector_index(async_session_factory()))
