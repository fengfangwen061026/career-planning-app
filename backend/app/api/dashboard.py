"""Dashboard API routes."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.job import Job, JobProfile
from app.models.matching import MatchResult
from app.models.report import CareerReport
from app.models.student import StudentProfile


class DashboardStatsResponse(BaseModel):
    """Dashboard statistics response."""
    job_count: int
    student_count: int
    report_count: int
    avg_match_score: float


router = APIRouter()


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)) -> DashboardStatsResponse:
    """Get dashboard statistics."""
    # Count raw job postings (JD总数)
    job_count = await db.scalar(select(func.count()).select_from(Job))

    # Count student profiles (generated学生画像)
    student_count = await db.scalar(select(func.count()).select_from(StudentProfile))

    # Count career reports
    report_count = await db.scalar(select(func.count()).select_from(CareerReport))

    # Average match score
    avg_score_result = await db.scalar(
        select(func.avg(MatchResult.total_score)).select_from(MatchResult)
    )
    avg_score = round(float(avg_score_result or 0) * 100, 1)

    return DashboardStatsResponse(
        job_count=job_count or 0,
        student_count=student_count or 0,
        report_count=report_count or 0,
        avg_match_score=avg_score,
    )
