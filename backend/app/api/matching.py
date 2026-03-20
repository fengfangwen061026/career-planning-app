"""Matching API routes - 人岗匹配接口."""
import asyncio

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.job import Job, JobProfile, Role
from app.schemas.matching import (
    FourDimensionScores,
    GapItem,
    MatchingRequest,
    MatchingResponse,
    MatchResultResponse,
    RecommendRequest,
)
from app.services.matching import (
    get_match_result,
    get_student_matches,
    match_student_job,
    recommend_jobs,
)

router = APIRouter()


def _extract_benefits(description: str | None) -> list[str]:
    if not description:
        return []
    keywords = ["五险一金", "双休", "带薪年假", "餐补", "下午茶", "年终奖", "培训"]
    return [keyword for keyword in keywords if keyword in description][:4]


async def _build_job_snapshot(role_id: UUID | None, db: AsyncSession | None) -> dict | None:
    if not db or not role_id:
        return None

    result = await db.execute(
        select(Job)
        .where(Job.role_id == role_id)
        .order_by(Job.created_at.desc())
        .limit(1)
    )
    job = result.scalars().first()
    if not job:
        return None

    return {
        "title": job.title,
        "city": job.city,
        "company_name": job.company_name,
        "company_stage": job.company_stage,
        "industries": list(job.industries or []),
        "benefits": _extract_benefits(job.description),
    }


async def _mr_to_response(mr, db: AsyncSession = None) -> MatchResultResponse:
    """将 ORM MatchResult 转为 API 响应."""
    scores_json = dict(mr.scores_json or {}) if isinstance(mr.scores_json, dict) else {}
    gaps_json = mr.gaps_json or []
    reasons = list(scores_json.get("match_reasons") or [])
    job_info = scores_json.get("job_info") or {}

    # 获取job_profile的role_name
    role_name = None
    role_id = None
    role_category = None
    job_snapshot = None
    if db and mr.job_profile_id:
        result = await db.execute(
            select(JobProfile, Role)
            .join(Role, JobProfile.role_id == Role.id)
            .where(JobProfile.id == mr.job_profile_id)
        )
        jp_role = result.first()
        if jp_role:
            job_profile, role = jp_role
            role_id = job_profile.role_id if job_profile else None
            role_name = role.name if role else None
            role_category = role.category if role else None
            job_snapshot = await _build_job_snapshot(role_id, db)

    score_payload = {
        key: value
        for key, value in scores_json.items()
        if key not in {"match_reasons", "job_info"}
    }

    return MatchResultResponse(
        id=mr.id,
        student_profile_id=mr.student_profile_id,
        job_profile_id=mr.job_profile_id,
        role_id=role_id,
        role_category=role_category,
        job_title=job_info.get("title"),
        role_name=role_name,
        job_snapshot=job_snapshot,
        total_score=mr.total_score * 100,  # DB 存 0-1，API 返回 0-100
        scores=FourDimensionScores(**score_payload) if score_payload else FourDimensionScores(),
        gaps=[GapItem(**g) for g in gaps_json] if gaps_json else [],
        match_reasons=reasons,
        created_at=mr.created_at,
        updated_at=mr.updated_at,
    )


# POST /api/matching/match - 指定学生和目标岗位，返回四维评分+差距清单
@router.post("/match", response_model=MatchResultResponse)
async def run_match(
    request: MatchingRequest,
    db: AsyncSession = Depends(get_db),
) -> MatchResultResponse:
    """匹配指定学生与岗位画像，返回四维评分和差距清单."""
    try:
        mr = await match_student_job(db, request.student_id, request.job_profile_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return await _mr_to_response(mr, db)


# POST /api/matching/recommend/{student_id} - 返回 Top-N 推荐岗位
@router.post("/recommend/{student_id}", response_model=MatchingResponse)
async def recommend(
    student_id: UUID,
    request: RecommendRequest = RecommendRequest(),
    db: AsyncSession = Depends(get_db),
) -> MatchingResponse:
    """为学生推荐 Top-N 匹配岗位（按总分排序）."""
    try:
        results = await asyncio.wait_for(
            recommend_jobs(
                db, student_id, top_k=request.top_k, role_category=request.role_category,
            ),
            timeout=120.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="匹配超时，请稍后重试")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return MatchingResponse(
        student_id=student_id,
        results=[await _mr_to_response(mr, db) for mr in results],
    )


# GET /api/matching/result/{id} - 查看匹配详情
@router.get("/result/{match_id}", response_model=MatchResultResponse)
async def get_result(
    match_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> MatchResultResponse:
    """查看匹配详情."""
    mr = await get_match_result(db, match_id)
    if mr is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match result not found")
    return await _mr_to_response(mr, db)


# GET /api/matching/student/{student_id} - 查看学生所有匹配
@router.get("/student/{student_id}", response_model=MatchingResponse)
async def list_student_matches(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> MatchingResponse:
    """查看学生所有匹配结果."""
    results = await get_student_matches(db, student_id)
    return MatchingResponse(
        student_id=student_id,
        results=[await _mr_to_response(mr, db) for mr in results],
    )
