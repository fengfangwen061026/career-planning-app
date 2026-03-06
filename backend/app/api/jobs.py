"""Jobs API routes."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from uuid import UUID

from app.database import get_db
from app.models.job import Job, Role
from app.schemas.job import (
    JobResponse,
    JobUpdate,
    PaginatedJobResponse,
    RoleResponse,
)

router = APIRouter()


@router.get("/", response_model=PaginatedJobResponse)
async def list_jobs(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    role: str | None = Query(None, description="Role 筛选"),
    keyword: str | None = Query(None, description="关键词搜索（岗位名称/公司名/城市）"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedJobResponse:
    """分页查询岗位列表（支持 Role 过滤、关键词搜索）"""
    # 构建基础查询
    query = select(Job)
    count_query = select(func.count(Job.id))

    # Role 过滤
    if role:
        query = query.where(Job.role == role)
        count_query = count_query.where(Job.role == role)

    # 关键词搜索
    if keyword:
        keyword_pattern = f"%{keyword}%"
        keyword_filter = or_(
            Job.title.ilike(keyword_pattern),
            Job.company_name.ilike(keyword_pattern),
            Job.city.ilike(keyword_pattern),
            Job.description.ilike(keyword_pattern),
        )
        query = query.where(keyword_filter)
        count_query = count_query.where(keyword_filter)

    # 获取总数
    total = await db.scalar(count_query)

    # 分页
    skip = (page - 1) * page_size
    query = query.order_by(Job.created_at.desc()).offset(skip).limit(page_size)

    # 执行查询
    result = await db.execute(query)
    jobs = result.scalars().all()

    return PaginatedJobResponse(
        items=[JobResponse.model_validate(job) for job in jobs],
        total=total or 0,
        page=page,
        page_size=page_size,
        total_pages=((total or 0) + page_size - 1) // page_size if total else 0,
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> JobResponse:
    """查看单个岗位详情"""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with id {job_id} not found",
        )

    return JobResponse.model_validate(job)


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: UUID,
    job_update: JobUpdate,
    db: AsyncSession = Depends(get_db),
) -> JobResponse:
    """更新岗位信息"""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with id {job_id} not found",
        )

    # 更新字段
    update_data = job_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(job, field, value)

    await db.commit()
    await db.refresh(job)

    return JobResponse.model_validate(job)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """删除岗位"""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with id {job_id} not found",
        )

    await db.delete(job)
    await db.commit()
