"""Student-facing mobile portal service helpers."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job, JobProfile, Role
from app.models.student import Student, StudentProfile
from app.schemas.matching import FourDimensionScores, GapItem
from app.schemas.student_app import JobSnapshot, StudentRecommendationItem
from app.services import graph as graph_service
from app.services.matching import recommend_jobs


BENEFIT_KEYWORDS = [
    "五险一金",
    "双休",
    "带薪年假",
    "餐补",
    "下午茶",
    "年终奖",
    "培训",
]


def _extract_benefits(description: str | None) -> list[str]:
    if not description:
        return []
    return [keyword for keyword in BENEFIT_KEYWORDS if keyword in description][:4]


def _resolve_existing_student(
    email_student: Student | None,
    phone_student: Student | None,
) -> Student | None:
    """Resolve one existing student from email/phone matches."""

    if email_student and phone_student and email_student.id != phone_student.id:
        raise ValueError("email and phone belong to different student records")

    return email_student or phone_student


async def upsert_student_session(
    *,
    email: str | None,
    phone: str | None,
    name: str | None,
    db: AsyncSession,
) -> tuple[Student, bool]:
    """Find or create a lightweight student session."""

    normalized_email = (email or "").strip().lower() or None
    normalized_phone = (phone or "").strip() or None
    normalized_name = (name or "").strip() or None

    if not normalized_email and not normalized_phone:
        raise ValueError("email or phone is required")

    email_student = None
    if normalized_email:
        email_result = await db.execute(
            select(Student).where(Student.email == normalized_email)
        )
        email_student = email_result.scalars().first()

    phone_student = None
    if normalized_phone:
        phone_result = await db.execute(
            select(Student).where(Student.phone == normalized_phone)
        )
        phone_matches = list(phone_result.scalars().all())
        if len(phone_matches) > 1:
            raise ValueError("phone matches multiple student records")
        phone_student = phone_matches[0] if phone_matches else None

    student = _resolve_existing_student(email_student, phone_student)
    created = False

    if student:
        if normalized_name and not student.name:
            student.name = normalized_name
        if normalized_phone and not student.phone:
            student.phone = normalized_phone
        if normalized_email and student.email.endswith("@student.local"):
            student.email = normalized_email
    else:
        created = True
        fallback_email = normalized_email or f"phone_{normalized_phone}@student.local"
        student = Student(
            email=fallback_email,
            phone=normalized_phone,
            name=normalized_name or ("同学" if normalized_phone else None),
        )
        db.add(student)
        await db.flush()
        await db.refresh(student)

    await db.flush()
    await db.refresh(student)
    return student, created


async def load_job_snapshot_for_role(role_id: UUID, db: AsyncSession) -> JobSnapshot | None:
    """Load one representative job snapshot for a role."""

    result = await db.execute(
        select(Job)
        .where(Job.role_id == role_id)
        .order_by(Job.created_at.desc())
        .limit(1)
    )
    job = result.scalars().first()
    if not job:
        return None

    return JobSnapshot(
        title=job.title,
        city=job.city,
        company_name=job.company_name,
        company_stage=job.company_stage,
        industries=list(job.industries or []),
        benefits=_extract_benefits(job.description),
    )


async def build_student_recommendations(
    student_id: UUID,
    *,
    top_k: int,
    role_category: str | None,
    db: AsyncSession,
) -> list[StudentRecommendationItem]:
    """Build aggregated student recommendation cards."""

    results = await recommend_jobs(db, student_id, top_k=top_k, role_category=role_category)
    items: list[StudentRecommendationItem] = []
    role_cache: dict[UUID, Role | None] = {}
    snapshot_cache: dict[UUID, JobSnapshot | None] = {}

    for match_result in results:
        job_profile = await db.get(JobProfile, match_result.job_profile_id)
        role = None
        role_id = None
        if job_profile:
            role_id = job_profile.role_id
            if role_id not in role_cache:
                role_cache[role_id] = await db.get(Role, role_id)
            role = role_cache[role_id]
            if role_id not in snapshot_cache:
                snapshot_cache[role_id] = await load_job_snapshot_for_role(role_id, db)

        scores_json = match_result.scores_json or {}
        score_payload = {
            key: value
            for key, value in scores_json.items()
            if key not in {"match_reasons", "job_info"}
        }
        gap_items = [GapItem(**item) for item in (match_result.gaps_json or [])]

        items.append(
            StudentRecommendationItem(
                id=match_result.id,
                job_profile_id=match_result.job_profile_id,
                role_id=role_id,
                role_name=role.name if role else None,
                role_category=role.category if role else None,
                total_score=round(match_result.total_score * 100, 2),
                scores=FourDimensionScores(**score_payload) if score_payload else FourDimensionScores(),
                gaps=gap_items,
                match_reasons=list(scores_json.get("match_reasons") or []),
                job_snapshot=snapshot_cache.get(role_id) if role_id else None,
                created_at=match_result.created_at,
                updated_at=match_result.updated_at,
            )
        )

    return items


async def build_student_career_path(
    student_id: UUID,
    job_profile_id: UUID,
    db: AsyncSession,
) -> dict[str, Any]:
    """Build student-facing career path payload for one job profile."""

    student_profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    student_profile = student_profile_result.scalars().first()
    if not student_profile:
        raise ValueError("Student profile not found")

    job_profile = await db.get(JobProfile, job_profile_id)
    if not job_profile:
        raise ValueError("Job profile not found")

    role = await db.get(Role, job_profile.role_id)
    if not role:
        raise ValueError("Role not found")

    path = await graph_service.find_path_with_student_profile(
        db,
        student_profile.profile_json or {},
        role.name,
        "expert",
    )
    return {
        "student_id": student_id,
        "job_profile_id": job_profile_id,
        "role_id": role.id,
        "role_name": role.name,
        "role_category": role.category,
        "path": path,
    }
