"""Resume parser service - parses resumes and extracts structured information."""

import logging
import re
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_provider import llm
from app.models.student import Resume, Student
from app.prompts.resume_parse import (
    RESUME_PARSE_SYSTEM_PROMPT,
    RESUME_PARSE_USER_TEMPLATE,
)
from app.schemas.profiles import ResumeParseResult
from app.utils.file_extractor import extract_text

logger = logging.getLogger(__name__)

_SECTION_HINTS = ("教育", "实习", "工作", "项目", "技能", "证书", "奖项", "自我评价", "校园", "科研")
_SKILL_KEYWORDS = [
    "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Go", "Rust", "SQL",
    "React", "Vue", "FastAPI", "Django", "Flask", "PostgreSQL", "MySQL", "Redis",
    "Docker", "Kubernetes", "Git", "Linux", "Excel", "Word", "PowerPoint",
]
_CERTIFICATE_KEYWORDS = [
    "CET-4", "CET-6", "计算机二级", "计算机三级", "普通话", "教师资格证", "初级会计",
]


def _normalize_resume_text(text: str) -> str:
    lines = [line.strip() for line in text.splitlines()]
    cleaned_lines: list[str] = []
    previous_blank = False

    for line in lines:
        if not line:
            if not previous_blank:
                cleaned_lines.append("")
            previous_blank = True
            continue
        previous_blank = False
        cleaned_lines.append(re.sub(r"\s{2,}", " ", line))

    return "\n".join(cleaned_lines).strip()


def _select_resume_excerpt(text: str, max_chars: int = 4000) -> str:
    normalized = _normalize_resume_text(text)
    if len(normalized) <= max_chars:
        return normalized

    selected: list[str] = []
    total = 0
    for line in normalized.splitlines():
        if not line:
            if selected and selected[-1] != "":
                selected.append("")
                total += 1
            continue

        if total + len(line) + 1 > max_chars:
            break

        score = 2 if any(hint in line for hint in _SECTION_HINTS) else 1
        if score > 1 or total < max_chars * 0.75:
            selected.append(line)
            total += len(line) + 1

    excerpt = "\n".join(selected).strip()
    return excerpt or normalized[:max_chars]


