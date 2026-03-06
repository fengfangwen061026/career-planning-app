"""Job Profiles API routes - 岗位画像生成与管理."""
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.job import Role
from app.schemas.job import (
    BatchGenerateResponse,
    JobProfileGenerateResponse,
    JobProfileHistoryResponse,
    JobProfileResponse,
    JobProfileUpdate,
)
from app.services.job_profile import (
    generate_role_profile,
    get_role_profiles,
    update_job_profile,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/generate/{role_id}", response_model=JobProfileGenerateResponse)
async def generate_profile_for_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> JobProfileGenerateResponse:
    """为指定 Role 生成岗位画像（新版本不覆盖旧版本）。"""
    try:
        result = await generate_role_profile(role_id, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    profile = result["profile"]
    role = await db.get(Role, role_id)

    return JobProfileGenerateResponse(
        role_id=role_id,
        role_name=role.name if role else "unknown",
        version=profile.version,
        profile=JobProfileResponse.model_validate(profile),
        stats=result.get("stats"),
    )


@router.post("/generate-all", response_model=BatchGenerateResponse)
async def generate_all_profiles(
    role_ids: list[UUID] | None = None,
    db: AsyncSession = Depends(get_db),
) -> BatchGenerateResponse:
    """批量生成所有（或指定）Role 的画像。

    Body 可选传 role_ids 列表，不传则生成所有 Role。
    """
    if role_ids:
        result = await db.execute(select(Role).where(Role.id.in_(role_ids)))
    else:
        result = await db.execute(select(Role).order_by(Role.category, Role.name))
    roles = list(result.scalars().all())

    results: list[JobProfileGenerateResponse] = []
    errors: list[dict[str, Any]] = []

    for role in roles:
        try:
            gen_result = await generate_role_profile(role.id, db)
            profile = gen_result["profile"]
            results.append(JobProfileGenerateResponse(
                role_id=role.id,
                role_name=role.name,
                version=profile.version,
                profile=JobProfileResponse.model_validate(profile),
                stats=gen_result.get("stats"),
            ))
        except Exception as e:
            logger.error("Failed to generate profile for role '%s': %s", role.name, e)
            errors.append({
                "role_id": str(role.id),
                "role_name": role.name,
                "error": str(e),
            })

    return BatchGenerateResponse(
        total=len(roles),
        succeeded=len(results),
        failed=len(errors),
        results=results,
        errors=errors,
    )


@router.get("/{role_id}", response_model=JobProfileHistoryResponse)
async def get_profiles_for_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> JobProfileHistoryResponse:
    """查看指定 Role 的画像（含所有历史版本，最新版在前）。"""
    try:
        data = await get_role_profiles(role_id, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    role = data["role"]
    profiles = data["profiles"]

    return JobProfileHistoryResponse(
        role_id=role_id,
        role_name=role.name,
        profiles=[JobProfileResponse.model_validate(p) for p in profiles],
    )


@router.put("/{profile_id}", response_model=JobProfileResponse)
async def update_profile(
    profile_id: UUID,
    body: JobProfileUpdate,
    db: AsyncSession = Depends(get_db),
) -> JobProfileResponse:
    """人工微调画像内容。"""
    try:
        profile = await update_job_profile(profile_id, body.profile_json, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    return JobProfileResponse.model_validate(profile)
