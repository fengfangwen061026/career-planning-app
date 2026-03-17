"""Company and Role-Company related API routes."""
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, and_

from app.database import get_db
from app.models.job import Job, Role, Company
from app.schemas.job import (
    RoleCompanyItem,
    SalaryDistributionItem,
    CityDistributionItem,
    BenefitItem,
    PaginatedRoleCompaniesResponse,
    CompanyResponse,
    JobResponse,
)

router = APIRouter()


@router.get("/roles/{role_id}/companies")
async def get_role_companies(
    role_id: UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    sort_by: str = Query("job_count", description="Sort by: job_count, salary, company_size"),
    industry: str | None = Query(None, description="Industry filter"),
    company_size: str | None = Query(None, description="Company size filter"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """获取指定 Role 关联的公司列表."""
    # 验证 role 存在
    role = await db.get(Role, role_id)
    if not role:
        return {"items": [], "total": 0, "page": 1, "page_size": page_size, "total_pages": 0}

    offset = (page - 1) * page_size

    # 构建基础查询 - 获取每个公司在该 role 下的统计
    base_filter = [Job.role_id == role_id, Job.company_id.isnot(None)]

    # 获取总数
    count_query = (
        select(func.count(func.distinct(Job.company_id)))
        .where(and_(*base_filter))
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # 子查询：统计每个公司在该 role 下的岗位数和薪资
    subq = (
        select(
            Job.company_id,
            func.count(Job.id).label("job_count"),
            func.min(Job.salary_min).label("min_salary"),
            func.max(Job.salary_max).label("max_salary"),
            func.array_agg(func.distinct(Job.city)).label("cities"),
        )
        .where(and_(*base_filter))
        .group_by(Job.company_id)
        .subquery()
    )

    # 主查询
    query = (
        select(
            Company,
            subq.c.job_count,
            subq.c.min_salary,
            subq.c.max_salary,
            subq.c.cities,
        )
        .join(subq, Company.id == subq.c.company_id)
    )

    # 筛选条件
    if industry:
        query = query.where(Company.industries.ilike(f"%{industry}%"))
    if company_size:
        query = query.where(Company.company_size == company_size)

    # 排序
    if sort_by == "salary":
        query = query.order_by(subq.c.max_salary.desc())
    elif sort_by == "company_size":
        query = query.order_by(Company.company_size)
    else:
        query = query.order_by(subq.c.job_count.desc())

    # 分页
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    rows = result.all()

    # 构建响应
    items = []
    for row in rows:
        company, job_count, min_sal, max_sal, cities = row

        # 计算薪资范围
        salary_range = None
        if min_sal and max_sal:
            min_k = min_sal // 1000
            max_k = max_sal // 1000
            salary_range = f"{min_k}K-{max_k}K"
        elif company.avg_salary_min and company.avg_salary_max:
            min_k = company.avg_salary_min // 1000
            max_k = company.avg_salary_max // 1000
            salary_range = f"{min_k}K-{max_k}K"

        items.append({
            "id": company.id,
            "name": company.name,
            "industries": company.industries,
            "company_size": company.company_size,
            "company_stage": company.company_stage,
            "intro": company.intro,
            "job_count": job_count,
            "avg_salary_min": company.avg_salary_min,
            "avg_salary_max": company.avg_salary_max,
            "salary_range": salary_range,
            "cities": cities or [],
            "created_at": company.created_at,
            "updated_at": company.updated_at,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.get("/roles/{role_id}/salary-distribution")
async def get_salary_distribution(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """获取指定 Role 的薪资分布."""
    role = await db.get(Role, role_id)
    if not role:
        return []

    result = await db.execute(
        select(Job.salary_min, Job.salary_max)
        .where(Job.role_id == role_id, Job.salary_min > 0)
    )
    rows = result.all()

    # 薪资区间统计
    buckets = {"3K以下": 0, "3-5K": 0, "5-8K": 0, "8-12K": 0, "12-20K": 0, "20K以上": 0}

    for row in rows:
        avg_sal = ((row.salary_min or 0) + (row.salary_max or 0)) // 2

        if avg_sal < 3000:
            buckets["3K以下"] += 1
        elif avg_sal < 5000:
            buckets["3-5K"] += 1
        elif avg_sal < 8000:
            buckets["5-8K"] += 1
        elif avg_sal < 12000:
            buckets["8-12K"] += 1
        elif avg_sal < 20000:
            buckets["12-20K"] += 1
        else:
            buckets["20K以上"] += 1

    return [{"range": k, "count": v} for k, v in buckets.items() if v > 0]


@router.get("/roles/{role_id}/city-distribution")
async def get_city_distribution(
    role_id: UUID,
    limit: int = Query(15, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """获取指定 Role 的城市分布."""
    role = await db.get(Role, role_id)
    if not role:
        return []

    # 按城市聚合
    result = await db.execute(
        select(
            Job.city,
            func.count(Job.id).label("job_count"),
            func.avg(Job.salary_min).label("avg_min"),
            func.avg(Job.salary_max).label("avg_max"),
        )
        .where(Job.role_id == role_id)
        .group_by(Job.city)
        .order_by(func.count(Job.id).desc())
        .limit(limit)
    )
    rows = result.all()

    items = []
    for row in rows:
        # 获取该城市该 role 的 Top 公司
        company_result = await db.execute(
            select(Company.name)
            .join(Job, Job.company_id == Company.id)
            .where(Job.role_id == role_id, Job.city == row.city)
            .group_by(Company.id, Company.name)
            .order_by(func.count(Job.id).desc())
            .limit(3)
        )
        top_companies = [r[0] for r in company_result.fetchall()]

        items.append({
            "city": row.city,
            "count": row.job_count,
            "avg_salary_min": int(row.avg_min) if row.avg_min else None,
            "avg_salary_max": int(row.avg_max) if row.avg_max else None,
            "top_companies": top_companies,
        })

    return items


@router.get("/roles/{role_id}/benefits-stats")
async def get_benefits_stats(
    role_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """获取指定 Role 的福利统计."""
    from collections import Counter

    role = await db.get(Role, role_id)
    if not role:
        return []

    # 获取所有该 role 的 JD 描述
    result = await db.execute(
        select(Job.description)
        .where(Job.role_id == role_id, Job.description.isnot(None))
    )
    descriptions = [row[0] for row in result.fetchall() if row[0]]

    # 福利关键词
    benefit_keywords = [
        "五险一金", "六险一金", "社保公积金", "带薪年假", "弹性工作",
        "周末双休", "定期体检", "年终奖", "股票期权", "餐补",
        "交通补贴", "通讯补贴", "住房补贴", "节日福利", "生日福利",
        "下午茶", "团建活动", "培训机会", "晋升空间", "扁平管理",
    ]

    # 统计频次
    benefit_counts: Counter = Counter()

    for desc in descriptions:
        for benefit in benefit_keywords:
            if benefit in desc:
                benefit_counts[benefit] += 1

    # 按频次排序
    sorted_benefits = sorted(benefit_counts.items(), key=lambda x: -x[1])

    return [{"name": name, "frequency": count} for name, count in sorted_benefits[:15]]


@router.get("/companies/{company_id}/roles/{role_id}/jobs")
async def get_company_role_jobs(
    company_id: UUID,
    role_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """获取某公司某 role 下的具体岗位列表."""
    offset = (page - 1) * page_size

    result = await db.execute(
        select(Job)
        .where(Job.company_id == company_id, Job.role_id == role_id)
        .order_by(Job.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    jobs = result.scalars().all()

    # 获取总数
    count_result = await db.execute(
        select(func.count(Job.id))
        .where(Job.company_id == company_id, Job.role_id == role_id)
    )
    total = count_result.scalar() or 0

    return {
        "items": [JobResponse.model_validate(j) for j in jobs],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.get("/companies/{company_id}")
async def get_company(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict | None:
    """获取公司详情."""
    company = await db.get(Company, company_id)
    if not company:
        return None

    return CompanyResponse.model_validate(company)


@router.get("/companies")
async def list_companies(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    industry: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """获取公司列表."""
    offset = (page - 1) * page_size

    query = select(Company).order_by(Company.job_count.desc()).offset(offset).limit(page_size)
    if industry:
        query = query.where(Company.industries.ilike(f"%{industry}%"))

    result = await db.execute(query)
    companies = result.scalars().all()

    count_query = select(func.count(Company.id))
    if industry:
        count_query = count_query.where(Company.industries.ilike(f"%{industry}%"))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return {
        "items": [CompanyResponse.model_validate(c) for c in companies],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }
