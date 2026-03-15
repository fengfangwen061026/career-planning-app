"""Jobs API routes."""
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from uuid import UUID

from app.database import get_db
from app.models.job import Job, Role, Company
from app.schemas.job import (
    JobResponse,
    JobUpdate,
    PaginatedJobResponse,
    RoleResponse,
    JobWithCompanyResponse,
    CompanyBrief,
)
from app.services.graph_service import get_graph_cache, build_and_cache_graph

router = APIRouter()

# 福利关键词列表
BENEFIT_KEYWORDS = [
    "五险一金", "五险二金", "六险一金", "六险二金", "社保", "公积金",
    "带薪年假", "年假", "带薪病假", "病假",
    "周末双休", "双休", "大小周", "弹性工作",
    "餐补", "餐补", "饭补", "午餐补贴", "工作餐",
    "定期体检", "年度体检", "免费体检",
    "股票期权", "期权", "股权", "股票",
    "通讯补贴", "交通补贴", "车补", "油补",
    "住房补贴", "房补", "住宿补贴", "租房补贴",
    "下午茶", "零食", "节日福利", "节日礼品", "生日福利",
    "年终奖", "13薪", "14薪", "年底双薪",
    "加班补贴", "加班费", "调休",
    "培训机会", "培训", "学习补贴",
    "晋升空间", "晋升", "成长空间",
    "扁平管理", "氛围好", "团队年轻",
    "零食下午茶", "免费零食",
]


def extract_benefits(description: str | None) -> list[str]:
    """从 JD 描述中提取福利关键词"""
    if not description:
        return []
    benefits = []
    desc_lower = description.lower()
    for keyword in BENEFIT_KEYWORDS:
        if keyword in desc_lower:
            benefits.append(keyword)
    # 去重并返回
    return list(dict.fromkeys(benefits))


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


@router.get("/by-role/{role_id}", response_model=list[JobWithCompanyResponse])
async def get_jobs_by_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[JobWithCompanyResponse]:
    """获取某 role 下的全量 JD 列表（包含公司信息和福利提取）"""
    # 查询该 role 下的所有 jobs，带上 company 信息
    result = await db.execute(
        select(Job)
        .where(Job.role_id == role_id)
        .order_by(Job.created_at.desc())
    )
    jobs = result.scalars().all()

    response = []
    for job in jobs:
        # 获取 company 信息
        company_brief = None
        if job.company_id:
            company_result = await db.execute(
                select(Company).where(Company.id == job.company_id)
            )
            company = company_result.scalar_one_or_none()
            if company:
                company_brief = CompanyBrief(
                    id=company.id,
                    name=company.name,
                    industries=company.industries,
                    company_size=company.company_size,
                    company_stage=company.company_stage,
                )

        # 提取福利
        benefits = extract_benefits(job.description)

        response.append(JobWithCompanyResponse(
            id=job.id,
            title=job.title,
            role=job.role,
            role_id=job.role_id,
            city=job.city,
            district=job.district,
            salary_min=job.salary_min,
            salary_max=job.salary_max,
            salary_months=job.salary_months,
            description=job.description,
            published_at=job.published_at,
            source_url=job.source_url,
            company_id=job.company_id,
            company=company_brief,
            benefits=benefits,
        ))

    return response


# ========== Graph API (Job Category Tree) ==========


class JobGraphResponse(BaseModel):
    """Job graph response schema."""
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    generated_at: str


class RebuildGraphResponse(BaseModel):
    """Rebuild graph response schema."""
    status: str
    rebuilt_at: str
    node_count: int


@router.get("/graph", response_model=JobGraphResponse, tags=["job-graph"])
async def get_job_graph(db: AsyncSession = Depends(get_db)) -> JobGraphResponse:
    """获取岗位图谱数据。

    返回树形结构的图谱数据：
    - 根节点：职业图谱
    - 分类节点：7个大类（技术研发、销售商务、运营推广等）
    - 岗位节点：各分类下的岗位

    数据从缓存表读取，优先返回缓存数据。
    """
    # Try to get from cache first
    cached = await get_graph_cache(db)
    if cached:
        return JobGraphResponse(**cached)

    # Build and cache if not available
    result = await build_and_cache_graph(db)
    return JobGraphResponse(**result)


@router.post("/graph/rebuild", response_model=RebuildGraphResponse, tags=["job-graph"])
async def rebuild_job_graph(db: AsyncSession = Depends(get_db)) -> RebuildGraphResponse:
    """强制重建岗位图谱缓存。

    由以下场景调用：
    1. 前端「刷新图谱」按钮（手动）
    2. 新数据导入完成后，导入接口内部自动调用（程序调用）
    """
    result = await build_and_cache_graph(db)
    return RebuildGraphResponse(
        status="ok",
        rebuilt_at=result["generated_at"],
        node_count=len(result["nodes"]),
    )
