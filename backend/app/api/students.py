"""Students API routes."""

import logging
import os
import shutil
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.student import Resume, Student, StudentProfile
from app.schemas.student import (
    ProfileGenerateRequest,
    ResumeResponse,
    ResumeUploadResponse,
    StudentCreate,
    StudentProfileResponse,
    StudentProfileUpdate,
    StudentResponse,
    StudentUpdate,
)
from app.services.resume_parser import parse_resume, parse_resume_text, update_student_basic_info
from app.utils.file_extractor import extract_text
from app.services.student_profile import (
    generate_student_profile,
    update_student_profile,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Student CRUD
# ---------------------------------------------------------------------------


@router.post("/", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(
    student: StudentCreate,
    db: AsyncSession = Depends(get_db),
) -> StudentResponse:
    """Create a new student."""
    # 检查 email 是否已存在
    existing = await db.execute(
        select(Student).where(Student.email == student.email)
    )
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
    return [StudentResponse.model_validate(s) for s in students]


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


# ---------------------------------------------------------------------------
# Resume endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/{student_id}/upload-resume",
    status_code=status.HTTP_201_CREATED,
)
async def upload_resume(
    student_id: UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Upload a resume file, parse it, and return structured results.

    Accepts PDF and DOCX files.
    """
    # 验证学生存在
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # 验证文件类型
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".pdf", ".docx", ".doc"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {suffix}. Only PDF and DOCX are supported.",
        )

    # 保存文件到磁盘
    upload_dir = Path(settings.upload_dir) / str(student_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / file.filename

    # 保存上传文件到磁盘
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # 从保存的文件中提取文本
    try:
        with open(file_path, "rb") as f:
            file_content = f.read()
        logger = logging.getLogger(__name__)
        logger.info(f"File content length: {len(file_content)}")
        raw_text, extraction_warnings = extract_text(file_content, file.filename)
        logger.info(f"Extracted text length: {len(raw_text)}")
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.warning(f"Text extraction failed: {e}", exc_info=True)
        raw_text = ""

    # 创建 Resume 记录
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

    # 解析简历
    parse_result = None
    try:
        if raw_text:
            parse_result = await parse_resume_text(raw_text)
            resume.parsed_json = parse_result.model_dump()
        else:
            from app.schemas.profiles import ResumeParseResult
            parse_result = ResumeParseResult(
                raw_text="",
                parse_confidence=0.0,
                missing_fields=["简历文本为空"],
            )
    except Exception as e:
        import traceback
        logging.getLogger(__name__).error(f"Parse error: {e}\n{traceback.format_exc()}")
        from app.schemas.profiles import ResumeParseResult
        parse_result = ResumeParseResult(
            raw_text=raw_text or "",
            parse_confidence=0.0,
            missing_fields=["解析失败"],
        )

    # 从解析结果更新 Student 基本信息
    try:
        await update_student_basic_info(student_id, parse_result.model_dump(), db)
    except Exception as e:
        logging.getLogger(__name__).warning(f"Update basic info failed: {e}")

    # 自动生成学生画像 - 暂时跳过以调试
    # try:
    #     await generate_student_profile(student_id, db)
    # except Exception as e:
    #     import logging
    #     logger = logging.getLogger(__name__)
    #     logger.warning("Profile generation failed: %s", e)

    from app.services.resume_parser import _calculate_completeness, _generate_suggestions

    completeness = _calculate_completeness(parse_result)
    suggestions = _generate_suggestions(parse_result)

    logger = logging.getLogger(__name__)
    logger.info(f"Returning response - skills: {len(parse_result.skills)}, education: {len(parse_result.education)}")

    # 直接返回字典而不是 Pydantic 模型
    return {
        "resume": {
            "id": str(resume.id),
            "student_id": str(resume.student_id),
            "filename": resume.filename,
            "file_type": resume.file_type,
            "is_primary": resume.is_primary,
            "created_at": resume.created_at.isoformat() if resume.created_at else None,
        },
        "parsed_data": parse_result.model_dump(),
        "completeness_score": completeness,
        "missing_suggestions": suggestions,
        "normalization_log": [],
    }


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
    return [ResumeResponse.model_validate(r) for r in resumes]


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


# ---------------------------------------------------------------------------
# Student profile endpoints
# ---------------------------------------------------------------------------


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
    # 附加缺失建议
    evidence = profile.evidence_json or {}
    response.missing_suggestions = evidence.get("missing_suggestions")
    return response


@router.put("/{student_id}/profile", response_model=StudentProfileResponse)
async def put_student_profile(
    student_id: UUID,
    update: StudentProfileUpdate,
    db: AsyncSession = Depends(get_db),
) -> StudentProfileResponse:
    """Manually update/supplement student profile."""
    # 验证学生存在
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if not update.profile_json:
        raise HTTPException(status_code=400, detail="profile_json is required")

    try:
        profile = await update_student_profile(student_id, update.profile_json, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return StudentProfileResponse.model_validate(profile)


@router.post("/{student_id}/profile/generate", response_model=StudentProfileResponse)
async def generate_profile(
    student_id: UUID,
    request: ProfileGenerateRequest,
    db: AsyncSession = Depends(get_db),
) -> StudentProfileResponse:
    """Generate student profile from a specific resume."""
    # 验证学生存在
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # 验证简历存在
    resume = await db.get(Resume, request.resume_id)
    if not resume or resume.student_id != student_id:
        raise HTTPException(status_code=404, detail="Resume not found")

    if not resume.parsed_json:
        raise HTTPException(status_code=400, detail="Resume has not been parsed yet")

    # 生成画像
    try:
        result = await generate_student_profile(student_id, db)
        profile = result["profile"]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    response = StudentProfileResponse.model_validate(profile)
    evidence = profile.evidence_json or {}
    response.missing_suggestions = evidence.get("missing_suggestions")
    return response