def _extract_name(text: str) -> str | None:
    first_non_empty = next((line for line in text.splitlines() if line.strip()), "")
    match = re.search(r"(?:姓名|Name)[:：]?\s*([^\s/|]+)", first_non_empty, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None


def _cheap_resume_fallback(text: str, reason: str) -> ResumeParseResult:
    """Low-cost fallback parser to avoid a second full LLM call."""
    normalized = _normalize_resume_text(text)
    lines = [line for line in normalized.splitlines() if line]

    skills = []
    seen_skills: set[str] = set()
    lowered = normalized.lower()
    for keyword in _SKILL_KEYWORDS:
        if keyword.lower() in lowered and keyword not in seen_skills:
            seen_skills.add(keyword)
            skills.append({"name": keyword, "category": "其他", "proficiency": "掌握"})

    certificates = []
    seen_certificates: set[str] = set()
    for keyword in _CERTIFICATE_KEYWORDS:
        if keyword in normalized and keyword not in seen_certificates:
            seen_certificates.add(keyword)
            certificates.append({"name": keyword})

    education = []
    for line in lines[:10]:
        if any(token in line for token in ("大学", "学院", "本科", "硕士", "博士", "大专")):
            edu_match = re.search(
                r"(?P<school>[^\s,，]+(?:大学|学院))\s*(?P<major>[^\s,，]+)?\s*(?P<degree>本科|硕士|博士|大专)?",
                line,
            )
            if edu_match:
                education.append(
                    {
                        "school": edu_match.group("school"),
                        "major": edu_match.group("major") or "",
                        "degree": edu_match.group("degree") or "本科",
                    }
                )
                break

    experience = []
    for line in lines:
        if re.search(r"(实习|有限公司|公司|科技|集团)", line) and re.search(r"(20\d{2}|至今)", line):
            experience.append(
                {
                    "company": line[:40],
                    "role": "",
                    "description": line[:160],
                    "is_internship": "实习" in line,
                }
            )
            break

    projects = []
    for line in lines:
        if any(token in line for token in ("项目", "系统", "平台", "小程序", "大赛")):
            projects.append(
                {
                    "name": line[:40],
                    "description": line[:160],
                    "tech_stack": [skill["name"] for skill in skills[:3]],
                }
            )
            break

    missing_fields = [f"AI解析失败，已使用兜底结果: {reason}"]
    if not _extract_name(normalized):
        missing_fields.append("未可靠提取姓名")

    return ResumeParseResult(
        raw_text=text,
        education=education,
        experience=experience,
        projects=projects,
        skills=skills,
        certificates=certificates,
        awards=[],
        self_intro=None,
        parse_confidence=0.35 if (education or experience or projects or skills or certificates) else 0.15,
        missing_fields=missing_fields,
    )


def is_fallback_result(parse_result: ResumeParseResult) -> bool:
    return any(field.startswith("AI解析失败，已使用兜底结果") for field in parse_result.missing_fields)


class ResumeParserService:
    """Service for parsing resumes."""

    async def _llm_parse_resume_text(self, text: str, *, max_tokens: int = 1024) -> ResumeParseResult:
        prompt = RESUME_PARSE_USER_TEMPLATE.format(resume_text=_select_resume_excerpt(text))
        data = await llm.generate_json(
            prompt=prompt,
            system_prompt=RESUME_PARSE_SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=max_tokens,
            max_retries=1,
            disable_reasoning=True,
            response_format={"type": "json_object"},
        )
        allowed_fields = {
            "education",
            "experience",
            "projects",
            "skills",
            "certificates",
            "awards",
            "self_intro",
            "parse_confidence",
            "missing_fields",
        }
        filtered_data = {key: value for key, value in data.items() if key in allowed_fields}
        return ResumeParseResult(raw_text=text, **filtered_data)

    async def parse_resume_text(self, text: str) -> ResumeParseResult:
        """Parse resume text using LLM, then fall back to local rules on failure."""
        print(f"[ResumeParser] 收到文本，长度={len(text)}")
        print(f"[ResumeParser] 文本前300字: {text[:300]}")

        if not text or len(text.strip()) < 50:
            logger.warning("Resume text too short, returning empty parse result")
            return ResumeParseResult(
                raw_text=text,
                parse_confidence=0.0,
                missing_fields=["文本内容不足，无法解析"],
            )

        try:
            result = await self._llm_parse_resume_text(text)
            logger.info(
                "Resume parse success: skills=%d, education=%d, experience=%d, projects=%d",
                len(result.skills),
                len(result.education),
                len(result.experience),
                len(result.projects),
            )
            return result
        except Exception as exc:
            logger.exception("Resume parse failed: %s", exc)
            return _cheap_resume_fallback(text, str(exc))

    async def process_upload(
        self,
        student_id: int,
        file_content: bytes,
        filename: str,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Process uploaded resume file."""
        warnings: list[str] = []

        try:
            text, extraction_warnings = extract_text(file_content, filename)
            warnings.extend(extraction_warnings)
        except ValueError as exc:
            logger.warning("Text extraction failed: %s", exc)
            warnings.append(str(exc))
            text = ""

        if text and len(text) < 200:
            warnings.append("简历文本较短，可能影响解析质量")

        if text:
            parse_result = await self.parse_resume_text(text)
        else:
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

        if parse_result.parse_confidence < 0.6:
            warnings.append(f"解析置信度较低 ({parse_result.parse_confidence:.0%})，建议手动核对")

        student_uuid = await self._get_student_uuid(student_id, db)
        if not student_uuid:
            raise ValueError(f"Student {student_id} not found")

        resume = Resume(
            student_id=student_uuid,
            filename=filename,
            file_path="",
            file_type=filename.lower().split(".")[-1],
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
        result = await db.execute(select(Student).where(Student.email.like(f"%{student_id}%")))
        student = result.scalars().first()
        if student:
            return student.id

        default_student = Student(
            email=f"student_{student_id}@demo.local",
            name=f"Student {student_id}",
        )
        db.add(default_student)
        await db.flush()
        await db.refresh(default_student)
        return default_student.id


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
    result = await db.execute(select(Resume).where(Resume.id == resume_id))
    resume = result.scalars().first()
    if not resume:
        raise ValueError(f"Resume {resume_id} not found")

    if resume.raw_text:
        parse_result = await resume_parser_service.parse_resume_text(resume.raw_text)
    else:
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
    result = await db.execute(select(Student).where(Student.email.like(f"%{student_id}%")))
    student = result.scalars().first()
    if not student:
        return

    if parsed_data.get("education"):
        edu = parsed_data["education"][0]
        if not student.name and edu.get("school"):
            pass


def _calculate_completeness(parse_result: ResumeParseResult) -> float:
    """Calculate completeness score based on parsed data."""
    score = 40.0

    if parse_result.experience:
        score += 15
    if parse_result.projects and len(parse_result.projects) >= 2:
        score += 15
    if parse_result.certificates:
        score += 10

    has_quantified = False
    for proj in parse_result.projects:
        proj_dict = proj.model_dump() if hasattr(proj, "model_dump") else proj.dict()
        if proj_dict.get("outcome") and any(char.isdigit() for char in str(proj_dict["outcome"])):
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


compute_completeness_score = _calculate_completeness
generate_missing_suggestions = _generate_suggestions
