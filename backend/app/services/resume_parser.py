"""Resume parser service - parses resumes and extracts structured information."""

import json
import logging
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_provider import llm
from app.models.student import Resume, Student
from app.prompts.resume_parse import (
    RESUME_PARSE_SYSTEM_PROMPT,
    RESUME_PARSE_USER_TEMPLATE,
    build_resume_parse_prompt,
)
from app.schemas.profiles import ResumeParseResult
from app.utils.file_extractor import extract_text

logger = logging.getLogger(__name__)


class ResumeParserService:
    """Service for parsing resumes."""

    async def parse_resume_text(self, text: str) -> ResumeParseResult:
        """Parse resume text using LLM.

        Args:
            text: Raw resume text

        Returns:
            ResumeParseResult with parsed data
        """
        # Check text length
        if not text or len(text.strip()) < 50:
            print("[ResumeParser] 文本太短，返回空结果")
            return ResumeParseResult(
                raw_text=text,
                parse_confidence=0.0,
                missing_fields=["文本内容不足，无法解析"],
            )

        prompt = RESUME_PARSE_USER_TEMPLATE.format(resume_text=text[:8000])

        for attempt in range(2):
            try:
                print(f"[ResumeParser] 第{attempt+1}次调用LLM，文本长度={len(text)}")

                # 直接调用 generate，自己处理 JSON 解析
                raw = await llm.generate(
                    prompt=prompt,
                    system_prompt=RESUME_PARSE_SYSTEM_PROMPT,
                    temperature=0.1,
                    max_tokens=4000,
                )

                print(f"[ResumeParser] LLM返回长度={len(raw)}，前200字: {raw[:200]}")

                # 剥离可能的 markdown 代码块和思考内容
                cleaned = raw.strip()
                # 移除思考内容
                if "<think>" in cleaned:
                    cleaned = cleaned.split("</think>")[-1]
                if cleaned.startswith("```"):
                    lines = cleaned.split("\n")
                    cleaned = "\n".join(lines[1:-1]) if (lines[-1].strip() == "```") else "\n".join(lines[1:])
                cleaned = cleaned.strip()

                data = json.loads(cleaned)
                result = ResumeParseResult(raw_text=text, **data)
                print(f"[ResumeParser] 解析成功，skills数量={len(result.skills)}，education数量={len(result.education)}")
                return result

            except Exception as e:
                print(f"[ResumeParser] 第{attempt+1}次失败: {e}")
                if attempt == 0:
                    # 第二次用更简单的 prompt 重试
                    prompt = f"解析这份简历，只输出JSON，不要其他内容：\n{text[:4000]}\n输出格式：{{\"skills\":[{{\"name\":\"技能\",\"category\":\"编程语言\",\"proficiency\":\"掌握\",\"evidence\":\"\"}}],\"education\":[],\"experience\":[],\"projects\":[],\"certificates\":[],\"awards\":[],\"self_intro\":null,\"parse_confidence\":0.5,\"missing_fields\":[]}}"
                    continue

        print("[ResumeParser] 两次均失败，返回空结果")
        return ResumeParseResult(
            raw_text=text,
            parse_confidence=0.0,
            missing_fields=["LLM解析失败"],
        )

    async def process_upload(
        self,
        student_id: int,
        file_content: bytes,
        filename: str,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Process uploaded resume file.

        Pipeline:
        1. Extract text from file
        2. Parse with LLM
        3. Save to database
        4. Return results with warnings

        Args:
            student_id: Student ID
            file_content: Raw file bytes
            filename: Original filename
            db: Database session

        Returns:
            Dict with resume_id, parse_result, warnings
        """
        warnings: list[str] = []

        # Step 1: Extract text
        try:
            text, extraction_warnings = extract_text(file_content, filename)
            warnings.extend(extraction_warnings)
        except ValueError as e:
            logger.warning(f"Text extraction failed: {e}")
            warnings.append(str(e))
            text = ""

        # Check for short text warning
        if text and len(text) < 200:
            warnings.append("简历文本较短，可能影响解析质量")

        # Step 2: Parse with LLM (if text extracted)
        if text:
            parse_result = await self.parse_resume_text(text)
        else:
            # Return empty result
            parse_result = ResumeParseResult(
                raw_text="",
                education=[],
                experience=[],
                projects=[],
                skills=[],
                certificates=[],
                awards=[],
                self_intro=None,
                parse_confidence=0.0,
                missing_fields=["文本提取失败"],
            )

        # Add low confidence warning
        if parse_result.parse_confidence < 0.6:
            warnings.append(f"解析置信度较低 ({parse_result.parse_confidence:.0%})，建议手动核对")

        # Step 3: Save to database
        # Get student UUID from int ID
        student_uuid = await self._get_student_uuid(student_id, db)
        if not student_uuid:
            raise ValueError(f"Student {student_id} not found")

        resume = Resume(
            student_id=student_uuid,
            filename=filename,
            file_path="",  # file_url field: store empty string for demo
            file_type=filename.lower().split('.')[-1],
            raw_text=text,
            parsed_json=parse_result.model_dump(),
            is_primary=True,
        )

        db.add(resume)
        await db.flush()
        await db.refresh(resume)

        return {
            "resume_id": str(resume.id),
            "student_id": student_id,
            "parse_result": parse_result,
            "warnings": warnings,
        }

    async def _get_student_uuid(self, student_id: int, db: AsyncSession) -> UUID | None:
        """Get student UUID from integer ID."""
        result = await db.execute(
            select(Student).where(Student.email.like(f"%{student_id}%"))
        )
        # For demo, student_id is passed as integer but we need UUID
        # Since this is a demo, we'll create or get a default student
        student = result.scalars().first()
        if student:
            return student.id

        # Create default student for demo
        default_student = Student(
            email=f"student_{student_id}@demo.local",
            name=f"Student {student_id}",
        )
        db.add(default_student)
        await db.flush()
        await db.refresh(default_student)
        return default_student.id


# Singleton instance
resume_parser_service = ResumeParserService()


async def parse_resume_text(text: str) -> ResumeParseResult:
    """Convenience function for parsing resume text."""
    return await resume_parser_service.parse_resume_text(text)


async def process_upload(
    student_id: int,
    file_content: bytes,
    filename: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Convenience function for processing uploaded resume."""
    return await resume_parser_service.process_upload(student_id, file_content, filename, db)


async def parse_resume(resume_id: UUID, db: AsyncSession) -> dict[str, Any]:
    """Parse a resume by ID - legacy function for API compatibility."""
    from sqlalchemy import select
    from app.models.student import Resume
    from app.schemas.student import ResumeResponse

    result = await db.execute(select(Resume).where(Resume.id == resume_id))
    resume = result.scalars().first()
    if not resume:
        raise ValueError(f"Resume {resume_id} not found")

    # Parse the resume text
    if resume.raw_text:
        parse_result = await resume_parser_service.parse_resume_text(resume.raw_text)
    else:
        from app.schemas.profiles import ResumeParseResult
        parse_result = ResumeParseResult(
            raw_text="",
            parse_confidence=0.0,
            missing_fields=["简历文本为空"],
        )

    return {
        "resume": resume,
        "parsed_data": parse_result.model_dump(),
        "completeness_score": _calculate_completeness(parse_result),
        "missing_suggestions": _generate_suggestions(parse_result),
        "normalization_log": [],
    }


async def update_student_basic_info(
    student_id: int,
    parsed_data: dict,
    db: AsyncSession,
) -> None:
    """Update student basic info from parsed resume data."""
    from sqlalchemy import select
    from app.models.student import Student

    # Find student by email pattern for demo
    result = await db.execute(
        select(Student).where(Student.email.like(f"%{student_id}%"))
    )
    student = result.scalars().first()
    if not student:
        return

    # Update from parsed data
    if parsed_data.get("education"):
        edu = parsed_data["education"][0]
        if not student.name and edu.get("school"):
            # Could set school as name for demo purposes
            pass


def _calculate_completeness(parse_result: ResumeParseResult) -> float:
    """Calculate completeness score based on parsed data."""
    score = 40.0  # Base score

    if parse_result.experience:
        score += 15
    if parse_result.projects and len(parse_result.projects) >= 2:
        score += 15
    if parse_result.certificates:
        score += 10

    # Check for quantified outcomes
    has_quantified = False
    for proj in parse_result.projects:
        if proj.get("outcome") and any(c.isdigit() for c in str(proj["outcome"])):
            has_quantified = True
            break
    if has_quantified:
        score += 10

    if parse_result.self_intro:
        score += 10

    return min(score, 100.0)


def _generate_suggestions(parse_result: ResumeParseResult) -> list[str]:
    """Generate suggestions based on missing fields."""
    suggestions = []

    if not parse_result.experience:
        suggestions.append("建议添加实习经历")
    if not parse_result.projects or len(parse_result.projects) < 2:
        suggestions.append("建议添加项目经验")
    if not parse_result.certificates:
        suggestions.append("建议添加专业证书")
    if parse_result.parse_confidence < 0.6:
        suggestions.append("简历信息不完整，建议补充更多细节")

    return suggestions


# Aliases for compatibility with student_profile.py
compute_completeness_score = _calculate_completeness
generate_missing_suggestions = _generate_suggestions
