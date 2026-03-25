"""Students API routes."""

import asyncio
import json as json_lib
import logging
import shutil
import time
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
    StudentProfileBatchRequest,
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

    # Sanitize filename to prevent path traversal attacks
    safe_filename = Path(file.filename).name
    if not safe_filename or safe_filename.startswith("."):
        safe_filename = f"resume_{int(time.time())}{suffix}"

    upload_dir = Path(settings.upload_dir) / str(student_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / safe_filename

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


# Semaphore for limiting concurrent resume parsing
_PARSE_SEMAPHORE = asyncio.Semaphore(5)


async def _parse_single_resume(
    student_id: UUID,
    file: UploadFile,
    db: AsyncSession,
) -> dict:
    """Parse a single resume file and return result."""
    safe_filename = Path(file.filename).name if file.filename else f"resume_{int(time.time())}"
    suffix = Path(safe_filename).suffix.lower()
    if suffix not in (".pdf", ".docx", ".doc"):
        return {
            "filename": safe_filename,
            "success": False,
            "error": f"Unsupported file type: {suffix}",
        }

    upload_dir = Path(settings.upload_dir) / str(student_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / safe_filename

    try:
        with open(file_path, "wb") as target:
            shutil.copyfileobj(file.file, target)

        with open(file_path, "rb") as source:
            file_content = source.read()
        raw_text, _ = extract_text(file_content, safe_filename)
    except Exception as exc:
        return {
            "filename": safe_filename,
            "success": False,
            "error": f"File processing failed: {str(exc)}",
        }

    if not raw_text:
        return {
            "filename": safe_filename,
            "success": False,
            "error": "Failed to extract text from file",
        }

    parse_result = await parse_resume_text(raw_text)
    parsed_dict = fill_parse_result_evidence(parse_result.model_dump(mode="json"), raw_text)
    validated = ResumeParseResult.model_validate(parsed_dict)

    resume = Resume(
        student_id=student_id,
        filename=safe_filename,
        file_path=str(file_path),
        file_type=suffix.lstrip("."),
        raw_text=raw_text,
        parsed_json=validated.model_dump(mode="json"),
        is_primary=False,
    )
    db.add(resume)
    await db.flush()
    await db.refresh(resume)

    try:
        await update_student_basic_info(student_id, validated.model_dump(), db)
    except Exception:
        pass  # Non-critical

    return {
        "resume_id": str(resume.id),
        "filename": resume.filename,
        "success": True,
        "parsed_data": validated.model_dump(mode="json"),
        "completeness_score": _calculate_completeness(validated),
    }


@router.post("/batch-parse", status_code=status.HTTP_201_CREATED)
async def batch_parse_resumes(
    files: list[UploadFile],
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Parse multiple resume files in parallel (max 5 concurrent).

    Each file is uploaded, parsed, and returned with structured results.
    Use this endpoint for bulk resume processing.
    """
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files per batch")

    async def sem_parse(file: UploadFile) -> dict:
        async with _PARSE_SEMAPHORE:
            return await _parse_single_resume(student_id, file, db)

    tasks = [sem_parse(f) for f in files]
    results = await asyncio.gather(*tasks)

    await db.commit()

    successes = [r for r in results if r.get("success")]
    failures = [r for r in results if not r.get("success")]

    return {
        "total": len(files),
        "successes": len(successes),
        "failures": len(failures),
        "results": results,
    }


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


@router.post("/profiles/batch", response_model=dict[str, list[StudentProfileResponse | None]])
async def batch_get_student_profiles(
    request: StudentProfileBatchRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, list[StudentProfileResponse | None]]:
    """Batch get student profiles by student IDs."""
    profiles = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id.in_(request.student_ids))
    )
    profile_map = {str(p.student_id): p for p in profiles.scalars().all()}

    result: list[StudentProfileResponse | None] = []
    for student_id in request.student_ids:
        profile = profile_map.get(student_id)
        if profile:
            response = StudentProfileResponse.model_validate(profile)
            evidence = profile.evidence_json or {}
            response.missing_suggestions = evidence.get("missing_suggestions")
            result.append(response)
        else:
            result.append(None)

    return {"profiles": result}


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


# ====== 画像手动编辑相关 ======

from pydantic import BaseModel
from typing import Optional, List


class ManualProfileInput(BaseModel):
    """手动录入/编辑学生画像"""
    name: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    education: Optional[List[dict]] = None  # [{"school": "", "major": "", "degree": "", "start": "", "end": ""}]
    skills: Optional[List[dict]] = None  # [{"name": "Python", "category": "编程语言", "proficiency": "熟练"}]
    projects: Optional[List[dict]] = None  # [{"name": "", "role": "", "description": "", "tech_stack": [], "achievements": []}]
    internships: Optional[List[dict]] = None  # [{"company": "", "position": "", "start": "", "end": "", "description": ""}]
    certificates: Optional[List[str]] = None
    awards: Optional[List[str]] = None
    self_evaluation: Optional[str] = None
    career_intention: Optional[dict] = None  # {"target_roles": [], "target_cities": [], "salary_expectation": ""}


class ProfilePatchItem(BaseModel):
    """单个字段更新"""
    field: str  # 字段路径，如 "skills", "education", "career_intention.target_roles"
    value: object  # 新值


@router.post("/{student_id}/profile/manual")
async def create_or_update_profile_manual(
    student_id: UUID,
    data: ManualProfileInput,
    db: AsyncSession = Depends(get_db),
):
    """
    手动创建或更新学生画像。
    如果 student_id 对应的画像不存在，创建新画像。
    如果已存在，合并更新非 None 字段。
    """
    # 查询已有画像
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    profile = result.scalar_one_or_none()

    input_data = data.model_dump(exclude_none=True)

    if profile is None:
        # 创建新画像
        profile = StudentProfile(
            student_id=student_id,
            profile_json=input_data,
            completeness_score=0.0,
        )
        db.add(profile)
    else:
        # 合并更新
        existing_data = profile.profile_json or {}

        for key, value in input_data.items():
            if isinstance(value, list) and isinstance(existing_data.get(key), list):
                # 列表类型：直接覆盖（用户手动编辑应以最新为准）
                existing_data[key] = value
            else:
                existing_data[key] = value

        profile.profile_json = existing_data

    # 计算完整度评分
    completeness = _calc_completeness(profile.profile_json or {})
    profile.completeness_score = completeness

    await db.commit()
    await db.refresh(profile)

    # 计算竞争力评分
    competitiveness = _calc_competitiveness(profile.profile_json or {})

    return {
        "student_id": str(student_id),
        "profile_json": profile.profile_json,
        "completeness_score": completeness,
        "competitiveness_score": competitiveness,
        "message": "画像更新成功",
    }


@router.patch("/{student_id}/profile/field")
async def patch_profile_field(
    student_id: UUID,
    patch: ProfilePatchItem,
    db: AsyncSession = Depends(get_db),
):
    """更新画像的单个字段（用于移动端逐项编辑）"""
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "学生画像不存在")

    data = profile.profile_json or {}

    # 支持嵌套字段路径，如 "career_intention.target_roles"
    keys = patch.field.split(".")
    target = data
    for key in keys[:-1]:
        if key not in target:
            target[key] = {}
        target = target[key]
    target[keys[-1]] = patch.value

    profile.profile_json = data

    # 重新计算完整度
    completeness = _calc_completeness(data)
    profile.completeness_score = completeness

    await db.commit()

    return {"field": patch.field, "updated": True, "completeness_score": completeness}


def _calc_completeness(profile_data: dict) -> float:
    """计算画像完整度（0-100）"""
    if not profile_data:
        return 0.0

    weights = {
        "name": 5,
        "education": 15,
        "skills": 20,
        "projects": 20,
        "internships": 15,
        "certificates": 5,
        "self_evaluation": 5,
        "career_intention": 15,
    }

    score = 0
    for field, weight in weights.items():
        val = profile_data.get(field)
        if val:
            if isinstance(val, list) and len(val) > 0:
                score += weight
            elif isinstance(val, dict) and any(val.values()):
                score += weight
            elif isinstance(val, str) and len(val) > 0:
                score += weight

    return round(score, 1)


def _calc_competitiveness(profile_data: dict) -> float:
    """计算竞争力评分（0-100）"""
    if not profile_data:
        return 0.0

    score = 30  # 基础分

    skills = profile_data.get("skills", [])
    score += min(len(skills) * 3, 20)  # 技能数量，最多+20

    projects = profile_data.get("projects", [])
    score += min(len(projects) * 5, 15)  # 项目数量，最多+15

    internships = profile_data.get("internships", [])
    score += min(len(internships) * 8, 16)  # 实习数量，最多+16

    certs = profile_data.get("certificates", [])
    score += min(len(certs) * 3, 9)  # 证书，最多+9

    awards = profile_data.get("awards", [])
    score += min(len(awards) * 5, 10)  # 奖项，最多+10

    return round(min(score, 100), 1)
