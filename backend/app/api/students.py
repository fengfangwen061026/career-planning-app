"""Students API routes."""

import asyncio
import json as json_lib
import logging
import shutil
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.student import Resume, Student, StudentProfile
from app.schemas.profiles import ResumeParseResult
from app.schemas.student import (
    ProfileGenerateRequest,
    ResumeResponse,
    StudentCreate,
    StudentProfileResponse,
    StudentProfileUpdate,
    StudentResponse,
    StudentUpdate,
)
from app.services.resume_parser import (
    _calculate_completeness,
    _cheap_resume_fallback,
    _generate_suggestions,
    is_fallback_result,
    parse_resume,
    parse_resume_text,
    resume_parser_service,
    update_student_basic_info,
)
from app.services.student_profile import (
    generate_student_profile,
    update_student_profile,
)
from app.utils.evidence_filler import fill_parse_result_evidence
from app.utils.file_extractor import extract_text

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(
    student: StudentCreate,
    db: AsyncSession = Depends(get_db),
) -> StudentResponse:
    """Create a new student."""
    existing = await db.execute(select(Student).where(Student.email == student.email))
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Student with email '{student.email}' already exists",
        )

    db_student = Student(
        email=student.email,
        name=student.name,
        phone=student.phone,
    )
    db.add(db_student)
    await db.flush()
    await db.refresh(db_student)
    return StudentResponse.model_validate(db_student)


@router.get("/", response_model=list[StudentResponse])
async def list_students(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
) -> list[StudentResponse]:
    """List all students."""
    result = await db.execute(
        select(Student).offset(skip).limit(limit).order_by(Student.created_at.desc())
    )
    students = result.scalars().all()
    return [StudentResponse.model_validate(student) for student in students]


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> StudentResponse:
    """Get a student by ID."""
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return StudentResponse.model_validate(student)


