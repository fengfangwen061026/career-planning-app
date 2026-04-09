"""Resume parser service - parses resumes and extracts structured information."""

import asyncio
import logging
import os
import re
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_provider import llm
from app.config import settings
from app.models.student import Resume, Student
from app.prompts.resume_parse import (
    RESUME_PARSE_SYSTEM_PROMPT,
    RESUME_PARSE_USER_TEMPLATE,
)
from app.schemas.profiles import ResumeParseResult
from app.utils.file_extractor import extract_text
from app.utils.skill_normalizer import normalize_skill

logger = logging.getLogger(__name__)

_RESUME_EXCERPT_MAX_CHARS = int(os.getenv("RESUME_PARSE_EXCERPT_MAX_CHARS", "1800"))
_RESUME_LLM_MAX_TOKENS = int(os.getenv("RESUME_PARSE_MAX_TOKENS", "1800"))
_RESUME_LLM_TIMEOUT_SECONDS = float(os.getenv("RESUME_PARSE_LLM_TIMEOUT_SECONDS", "7"))
_RESUME_PARSE_TIMEOUT_SECONDS = float(os.getenv("RESUME_PARSE_TIMEOUT_SECONDS", "8"))

_SECTION_HINTS = ("教育", "实习", "工作", "项目", "技能", "证书", "奖项", "自我评价", "校园", "科研")
_SKILL_KEYWORDS = [
    "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Go", "Rust", "SQL",
    "React", "Vue", "FastAPI", "Django", "Flask", "PostgreSQL", "MySQL", "Redis",
    "Docker", "Kubernetes", "Git", "Linux", "Excel", "Word", "PowerPoint",
    "ChatGPT", "Gemini", "Claude", "Office",
]
_CERTIFICATE_KEYWORDS = [
    "CET-4", "CET-6", "计算机二级", "计算机三级", "普通话", "教师资格证", "初级会计",
]

def _resume_parse_model() -> str:
    return settings.resume_parse_llm_model or settings.llm_model


def _resume_parse_extra_kwargs(model: str) -> dict[str, Any]:
    extra_kwargs: dict[str, Any] = {}
    if model.startswith("step-2"):
        extra_kwargs["response_format"] = {"type": "json_object"}
    return extra_kwargs


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


def _select_resume_excerpt(text: str, max_chars: int = _RESUME_EXCERPT_MAX_CHARS) -> str:
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
    if re.fullmatch(r"[\u4e00-\u9fa5]{2,4}", first_non_empty.strip()):
        return first_non_empty.strip()
    return None


def _extract_email(text: str) -> str | None:
    match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, re.IGNORECASE)
    return match.group(0) if match else None


def _extract_phone(text: str) -> str | None:
    match = re.search(r"1[3-9]\d{9}", text)
    return match.group(0) if match else None


