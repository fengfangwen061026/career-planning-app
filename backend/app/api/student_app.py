"""Student-facing mobile app APIs."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.student import StudentProfile
from app.schemas.student import StudentProfileResponse, StudentResponse
from app.schemas.student_app import (
    CareerPathResponse,
    ProfileCompletionApplyRequest,
    ProfileCompletionApplyResponse,
    ProfileCompletionSessionResponse,
    StudentRecommendationResponse,
    StudentSessionRequest,
    StudentSessionResponse,
)
from app.services.profile_completion import apply_profile_completion, build_completion_questions
from app.services.student_portal import (
    build_student_career_path,
    build_student_recommendations,
    upsert_student_session,
)

router = APIRouter()


@router.post("/session", response_model=StudentSessionResponse)
async def create_student_session(
    request: StudentSessionRequest,
    db: AsyncSession = Depends(get_db),
) -> StudentSessionResponse:
    """Create or resume a lightweight student session."""

    try:
        student, created = await upsert_student_session(
            email=request.email,
            phone=request.phone,
            name=request.name,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student.id)
    )
    has_profile = profile_result.scalars().first() is not None

    return StudentSessionResponse(
        student=StudentResponse.model_validate(student),
        created=created,
        has_profile=has_profile,
    )


@router.get("/students/{student_id}/recommendations", response_model=StudentRecommendationResponse)
async def get_student_recommendations(
    student_id: UUID,
    top_k: int = Query(default=10, ge=1, le=20),
    role_category: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> StudentRecommendationResponse:
    """Return aggregated recommendation cards for the student mobile app."""

    try:
        results = await build_student_recommendations(
            student_id,
            top_k=top_k,
            role_category=role_category,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    return StudentRecommendationResponse(student_id=student_id, results=results)


@router.get("/students/{student_id}/career-path", response_model=CareerPathResponse)
async def get_student_career_path(
    student_id: UUID,
    job_profile_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
) -> CareerPathResponse:
    """Return student-facing career path data for one job profile."""

    try:
        payload = await build_student_career_path(student_id, job_profile_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    return CareerPathResponse(**payload)


@router.post(
    "/students/{student_id}/profile-completion/session",
    response_model=ProfileCompletionSessionResponse,
)
async def create_profile_completion_session(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ProfileCompletionSessionResponse:
    """Create a structured profile-completion question set."""

    result = await db.execute(select(StudentProfile).where(StudentProfile.student_id == student_id))
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found")

    questions = build_completion_questions(profile)
    return ProfileCompletionSessionResponse(student_id=student_id, questions=questions)


@router.post(
    "/students/{student_id}/profile-completion/apply",
    response_model=ProfileCompletionApplyResponse,
)
async def apply_profile_completion_answers(
    student_id: UUID,
    request: ProfileCompletionApplyRequest,
    db: AsyncSession = Depends(get_db),
) -> ProfileCompletionApplyResponse:
    """Apply structured completion answers and persist them."""

    try:
        profile, applied_updates = await apply_profile_completion(
            student_id,
            [answer.model_dump() for answer in request.answers],
            db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    response = StudentProfileResponse.model_validate(profile)
    evidence = profile.evidence_json or {}
    response.missing_suggestions = evidence.get("missing_suggestions")
    return ProfileCompletionApplyResponse(profile=response, applied_updates=applied_updates)