@router.patch("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: UUID,
    student: StudentUpdate,
    db: AsyncSession = Depends(get_db),
) -> StudentResponse:
    """Update a student."""
    db_student = await db.get(Student, student_id)
    if not db_student:
        raise HTTPException(status_code=404, detail="Student not found")

    update_data = student.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_student, field, value)

    await db.flush()
    await db.refresh(db_student)
    return StudentResponse.model_validate(db_student)


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a student."""
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    await db.delete(student)
    await db.flush()


@router.post("/{student_id}/upload-resume", status_code=status.HTTP_201_CREATED)
async def upload_resume(
    student_id: UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Upload a resume file, parse it, and return structured results."""
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".pdf", ".docx", ".doc"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {suffix}. Only PDF and DOCX are supported.",
        )

    upload_dir = Path(settings.upload_dir) / str(student_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / file.filename

    with open(file_path, "wb") as target:
        shutil.copyfileobj(file.file, target)

    try:
        with open(file_path, "rb") as source:
            file_content = source.read()
        raw_text, _ = extract_text(file_content, file.filename)
    except Exception:
        raw_text = ""

    resume = Resume(
        student_id=student_id,
        filename=file.filename,
        file_path=str(file_path),
        file_type=suffix.lstrip("."),
        raw_text=raw_text,
        is_primary=True,
    )
    db.add(resume)
    await db.flush()
    await db.refresh(resume)

    if raw_text:
        parse_result = await parse_resume_text(raw_text)
        parsed_dict = fill_parse_result_evidence(parse_result.model_dump(mode="json"), raw_text)
        parse_result = ResumeParseResult.model_validate(parsed_dict)
        resume.parsed_json = parsed_dict
    else:
        parse_result = ResumeParseResult(
            raw_text="",
            parse_confidence=0.0,
            missing_fields=["文本提取失败"],
        )

    try:
        await update_student_basic_info(student_id, parse_result.model_dump(), db)
    except Exception as exc:
        logging.getLogger(__name__).warning("Update basic info failed: %s", exc)

    return {
        "resume": {
            "id": str(resume.id),
            "student_id": str(resume.student_id),
            "filename": resume.filename,
            "file_type": resume.file_type,
            "is_primary": resume.is_primary,
            "created_at": resume.created_at.isoformat() if resume.created_at else None,
        },
        "parsed_data": parse_result.model_dump(mode="json"),
        "completeness_score": _calculate_completeness(parse_result),
        "missing_suggestions": _generate_suggestions(parse_result),
        "normalization_log": [],
        "parse_meta": {
            "status": "fallback_final" if is_fallback_result(parse_result) else "ai_success",
            "is_fallback": is_fallback_result(parse_result),
            "retrying": False,
        },
    }


@router.post("/{student_id}/upload-resume/stream")
async def upload_resume_stream(
    student_id: UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """SSE resume upload endpoint with fallback preview and AI retry."""
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".pdf", ".docx", ".doc"):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")

    file_content = await file.read()
    if len(file_content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    filename = file.filename

    async def event_generator():
        logger_inner = logger
        retry_count = 0
        final_status = "started"

        def sse(data: dict) -> str:
            return f"data: {json_lib.dumps(data, ensure_ascii=False)}\n\n"

        def log_stream_event(stage: str, *, is_fallback: bool, detail: str = "") -> None:
            logger_inner.info(
                "Resume stream upload: filename=%s stage=%s is_fallback=%s retry_count=%d final_status=%s detail=%s",
                filename,
                stage,
                is_fallback,
                retry_count,
                final_status,
                detail,
            )

        log_stream_event("extracting_started", is_fallback=False)
        yield sse({"type": "stage", "stage": "extracting", "progress": 10})

        try:
            raw_text, _ = await asyncio.to_thread(extract_text, file_content, filename)
        except Exception as exc:
            yield sse({"type": "error", "message": f"文本提取失败: {exc}"})
            return

        final_status = "extract_ok"
        log_stream_event("extracting_completed", is_fallback=False, detail=f"text_len={len(raw_text)}")
        yield sse({"type": "stage", "stage": "parsing", "progress": 30})

        try:
            parse_result = await resume_parser_service._llm_parse_resume_text(raw_text)
            final_status = "ai_success"
            log_stream_event("ai_parse_success", is_fallback=False)
        except Exception as first_error:
            retry_count = 1
            final_status = "fallback_retrying"
            logger_inner.warning("Primary AI parse failed, switching to fallback + retry: %s", first_error)
            log_stream_event("ai_parse_failed", is_fallback=True, detail=str(first_error))
            fallback_result = _cheap_resume_fallback(raw_text, str(first_error))
            fallback_dict = fill_parse_result_evidence(fallback_result.model_dump(mode="json"), raw_text)
            fallback_validated = ResumeParseResult.model_validate(fallback_dict)

            yield sse({
                "type": "fallback",
                "progress": 72,
                "message": "AI解析失败，正在自动重试，当前先展示兜底结果",
                "data": {
                    "parsed_data": fallback_dict,
                    "completeness_score": _calculate_completeness(fallback_validated),
                    "missing_suggestions": _generate_suggestions(fallback_validated),
                    "normalization_log": [],
                    "parse_meta": {
                        "status": "fallback_retrying",
                        "is_fallback": True,
                        "retrying": True,
                    },
                },
            })
            yield sse({
                "type": "retrying",
                "stage": "retrying",
                "progress": 84,
                "message": "AI解析失败，正在重试",
            })

            log_stream_event("fallback_preview_emitted", is_fallback=True)
            log_stream_event("retrying_started", is_fallback=True)
            try:
                parse_result = await resume_parser_service._llm_parse_resume_text(raw_text)
                final_status = "ai_success_after_retry"
                log_stream_event("ai_retry_success", is_fallback=False)
            except Exception as retry_error:
                logger_inner.warning("AI retry failed, keeping fallback result: %s", retry_error)
                final_status = "fallback_final"
                log_stream_event("ai_retry_failed", is_fallback=True, detail=str(retry_error))
                parse_result = fallback_validated

        parsed_dict = fill_parse_result_evidence(parse_result.model_dump(mode="json"), raw_text)
        parsed_result = ResumeParseResult.model_validate(parsed_dict)
        is_final_fallback = is_fallback_result(parsed_result)
        parse_meta_status = (
            "fallback_final"
            if is_final_fallback
            else ("ai_success_after_retry" if retry_count else "ai_success")
        )
        final_status = parse_meta_status

        try:
            upload_dir = Path(settings.upload_dir) / str(student_id)
            upload_dir.mkdir(parents=True, exist_ok=True)
            file_path = upload_dir / filename
            with open(file_path, "wb") as target:
                target.write(file_content)

            resume = Resume(
                student_id=student_id,
                filename=filename,
                file_path=str(file_path),
                file_type=suffix.lstrip("."),
                raw_text=raw_text,
                parsed_json=parsed_dict,
                is_primary=True,
            )
            db.add(resume)
            await db.flush()
            await db.refresh(resume)
            try:
                await update_student_basic_info(student_id, parsed_dict, db)
            except Exception as exc:
                logger_inner.warning("Update basic info failed during stream upload: %s", exc)
            await db.commit()
        except Exception as exc:
            logger_inner.error("DB save failed: %s", exc)
            final_status = "save_error"
            log_stream_event("db_save_failed", is_fallback=is_final_fallback, detail=str(exc))
            yield sse({"type": "error", "message": "保存失败，请重试"})
            return

        log_stream_event("complete_emitted", is_fallback=is_final_fallback)
        yield sse({
            "type": "complete",
            "progress": 100,
            "data": {
                "resume": {
                    "id": str(resume.id),
                    "student_id": str(resume.student_id),
                    "filename": resume.filename,
                    "file_type": resume.file_type,
                    "is_primary": resume.is_primary,
                    "created_at": resume.created_at.isoformat() if resume.created_at else None,
                },
                "parsed_data": parsed_dict,
                "completeness_score": _calculate_completeness(parsed_result),
                "missing_suggestions": _generate_suggestions(parsed_result),
                "normalization_log": [],
                "parse_meta": {
                    "status": parse_meta_status,
                    "is_fallback": is_final_fallback,
                    "retrying": False,
                },
            },
        })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{student_id}/resumes", response_model=list[ResumeResponse])
async def list_resumes(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[ResumeResponse]:
    """List all resumes for a student."""
    result = await db.execute(
        select(Resume)
        .where(Resume.student_id == student_id)
        .order_by(Resume.created_at.desc())
    )
    resumes = result.scalars().all()
    return [ResumeResponse.model_validate(resume) for resume in resumes]


@router.get("/{student_id}/resumes/{resume_id}", response_model=ResumeResponse)
async def get_resume(
    student_id: UUID,
    resume_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ResumeResponse:
    """Get a resume by ID."""
    resume = await db.get(Resume, resume_id)
    if not resume or resume.student_id != student_id:
        raise HTTPException(status_code=404, detail="Resume not found")
    return ResumeResponse.model_validate(resume)


@router.get("/{student_id}/profile", response_model=StudentProfileResponse)
async def get_student_profile(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> StudentProfileResponse:
    """Get student profile."""
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")

    response = StudentProfileResponse.model_validate(profile)
    evidence = profile.evidence_json or {}
    response.missing_suggestions = evidence.get("missing_suggestions")
    return response


@router.put("/{student_id}/profile", response_model=StudentProfileResponse)
async def put_student_profile(
    student_id: UUID,
    update: StudentProfileUpdate,
    db: AsyncSession = Depends(get_db),
) -> StudentProfileResponse:
    """Manually update or supplement a student profile."""
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if not update.profile_json:
        raise HTTPException(status_code=400, detail="profile_json is required")

    try:
        profile = await update_student_profile(student_id, update.profile_json, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return StudentProfileResponse.model_validate(profile)


@router.post("/{student_id}/profile/generate", response_model=StudentProfileResponse)
async def generate_profile(
    student_id: UUID,
    request: ProfileGenerateRequest,
    db: AsyncSession = Depends(get_db),
) -> StudentProfileResponse:
    """Generate student profile from a specific resume."""
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    resume = await db.get(Resume, request.resume_id)
    if not resume or resume.student_id != student_id:
        raise HTTPException(status_code=404, detail="Resume not found")

    if not resume.parsed_json:
        raise HTTPException(status_code=400, detail="Resume has not been parsed yet")

    try:
        result = await generate_student_profile(student_id, db, request.resume_id)
        profile = result["profile"]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    response = StudentProfileResponse.model_validate(profile)
    evidence = profile.evidence_json or {}
    response.missing_suggestions = evidence.get("missing_suggestions")
    return response