def _extract_location(text: str) -> str | None:
    patterns = [
        r"(?:现居地|所在地|地址|Address)[:：]?\s*([^\n]+)",
        r"(?:居住地|意向城市)[:：]?\s*([^\n]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def _extract_self_intro(text: str) -> str | None:
    patterns = [
        r"(?:自我评价|自我介绍|个人总结|个人评价|SELF\s*EVALUATION?).*?\n+\s*(.+?)(?:\n\s*\n(?:项目经历|教育经历|研究技能|荣誉奖项|科研经历|技能)|$)",
        r"(?:自我评价|自我介绍|个人总结|个人评价)[:：]?\s*(.+?)(?:\n\s*\n|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            value = re.sub(r"\s+", " ", match.group(1)).strip()
            if value and "SELF EVALUTATION" not in value.upper():
                return value
    return None


def _ensure_string(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, list):
        parts = [str(item).strip() for item in value if str(item).strip()]
        value = " ".join(parts)
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def _coerce_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    match = re.search(r"\d{4}", str(value))
    return int(match.group(0)) if match else None


def _normalize_degree(value: Any, default: str = "本科") -> str:
    text = _ensure_string(value) or default
    mapping = {
        "博士": "博士",
        "硕士": "硕士",
        "研究生": "硕士",
        "本科": "本科",
        "学士": "本科",
        "大专": "大专",
        "专科": "大专",
    }
    for keyword, normalized in mapping.items():
        if keyword in text:
            return normalized
    return default


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
    for line in lines:
        if "：" not in line:
            continue
        title, _, detail = line.partition("：")
        title = title.strip()
        if any(token in title for token in ("工具", "技能", "语言", "Office", "编写")) and 1 < len(title) <= 16:
            proficiency = "熟练" if "熟练" in detail else ("掌握" if "掌握" in detail else "了解")
            if title not in seen_skills:
                seen_skills.add(title)
                skills.append({"name": title, "category": "其他", "proficiency": proficiency})

    certificates = []
    seen_certificates: set[str] = set()
    for keyword in _CERTIFICATE_KEYWORDS:
        if keyword in normalized and keyword not in seen_certificates:
            seen_certificates.add(keyword)
            certificates.append({"name": keyword})

    education = []
    school = None
    major = None
    degree = None
    for line in lines:
        school_match = re.search(r"(?:学校[:：]?)?\s*([^\s,，]+(?:大学|学院))", line)
        if school_match and not school:
            school = school_match.group(1)
        major_match = re.search(r"(?:专业|研究方向)[:：]?\s*([^\s,，/]+)", line)
        if major_match and not major:
            major = major_match.group(1)
        degree_match = re.search(r"(本科|学士|硕士|博士|大专)", line)
        if degree_match and not degree:
            degree = _normalize_degree(degree_match.group(1))
        if any(token in line for token in ("大学", "学院", "本科", "硕士", "博士", "大专")) and not school:
            edu_match = re.search(
                r"(?P<school>[^\s,，]+(?:大学|学院))\s*(?P<major>[^\s,，]+)?\s*(?P<degree>本科|学士|硕士|博士|大专)?",
                line,
            )
            if edu_match:
                school = school or edu_match.group("school")
                major = major or edu_match.group("major")
                degree = degree or _normalize_degree(edu_match.group("degree"))
    if school or major or degree:
        education.append(
            {
                "school": school or "",
                "major": major or "",
                "degree": degree or "本科",
            }
        )

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
    for index, line in enumerate(lines):
        if re.search(r"20\d{2}[-./]\d{1,2}|至今", line) and any(token in line for token in ("项目", "平台", "系统", "大赛", "竞赛")):
            description = lines[index + 1] if index + 1 < len(lines) else line
            projects.append(
                {
                    "name": re.sub(r"^\d{4}[-./~至今0-9]+\s*", "", line)[:60],
                    "description": description[:200],
                    "tech_stack": [skill["name"] for skill in skills[:4]],
                }
            )
    if not projects:
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

    awards = []
    for line in lines:
        if "奖" in line and any(token in line for token in ("竞赛", "大赛", "奖", "获")):
            awards.append({"name": line[:80], "level": "其他"})

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
        awards=awards,
        self_intro=_extract_self_intro(normalized),
        parse_confidence=0.55 if (education or experience or projects or len(skills) >= 3) else 0.35,
        missing_fields=missing_fields,
    )


def _dedupe_named_items(items: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        value = _ensure_string(item.get(key))
        if not value:
            continue
        normalized = re.sub(r"\s+", "", value).lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(item)
    return deduped


def _merge_resume_parse_payload(
    text: str,
    llm_data: dict[str, Any],
    fallback_result: ResumeParseResult,
) -> dict[str, Any]:
    fallback = fallback_result.model_dump(mode="json")

    education: list[dict[str, Any]] = []
    for index, item in enumerate(llm_data.get("education") or []):
        if not isinstance(item, dict):
            continue
        backup = (fallback.get("education") or [{}])[index if index < len(fallback.get("education") or []) else 0]
        merged = {
            "school": _ensure_string(item.get("school")) or _ensure_string(backup.get("school")),
            "degree": _normalize_degree(item.get("degree"), _normalize_degree(backup.get("degree"))),
            "major": _ensure_string(item.get("major")) or _ensure_string(backup.get("major")) or "",
            "start_year": _coerce_int(item.get("start_year")) or _coerce_int(backup.get("start_year")),
            "end_year": _coerce_int(item.get("end_year")) or _coerce_int(backup.get("end_year")),
        }
        if merged["school"]:
            education.append(merged)
    if not education:
        education = fallback.get("education") or []

    experience: list[dict[str, Any]] = []
    for index, item in enumerate(llm_data.get("experience") or []):
        if not isinstance(item, dict):
            continue
        backup = (fallback.get("experience") or [{}])[index if index < len(fallback.get("experience") or []) else 0]
        merged = {
            "company": _ensure_string(item.get("company")) or _ensure_string(backup.get("company")) or "",
            "role": _ensure_string(item.get("role")) or _ensure_string(backup.get("role")),
            "start_date": _ensure_string(item.get("start_date")) or _ensure_string(backup.get("start_date")),
            "end_date": _ensure_string(item.get("end_date")) or _ensure_string(backup.get("end_date")),
            "description": _ensure_string(item.get("description")) or _ensure_string(backup.get("description")),
            "is_internship": bool(item.get("is_internship", backup.get("is_internship", True))),
        }
        if merged["company"] or merged["role"] or merged["description"]:
            experience.append(merged)
    if not experience:
        experience = fallback.get("experience") or []

    projects: list[dict[str, Any]] = []
    for index, item in enumerate(llm_data.get("projects") or []):
        if not isinstance(item, dict):
            continue
        backup = (fallback.get("projects") or [{}])[index if index < len(fallback.get("projects") or []) else 0]
        tech_stack_raw = item.get("tech_stack") or backup.get("tech_stack") or []
        tech_stack = [
            normalize_skill(str(tech).strip())
            for tech in tech_stack_raw
            if str(tech).strip()
        ]
        merged = {
            "name": _ensure_string(item.get("name")) or _ensure_string(backup.get("name")) or "",
            "description": _ensure_string(item.get("description")) or _ensure_string(backup.get("description")),
            "tech_stack": tech_stack,
            "role": _ensure_string(item.get("role")) or _ensure_string(backup.get("role")),
            "outcome": _ensure_string(item.get("outcome")) or _ensure_string(backup.get("outcome")),
        }
        if merged["name"] or merged["description"] or merged["tech_stack"]:
            projects.append(merged)
    if not projects:
        projects = fallback.get("projects") or []

    skills: list[dict[str, Any]] = []
    for item in llm_data.get("skills") or []:
        if not isinstance(item, dict):
            continue
        name = normalize_skill(_ensure_string(item.get("name")) or "")
        if not name:
            continue
        skills.append(
            {
                "name": name,
                "category": _ensure_string(item.get("category")) or "其他",
                "proficiency": _ensure_string(item.get("proficiency")) or "掌握",
            }
        )
    for item in fallback.get("skills") or []:
        if not isinstance(item, dict):
            continue
        name = normalize_skill(_ensure_string(item.get("name")) or "")
        if not name:
            continue
        skills.append(
            {
                "name": name,
                "category": _ensure_string(item.get("category")) or "其他",
                "proficiency": _ensure_string(item.get("proficiency")) or "掌握",
            }
        )
    skills = _dedupe_named_items(skills, "name")

    certificates: list[dict[str, Any]] = []
    for item in (llm_data.get("certificates") or []) + (fallback.get("certificates") or []):
        if not isinstance(item, dict):
            continue
        name = _ensure_string(item.get("name"))
        if not name:
            continue
        certificates.append(
            {
                "name": name,
                "level": _ensure_string(item.get("level")),
                "obtained_date": _ensure_string(item.get("obtained_date")) or _ensure_string(item.get("date")),
            }
        )
    certificates = _dedupe_named_items(certificates, "name")

    awards: list[dict[str, Any]] = []
    for item in (llm_data.get("awards") or []) + (fallback.get("awards") or []):
        if not isinstance(item, dict):
            continue
        name = _ensure_string(item.get("name"))
        if not name:
            continue
        awards.append(
            {
                "name": name,
                "level": _ensure_string(item.get("level")) or "其他",
                "date": _ensure_string(item.get("date")),
            }
        )
    awards = _dedupe_named_items(awards, "name")

    llm_confidence = llm_data.get("parse_confidence")
    if isinstance(llm_confidence, (int, float)):
        parse_confidence = float(llm_confidence)
    else:
        parse_confidence = fallback_result.parse_confidence
    parse_confidence = max(0.0, min(parse_confidence, 1.0))
    if any((education, experience, projects, skills)):
        parse_confidence = max(parse_confidence, 0.55)

    missing_fields = list(dict.fromkeys([
        *[str(item) for item in (llm_data.get("missing_fields") or []) if str(item).strip()],
        *fallback_result.missing_fields,
    ]))

    return {
        "raw_text": text,
        "education": education,
        "experience": experience,
        "projects": projects,
        "skills": skills,
        "certificates": certificates,
        "awards": awards,
        "self_intro": _ensure_string(llm_data.get("self_intro")) or fallback_result.self_intro or _extract_self_intro(text),
        "parse_confidence": parse_confidence,
        "missing_fields": missing_fields,
    }


def enrich_parsed_resume_payload(parsed_data: dict[str, Any], raw_text: str) -> dict[str, Any]:
    payload = {**parsed_data}
    basic_info = dict(payload.get("basic_info") or {})
    basic_info.setdefault("name", _extract_name(raw_text))
    basic_info.setdefault("email", _extract_email(raw_text))
    basic_info.setdefault("phone", _extract_phone(raw_text))
    basic_info.setdefault("location", _extract_location(raw_text))
    payload["basic_info"] = {key: value for key, value in basic_info.items() if value}
    if not payload.get("self_intro"):
        payload["self_intro"] = _extract_self_intro(raw_text)
    return payload


def is_fallback_result(parse_result: ResumeParseResult) -> bool:
    return any(field.startswith("AI解析失败，已使用兜底结果") for field in parse_result.missing_fields)


def _is_parse_result_substantial(parse_result: ResumeParseResult) -> bool:
    return any(
        [
            bool(parse_result.education),
            bool(parse_result.experience),
            bool(parse_result.projects),
            bool(parse_result.skills),
            bool(parse_result.certificates),
            bool(parse_result.awards),
            bool((parse_result.self_intro or "").strip()),
            parse_result.parse_confidence >= 0.2,
        ]
    )


class ResumeParserService:
    """Service for parsing resumes."""

    async def _llm_parse_resume_text(
        self,
        text: str,
        *,
        max_tokens: int = _RESUME_LLM_MAX_TOKENS,
    ) -> ResumeParseResult:
        prompt = RESUME_PARSE_USER_TEMPLATE.format(resume_text=_select_resume_excerpt(text))
        allowed_fields = {
            "education",
            "experience",
            "projects",
            "skills",
            "certificates",
            "awards",
            "self_intro",
        }
        fallback_result = _cheap_resume_fallback(text, "启发式补全")

        model = _resume_parse_model()
        data = await llm.generate_json(
            prompt=prompt,
            system_prompt=RESUME_PARSE_SYSTEM_PROMPT,
            temperature=0.0,
            max_tokens=max_tokens,
            max_retries=1,
            disable_reasoning=True,
            model=model,
            timeout=_RESUME_LLM_TIMEOUT_SECONDS,
            **_resume_parse_extra_kwargs(model),
        )
        filtered_data = {key: value for key, value in data.items() if key in allowed_fields}
        merged_payload = _merge_resume_parse_payload(text, filtered_data, fallback_result)
        result = ResumeParseResult.model_validate(merged_payload)
        if _is_parse_result_substantial(result):
            return result

        logger.warning("Resume parse returned insubstantial payload after merge, using fallback")
        return fallback_result

    async def parse_resume_text(self, text: str) -> ResumeParseResult:
        """Parse resume text using LLM, then fall back to local rules on failure."""
        if not text or len(text.strip()) < 50:
            logger.warning("Resume text too short, returning empty parse result")
            return ResumeParseResult(
                raw_text=text,
                parse_confidence=0.0,
                missing_fields=["文本内容不足，无法解析"],
            )

        try:
            result = await asyncio.wait_for(
                self._llm_parse_resume_text(text),
                timeout=_RESUME_PARSE_TIMEOUT_SECONDS,
            )
            logger.info(
                "Resume parse success: skills=%d, education=%d, experience=%d, projects=%d",
                len(result.skills),
                len(result.education),
                len(result.experience),
                len(result.projects),
            )
            return result
        except asyncio.TimeoutError:
            logger.warning("Resume parse timed out, using fallback parser")
            return _cheap_resume_fallback(text, "LLM timeout")
        except Exception as exc:
            logger.warning("Resume parse failed, using fallback parser: %s", exc)
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
        """Get student UUID from integer ID using exact match."""
        # Try to find existing student by exact ID match first
        try:
            if isinstance(student_id, int):
                # Query by email with exact format matching student_{id}@demo.local
                result = await db.execute(
                    select(Student).where(Student.email == f"student_{student_id}@demo.local")
                )
                student = result.scalars().first()
                if student:
                    return student.id
        except Exception:
            pass

        # If not found, create a new default student
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
    # Use exact email match instead of LIKE to prevent incorrect matches
    result = await db.execute(
        select(Student).where(Student.email == f"student_{student_id}@demo.local")
    )
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


def _coerce_parse_result(parse_result: ResumeParseResult | dict[str, Any]) -> ResumeParseResult:
    if isinstance(parse_result, ResumeParseResult):
        return parse_result

    base = {
        "raw_text": parse_result.get("raw_text", ""),
        "education": parse_result.get("education", []),
        "experience": parse_result.get("experience", parse_result.get("work_experience", [])),
        "projects": parse_result.get("projects", parse_result.get("project_experience", [])),
        "skills": parse_result.get("skills", []),
        "certificates": parse_result.get("certificates", []),
        "awards": parse_result.get("awards", []),
        "self_intro": parse_result.get("self_intro", parse_result.get("self_evaluation")),
        "parse_confidence": parse_result.get("parse_confidence", parse_result.get("_meta", {}).get("parse_confidence", 0.0)),
        "missing_fields": parse_result.get("missing_fields", parse_result.get("_meta", {}).get("missing_fields", [])),
    }
    return ResumeParseResult.model_validate(base)


def normalize_parsed_skills(parsed_data: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, str]]]:
    normalized = {**parsed_data}
    normalization_log: list[dict[str, str]] = []

    skills = []
    for skill in parsed_data.get("skills", []):
        if not isinstance(skill, dict):
            skills.append(skill)
            continue

        original_name = str(skill.get("name", "")).strip()
        normalized_name = normalize_skill(original_name) if original_name else original_name
        if normalized_name and normalized_name != original_name:
            normalization_log.append({"field": "skills", "from": original_name, "to": normalized_name})

        skills.append({**skill, "name": normalized_name})

    normalized["skills"] = skills

    project_key = "project_experience" if "project_experience" in parsed_data else "projects"
    normalized_projects = []
    for project in parsed_data.get(project_key, []):
        if not isinstance(project, dict):
            normalized_projects.append(project)
            continue

        tech_stack = []
        for tech in project.get("tech_stack", []):
            normalized_tech = normalize_skill(str(tech).strip()) if str(tech).strip() else tech
            if normalized_tech != tech:
                normalization_log.append({"field": f"{project_key}.tech_stack", "from": str(tech), "to": normalized_tech})
            tech_stack.append(normalized_tech)

        normalized_projects.append({**project, "tech_stack": tech_stack})

    normalized[project_key] = normalized_projects
    return normalized, normalization_log


