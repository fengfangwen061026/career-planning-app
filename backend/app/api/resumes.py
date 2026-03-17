"""Resume API routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.student import Resume
from app.schemas.profiles import ResumeParseResult, ResumeUploadResponse
from app.services.resume_parser import resume_parser_service

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@router.post(
    "/upload",
    response_model=ResumeUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_resume(
    file: UploadFile = File(...),
    student_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
) -> ResumeUploadResponse:
    """Upload a resume file and parse it.

    Accepts PDF and DOCX files (max 5MB).
    """
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Check file extension
    suffix = "." + file.filename.lower().split(".")[-1]
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {suffix}. Only PDF and DOCX are supported.",
        )

    # Read file content
    file_content = await file.read()

    # Check file size
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds {MAX_FILE_SIZE // 1024 // 1024}MB limit",
        )

    # Use default student_id if not provided
    if student_id is None:
        student_id = 1  # Default for demo

    # Process upload
    try:
        result = await resume_parser_service.process_upload(
            student_id=student_id,
            file_content=file_content,
            filename=file.filename,
            db=db,
        )
        await db.commit()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger = __import__("logging").getLogger(__name__)
        logger.error(f"Resume upload failed: {e}")
        raise HTTPException(status_code=500, detail="Resume processing failed")

    return ResumeUploadResponse(
        resume_id=int(result["resume_id"].replace("-", "")[:8], 16),
        student_id=result["student_id"],
        parse_result=result["parse_result"],
        warnings=result["warnings"],
    )


@router.get("/{resume_id}")
async def get_resume(
    resume_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get resume details by ID."""
    # Convert int ID back to UUID format (for demo, using hash)
    uuid_str = str(abs(resume_id)).zfill(8) + "-" * 4
    uuid_str = f"{uuid_str[:8]}-{uuid_str[8:12]}-{uuid_str[12:16]}-{uuid_str[16:20]}-{uuid_str[20:32]}"

    result = await db.execute(
        select(Resume).where(Resume.id == UUID(uuid_str) if len(str(uuid_str)) == 36 else Resume.id.isnot(None))
    )

    # Query by the integer as a simple lookup for demo
    # In production, use proper UUID conversion
    query_result = await db.execute(
        select(Resume).order_by(Resume.created_at.desc()).limit(abs(resume_id) if resume_id > 0 else 1)
    )
    resumes = query_result.scalars().all()

    if not resumes:
        raise HTTPException(status_code=404, detail="Resume not found")

    resume = resumes[0]

    return {
        "resume_id": int(resume.id.hex[:8], 16),
        "student_id": int(resume.student_id.hex[:8], 16),
        "filename": resume.filename,
        "file_type": resume.file_type,
        "raw_text": resume.raw_text,
        "parsed_json": resume.parsed_json,
        "created_at": resume.created_at.isoformat() if resume.created_at else None,
    }


@router.post("/{resume_id}/confirm")
async def confirm_resume(
    resume_id: int,
    parse_result: ResumeParseResult,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Confirm and update the parsed resume result.

    User can review and correct the parsed result, then confirm to update the database.
    """
    # Find resume
    query_result = await db.execute(
        select(Resume).order_by(Resume.created_at.desc()).limit(abs(resume_id) if resume_id > 0 else 1)
    )
    resumes = query_result.scalars().all()

    if not resumes:
        raise HTTPException(status_code=404, detail="Resume not found")

    resume = resumes[0]

    # Update parsed JSON
    resume.parsed_json = parse_result.model_dump()
    await db.flush()
    await db.commit()

    return {"success": True}
