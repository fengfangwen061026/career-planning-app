"""Matching API routes - 人岗匹配接口."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
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


def _mr_to_response(mr) -> MatchResultResponse:
    """将 ORM MatchResult 转为 API 响应."""
    scores_json = mr.scores_json or {}
    gaps_json = mr.gaps_json or []
    reasons = scores_json.pop("match_reasons", []) if isinstance(scores_json, dict) else []

    return MatchResultResponse(
        id=mr.id,
        student_profile_id=mr.student_profile_id,
        job_profile_id=mr.job_profile_id,
        total_score=mr.total_score * 100,  # DB 存 0-1，API 返回 0-100
        scores=FourDimensionScores(**{k: v for k, v in scores_json.items() if k != "match_reasons"}) if scores_json else FourDimensionScores(),
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
    return _mr_to_response(mr)


# POST /api/matching/recommend/{student_id} - 返回 Top-N 推荐岗位
@router.post("/recommend/{student_id}", response_model=MatchingResponse)
async def recommend(
    student_id: UUID,
    request: RecommendRequest = RecommendRequest(),
    db: AsyncSession = Depends(get_db),
) -> MatchingResponse:
    """为学生推荐 Top-N 匹配岗位（按总分排序）."""
    try:
        results = await recommend_jobs(
            db, student_id, top_k=request.top_k, role_category=request.role_category,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return MatchingResponse(
        student_id=student_id,
        results=[_mr_to_response(mr) for mr in results],
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
    return _mr_to_response(mr)


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
        results=[_mr_to_response(mr) for mr in results],
    )
