"""Roles API routes."""
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.job import Job, Role
from app.schemas.job import RoleResponse

router = APIRouter()


@router.get("/", response_model=list[RoleResponse])
async def list_roles(
    include_stats: bool = Query(True, description="是否包含统计信息"),
    db: AsyncSession = Depends(get_db),
) -> list[RoleResponse]:
    """获取所有 Role 列表及统计"""
    # 获取所有 roles
    result = await db.execute(select(Role).order_by(Role.category, Role.name))
    roles = result.scalars().all()

    if not include_stats:
        return [RoleResponse.model_validate(r) for r in roles]

    # 获取每个 role 的 job 数量
    job_counts = await db.execute(
        select(Job.role, func.count(Job.id)).group_by(Job.role)
    )
    counts_map = {row[0]: row[1] for row in job_counts.all()}

    # 构建响应
    response = []
    for role in roles:
        role_resp = RoleResponse.model_validate(role)
        role_resp.job_count = counts_map.get(role.name, 0)
        response.append(role_resp)

    return response