def _legacy_compute_completeness(parsed_data: dict[str, Any]) -> float:
    checks = [
        bool(parsed_data.get("basic_info")),
        bool(parsed_data.get("education")),
        bool(parsed_data.get("work_experience") or parsed_data.get("experience")),
        bool(parsed_data.get("project_experience") or parsed_data.get("projects")),
        bool(parsed_data.get("skills")),
        bool(parsed_data.get("certificates")),
        bool(parsed_data.get("awards")),
    ]
    return round(sum(checks) / len(checks), 2)


def _has_quantified_achievement(items: list[dict[str, Any]]) -> bool:
    for item in items:
        for key in ("achievements", "responsibilities", "description", "outcome"):
            value = item.get(key)
            values = value if isinstance(value, list) else [value]
            for entry in values:
                if entry and any(char.isdigit() for char in str(entry)):
                    return True
    return False


def _legacy_generate_missing_suggestions(parsed_data: dict[str, Any]) -> list[str]:
    suggestions: list[str] = []
    basic_info = parsed_data.get("basic_info", {})
    work_experience = parsed_data.get("work_experience") or parsed_data.get("experience") or []
    projects = parsed_data.get("project_experience") or parsed_data.get("projects") or []

    if not basic_info.get("email"):
        suggestions.append("建议补充邮箱信息")
    if not basic_info.get("phone"):
        suggestions.append("建议补充联系电话")
    if not parsed_data.get("education"):
        suggestions.append("建议补充教育经历")
    if not work_experience:
        suggestions.append("建议补充工作或实习经历")
    if not projects:
        suggestions.append("建议补充项目经验")
    if work_experience and not _has_quantified_achievement(work_experience):
        suggestions.append("建议补充量化成果")
    if not parsed_data.get("certificates"):
        suggestions.append("建议补充专业证书")

    return suggestions


def compute_completeness_score(parse_result: ResumeParseResult | dict[str, Any]) -> float:
    if isinstance(parse_result, dict):
        return _legacy_compute_completeness(parse_result)
    return _calculate_completeness(_coerce_parse_result(parse_result))


def generate_missing_suggestions(parse_result: ResumeParseResult | dict[str, Any]) -> list[str]:
    if isinstance(parse_result, dict):
        return _legacy_generate_missing_suggestions(parse_result)
    return _generate_suggestions(_coerce_parse_result(parse_result))
