"""Career report generation, normalization, and export services."""

from __future__ import annotations

import asyncio
import html
import json
import logging
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_provider import llm
from app.models.report import CareerReport, ReportVersion
from app.models.student import Student, StudentProfile
from app.prompts.report_generation import (
    REPORT_POLISH_SYSTEM_PROMPT,
    REPORT_POLISH_USER_TEMPLATE,
)
from app.services.graph import find_path_with_student_profile
from app.services.matching import match_student_job, recommend_jobs
from app.services.student_profile import normalize_student_profile_json

logger = logging.getLogger(__name__)

EXPORT_DIR = Path(__file__).resolve().parents[2] / "static" / "exports"
REPORT_TEMPLATE_VERSION = "2.0"
DEFAULT_REPORT_TITLE = "职业发展报告"
REPORT_CHAPTERS = [
    {"chapter_id": 1, "title": "一、个人优势总结"},
    {"chapter_id": 2, "title": "二、目标岗位分析"},
    {"chapter_id": 3, "title": "三、差距与行动计划"},
    {"chapter_id": 4, "title": "四、职业路径规划"},
    {"chapter_id": 5, "title": "五、评估周期"},
]
DIMENSION_META = [
    ("basic", "基础"),
    ("skill", "技能"),
    ("competency", "素养"),
    ("potential", "潜力"),
]
GAP_ITEM_LABELS = {
    "major_relevance": "专业与岗位方向匹配度",
}


def _normalize_score(value: Any) -> int:
    try:
        score = float(value or 0)
    except (TypeError, ValueError):
        return 0
    if score <= 1:
        score *= 100
    return max(0, min(100, round(score)))


def _safe_text(value: Any, default: str = "") -> str:
    text = str(value or "").strip()
    return text or default


def _chapter_title(chapter_id: int) -> str:
    for item in REPORT_CHAPTERS:
        if item["chapter_id"] == chapter_id:
            return item["title"]
    return f"第 {chapter_id} 章"


def _escape_html(text: Any) -> str:
    return html.escape(str(text or ""), quote=True)


def _join_non_empty(parts: list[str], separator: str = "，") -> str:
    return separator.join([part for part in parts if part])


def _clean_paragraph(text: str) -> str:
    text = " ".join(str(text or "").split()).replace("锟?", "").strip()
    if text and text[-1] not in "。！？!?":
        text += "。"
    return text


def _normalize_gap_item(raw_item: Any) -> str:
    text = _safe_text(raw_item, "能力差距")
    if text in GAP_ITEM_LABELS:
        return GAP_ITEM_LABELS[text]
    if text.startswith("必备技能:"):
        return f"必备技能：{text.split(':', 1)[-1].strip()}"
    if text.startswith("优选技能:"):
        return f"加分技能：{text.split(':', 1)[-1].strip()}"
    if text.startswith("职业素养:"):
        return f"职业素养：{text.split(':', 1)[-1].strip()}"
    if text.startswith("发展潜力:"):
        return f"发展潜力：{text.split(':', 1)[-1].strip()}"
    return text


def _build_gap_description(item_name: str, current_level: str, required_level: str) -> str:
    if item_name == GAP_ITEM_LABELS["major_relevance"]:
        return "当前专业背景与目标岗位方向的直接相关性偏弱，需要补足更贴近岗位的项目或实习证据"
    if current_level and required_level:
        return f"{current_level} -> {required_level}"
    if current_level:
        return f"当前水平：{current_level}"
    if required_level:
        return f"目标要求：{required_level}"
    return "当前能力与目标岗位要求存在差距"


def _build_gap_action(item_name: str, suggestion: str) -> str:
    if suggestion and suggestion != "建议针对该项短板制定补齐计划":
        return suggestion
    if item_name == GAP_ITEM_LABELS["major_relevance"]:
        return "补充与目标岗位更相关的课程、项目或实习经历，并在简历中明确说明转向理由与可迁移能力。"
    if item_name.startswith("必备技能："):
        skill_name = item_name.split("：", 1)[-1]
        return f"围绕 {skill_name} 完成 1 个可展示项目，并在简历中写清使用场景、技术细节和结果。"
    if item_name.startswith("加分技能："):
        skill_name = item_name.split("：", 1)[-1]
        return f"补充 {skill_name} 的基础实践，把它沉淀成面试中的加分项，而不是停留在概念层面。"
    if item_name.startswith("职业素养："):
        label = item_name.split("：", 1)[-1]
        return f"通过团队协作、复盘记录或项目推进过程，补足“{label}”这类软性能力证据。"
    if item_name.startswith("发展潜力："):
        label = item_name.split("：", 1)[-1]
        return f"主动发起新项目、比赛或作品集建设，用连续输出证明“{label}”的成长潜力。"
    return "建议围绕该短板补充一段可验证的项目、课程或实习经历，并同步更新简历表达。"


def _score_band_text(score: int) -> str:
    if score >= 80:
        return "具备较强切入基础"
    if score >= 60:
        return "具备一定切入基础"
    return "仍处在重点准备阶段"


def _normalize_action_items(items: Any) -> list[dict[str, Any]]:
    normalized = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        item_name = _normalize_gap_item(item.get("item") or item.get("gap_item"))
        current_level = _safe_text(item.get("current_level"))
        required_level = _safe_text(item.get("required_level"))
        gap_desc = _safe_text(item.get("gap_desc"))
        if item_name == GAP_ITEM_LABELS["major_relevance"] or not gap_desc:
            gap_desc = _build_gap_description(item_name, current_level, required_level)
        normalized.append(
            {
                "priority": _safe_text(item.get("priority"), "持续巩固"),
                "item": item_name,
                "gap_desc": gap_desc,
                "score_impact": int(item.get("score_impact") or 0),
                "action": _build_gap_action(item_name, _safe_text(item.get("action") or item.get("suggestion"))),
                "timeline": _safe_text(item.get("timeline"), "持续推进"),
            }
        )
    return normalized


def _normalize_paths(paths: Any, target_role: str, actions: list[dict[str, Any]]) -> dict[str, Any]:
    source = dict(paths or {})
    primary_path = [
        item for item in source.get("primary_path") or [] if isinstance(item, dict)
    ]
    alt_paths = [
        {"title": _safe_text(item.get("title"), "相关岗位"), "skill_overlap": _normalize_score(item.get("skill_overlap"))}
        for item in (source.get("alt_paths") or [])
        if isinstance(item, dict)
    ]
    if target_role and (
        not primary_path
        or target_role not in _safe_text(primary_path[0].get("title"))
    ):
        return {
            "primary_path": [
                {
                    "stage": "现在",
                    "title": f"{target_role} 准备期",
                    "condition": _safe_text(
                        actions[0]["action"] if actions else None,
                        "补齐岗位核心能力和求职材料，先把第一段可验证证据做出来。",
                    ),
                    "is_current": True,
                },
                {
                    "stage": "1-2年",
                    "title": f"{target_role}（初级）",
                    "condition": "完成相关实习或项目，形成稳定的岗位胜任力。",
                    "is_current": False,
                },
                {
                    "stage": "3-5年",
                    "title": f"{target_role}（进阶）",
                    "condition": "持续积累复杂项目经验和跨团队协作能力，逐步承担更大范围的结果责任。",
                    "is_current": False,
                },
            ],
            "alt_paths": alt_paths[:3],
        }
    return {"primary_path": primary_path, "alt_paths": alt_paths[:3]}


def normalize_report_content(content_json: dict[str, Any] | None) -> dict[str, Any]:
    """Normalize legacy and current report content into one shape."""
    content = dict(content_json or {})
    chapters = []
    raw_chapters = content.get("chapters") or []
    for index, item in enumerate(raw_chapters, start=1):
        if not isinstance(item, dict):
            continue
        if "text" in item:
            text = _clean_paragraph(str(item.get("text") or "")) if item.get("text") else ""
            data = item.get("data")
        else:
            sections = item.get("sections") or []
            section_texts = []
            for section in sections:
                if not isinstance(section, dict):
                    continue
                title = _safe_text(section.get("title"))
                content_text = _safe_text(section.get("content"))
                section_texts.append(f"{title}：{content_text}" if title and content_text else content_text)
            text = _clean_paragraph(" ".join([s for s in section_texts if s])) if section_texts else ""
            data = item.get("data")
        chapters.append(
            {
                "chapter_id": item.get("chapter_id") or index,
                "title": item.get("title") or _chapter_title(index),
                "text": text,
                "data": data,
                "status": item.get("status") or ("done" if text else "pending"),
            }
        )
    for chapter in REPORT_CHAPTERS:
        if not any(item["chapter_id"] == chapter["chapter_id"] for item in chapters):
            chapters.append(
                {
                    "chapter_id": chapter["chapter_id"],
                    "title": chapter["title"],
                    "text": "",
                    "data": None,
                    "status": "pending",
                }
            )
    chapters.sort(key=lambda item: item["chapter_id"])
    target_job = dict(content.get("target_job") or {})
    actions = _normalize_action_items(content.get("actions") or [])
    target_role = _safe_text(
        target_job.get("role_name") or target_job.get("role") or target_job.get("title")
    )
    paths = _normalize_paths(content.get("paths"), target_role, actions)
    for chapter in chapters:
        if chapter["chapter_id"] == 3:
            chapter["data"] = actions
        elif chapter["chapter_id"] == 4:
            chapter["data"] = paths
    return {
        "title": content.get("title") or DEFAULT_REPORT_TITLE,
        "summary": _clean_paragraph(str(content.get("summary") or "")) if content.get("summary") else "",
        "target_job": target_job,
        "dimensions": list(content.get("dimensions") or []),
        "actions": actions,
        "paths": paths,
        "chapters": chapters,
        "metadata": dict(content.get("metadata") or {}),
    }


def serialize_career_report(report: CareerReport) -> dict[str, Any]:
    content = normalize_report_content(report.content_json or {})
    return {
        "id": report.id,
        "student_id": report.student_id,
        "title": content.get("title") or DEFAULT_REPORT_TITLE,
        "summary": report.summary or content.get("summary") or "",
        "recommendations": report.recommendations or [],
        "suggested_jobs": None,
        "skill_gaps": content.get("actions"),
        "career_path": (content.get("paths") or {}).get("primary_path"),
        "status": report.status,
        "version": report.version or "1.0",
        "content_json": content,
        "pdf_path": report.pdf_path,
        "docx_path": report.docx_path,
        "created_at": report.created_at,
        "updated_at": report.updated_at,
    }


def _extract_skills(profile_json: dict[str, Any], limit: int = 6) -> list[str]:
    result = []
    for item in profile_json.get("skills") or []:
        if isinstance(item, dict):
            name = item.get("name") or item.get("skill_name")
        else:
            name = item
        if name:
            result.append(str(name))
    return result[:limit]


def _extract_projects(profile_json: dict[str, Any], limit: int = 3) -> list[str]:
    result = []
    experience = profile_json.get("experience") or {}
    for item in experience.get("projects") or profile_json.get("experiences") or []:
        if isinstance(item, dict):
            name = item.get("project_name") or item.get("name") or item.get("title")
            if name:
                result.append(str(name))
    return result[:limit]


def _extract_internships(profile_json: dict[str, Any], limit: int = 3) -> list[str]:
    result = []
    experience = profile_json.get("experience") or {}
    for item in experience.get("work") or profile_json.get("experiences") or []:
        if not isinstance(item, dict):
            continue
        company = _safe_text(item.get("company"))
        title = _safe_text(item.get("title") or item.get("position"))
        if company or title:
            result.append(_join_non_empty([company, title], " / "))
    return result[:limit]


def _extract_job_info(match_result: dict[str, Any]) -> dict[str, Any]:
    scores_json = dict(match_result.get("scores_json") or {})
    job_info = dict(scores_json.get("job_info") or {})
    role_name = (
        job_info.get("role")
        or job_info.get("title")
        or match_result.get("role_name")
        or match_result.get("job_title")
        or "目标岗位"
    )
    return {
        **job_info,
        "role_name": role_name,
        "match_score": _normalize_score(match_result.get("total_score") or scores_json.get("total_score")),
    }


def _extract_dimensions(match_result: dict[str, Any]) -> list[dict[str, Any]]:
    scores_json = dict(match_result.get("scores_json") or {})
    dimensions = []
    for key, label in DIMENSION_META:
        payload = dict(scores_json.get(key) or {})
        reason = _safe_text(payload.get("reason"))
        if not reason and isinstance(payload.get("items"), list) and payload["items"]:
            first_item = payload["items"][0]
            if isinstance(first_item, dict):
                reason = _safe_text(first_item.get("evidence") or first_item.get("dimension"))
        dimensions.append(
            {
                "key": key,
                "label": label,
                "score": _normalize_score(payload.get("score")),
                "reason": reason or "可继续补强这一维度的证据表达。",
            }
        )
    return dimensions


def _build_actions(match_result: dict[str, Any]) -> list[dict[str, Any]]:
    actions = []
    for item in match_result.get("gaps_json") or []:
        if not isinstance(item, dict):
            continue
        item_name = _normalize_gap_item(item.get("gap_item") or item.get("item"))
        current_level = _safe_text(item.get("current_level"))
        required_level = _safe_text(item.get("required_level"))
        raw_priority = str(item.get("priority") or "").lower()
        if raw_priority == "high":
            priority = "必须补齐"
            score_impact = -12
            timeline = "2-4周"
        elif raw_priority == "medium":
            priority = "建议提升"
            score_impact = -6
            timeline = "1-2个月"
        else:
            priority = "持续巩固"
            score_impact = -3
            timeline = "持续推进"
        actions.append(
            {
                "priority": priority,
                "item": item_name,
                "gap_desc": _build_gap_description(item_name, current_level, required_level),
                "score_impact": score_impact,
                "action": _build_gap_action(item_name, _safe_text(item.get("suggestion"))),
                "timeline": timeline,
            }
        )
    if actions:
        return actions[:5]
    return [
        {
            "priority": "持续巩固",
            "item": "强化项目表达",
            "gap_desc": "当前缺少明确阻塞项，但需要更强的求职证据",
            "score_impact": -3,
            "action": "补充项目量化成果、技术选型理由和个人贡献，持续优化简历表达。",
            "timeline": "持续推进",
        }
    ]


def _build_paths(
    student_profile: dict[str, Any],
    target_role: str,
    career_path: dict[str, Any] | None,
    related_jobs: list[dict[str, Any]],
    actions: list[dict[str, Any]],
) -> dict[str, Any]:
    action_plan = list((career_path or {}).get("action_plan") or [])
    primary_path = [
        {
            "stage": "现在",
            "title": f"{target_role} 准备期",
            "condition": _safe_text(
                actions[0]["action"] if actions else None,
                "补齐岗位核心能力和求职材料，先把第一段可验证证据做出来。",
            ),
            "is_current": True,
        },
        {
            "stage": "1-2年",
            "title": f"{target_role}（初级）",
            "condition": _safe_text(
                action_plan[0].get("action") if action_plan and isinstance(action_plan[0], dict) else None,
                "完成相关实习或项目，形成稳定的岗位胜任力。",
            ),
            "is_current": False,
        },
        {
            "stage": "3-5年",
            "title": f"{target_role}（进阶）",
            "condition": _safe_text(
                action_plan[1].get("action") if len(action_plan) > 1 and isinstance(action_plan[1], dict) else None,
                "持续积累复杂项目经验和跨团队协作能力，逐步承担更大范围的结果责任。",
            ),
            "is_current": False,
        },
    ]

    alt_paths = []
    for item in (career_path or {}).get("alternative_paths") or []:
        alt_paths.append({"title": _safe_text(item.get("intermediate_role"), "相关岗位"), "skill_overlap": 65})
    for item in related_jobs:
        alt_paths.append(
            {
                "title": _safe_text(item.get("role_name"), "相关岗位"),
                "skill_overlap": _normalize_score(item.get("skill_overlap")),
            }
        )
    seen = set()
    deduped = []
    for item in alt_paths:
        title = item["title"]
        if title in seen:
            continue
        seen.add(title)
        deduped.append(item)
    return {"primary_path": primary_path, "alt_paths": deduped[:3]}


def _build_summary(student_profile: dict[str, Any], job_info: dict[str, Any], actions: list[dict[str, Any]]) -> str:
    basic = student_profile.get("basic_info") or {}
    background = _join_non_empty([_safe_text(basic.get("school")), _safe_text(basic.get("major"))], " / ")
    next_step = actions[0]["action"] if actions else "继续补强项目与实习证据"
    return _clean_paragraph(
        f"{_safe_text(basic.get('name'), '该学生')}当前与“{job_info['role_name']}”的综合匹配度为 {job_info['match_score']} 分。"
        f"{f'当前背景为 {background}。' if background else ''}"
        f"下一步建议优先执行：{next_step}"
    )


def _build_recommendations(job_info: dict[str, Any], dimensions: list[dict[str, Any]], actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    score = job_info["match_score"]
    if score >= 80:
        primary = {
            "type": "positive",
            "title": "匹配基础较好",
            "content": f"你与“{job_info['role_name']}”已具备较好的进入门槛，接下来重点是强化项目证据和投递表达。",
        }
    elif score >= 60:
        primary = {
            "type": "improvement",
            "title": "适合集中补短板",
            "content": f"你与“{job_info['role_name']}”存在明确提升空间，补齐核心差距后有望明显抬升匹配度。",
        }
    else:
        primary = {
            "type": "warning",
            "title": "先补核心能力再投递",
            "content": f"当前与“{job_info['role_name']}”仍有较大差距，更适合先做阶段性准备后再进入正式投递。",
        }
    weakest = sorted(dimensions, key=lambda item: item["score"])[:1]
    recommendations = [primary]
    if weakest:
        recommendations.append(
            {
                "type": "action",
                "title": f"优先提升{weakest[0]['label']}",
                "content": weakest[0]["reason"],
            }
        )
    if actions:
        recommendations.append(
            {
                "type": "action",
                "title": "先完成最高优先级动作",
                "content": actions[0]["action"],
            }
        )
    return recommendations


def _build_report_content(
    student_profile: dict[str, Any],
    matching_results: list[dict[str, Any]],
    career_path: dict[str, Any] | None,
) -> tuple[dict[str, Any], str, list[dict[str, Any]]]:
    top_match = matching_results[0]
    job_info = _extract_job_info(top_match)
    dimensions = _extract_dimensions(top_match)
    actions = _build_actions(top_match)
    related_jobs = [
        {
            "role_name": _extract_job_info(item)["role_name"],
            "skill_overlap": max(0.4, min(0.95, _extract_job_info(item)["match_score"] / 100)),
        }
        for item in matching_results[1:4]
    ]
    paths = _build_paths(student_profile, job_info["role_name"], career_path, related_jobs, actions)
    basic = student_profile.get("basic_info") or {}
    skills = _extract_skills(student_profile, 5)
    projects = _extract_projects(student_profile, 2)
    internships = _extract_internships(student_profile, 2)
    competitiveness = _normalize_score(student_profile.get("competitiveness_score"))
    strongest_dimension = max(dimensions, key=lambda item: item["score"], default=None)
    weakest_dimension = min(dimensions, key=lambda item: item["score"], default=None)
    score_band = _score_band_text(job_info["match_score"])
    chapter_one = _clean_paragraph(
        f"{_safe_text(basic.get('name'), '该学生')}目前的综合竞争力约为 {competitiveness} 分，"
        f"{f'当前背景为 {_join_non_empty([_safe_text(basic.get('school')), _safe_text(basic.get('major'))], ' / ')}，' if _join_non_empty([_safe_text(basic.get('school')), _safe_text(basic.get('major'))], ' / ') else ''}"
        f"面向“{job_info['role_name']}”方向整体{score_band}。"
        f"{f'核心技能集中在 {", ".join(skills)}。' if skills else ''}"
        f"{f'已有 {", ".join(internships)} 等经历。' if internships else ''}"
        f"{f'项目实践包括 {", ".join(projects)}。' if projects else ''}"
    )
    chapter_two = _clean_paragraph(
        f"目标岗位为“{job_info['role_name']}”，当前综合匹配度为 {job_info['match_score']} 分。"
        f"{f'当前优势主要体现在“{strongest_dimension['label']}”维度。' if strongest_dimension else ''}"
        f"{f'短板则集中在“{weakest_dimension['label']}”维度，需要优先补强。' if weakest_dimension else ''}"
    )
    must_fix = len([item for item in actions if item["priority"] == "必须补齐"])
    chapter_three = _clean_paragraph(
        f"围绕“{job_info['role_name']}”的进入门槛，当前共识别出 {len(actions)} 项关键动作，其中必须补齐 {must_fix} 项。"
        f"优先级越高的事项越应尽快转化为项目、实习或简历中的可验证证据。"
    )
    chapter_four = _clean_paragraph(
        f"推荐以“{job_info['role_name']}”作为当前主路径，先进入准备期，再向初级岗位和进阶岗位逐步推进。"
        f"{f'同时也可关注 {", ".join(item["title"] for item in paths["alt_paths"])} 等相邻岗位作为横向备选。' if paths['alt_paths'] else ''}"
    )
    checkpoints = "、".join(item["item"] for item in actions[:3]) or "核心技能与项目表达"
    chapter_five = _clean_paragraph(
        f"建议以 3 个月为一个复盘周期，重点检查 {checkpoints} 是否已经形成可验证成果。"
        f"完成阶段动作后，重新上传最新简历并复跑匹配与报告，可以直观看到提升幅度。"
    )
    summary = _build_summary(student_profile, job_info, actions)
    chapters = [
        {"chapter_id": 1, "title": _chapter_title(1), "text": chapter_one, "data": None, "status": "done"},
        {"chapter_id": 2, "title": _chapter_title(2), "text": chapter_two, "data": {"overall_score": job_info["match_score"], "dimensions": dimensions}, "status": "done"},
        {"chapter_id": 3, "title": _chapter_title(3), "text": chapter_three, "data": actions, "status": "done"},
        {"chapter_id": 4, "title": _chapter_title(4), "text": chapter_four, "data": paths, "status": "done"},
        {"chapter_id": 5, "title": _chapter_title(5), "text": chapter_five, "data": None, "status": "done"},
    ]
    recommendations = _build_recommendations(job_info, dimensions, actions)
    content_json = {
        "title": f"{_safe_text(basic.get('name'), '学生')} - {job_info['role_name']}职业发展报告",
        "summary": summary,
        "target_job": job_info,
        "dimensions": dimensions,
        "actions": actions,
        "paths": paths,
        "chapters": chapters,
        "metadata": {"generated_at": datetime.now(UTC).isoformat(), "template_version": REPORT_TEMPLATE_VERSION},
    }
    return content_json, summary, recommendations


async def _load_student_profile(student_id: UUID, db: AsyncSession) -> tuple[Student, dict[str, Any]]:
    student = await db.get(Student, student_id)
    if not student:
        raise ValueError("Student not found")
    result = await db.execute(select(StudentProfile).where(StudentProfile.student_id == student_id))
    profile = result.scalar_one_or_none()
    if profile is None or not profile.profile_json:
        raise ValueError("学生画像不存在，请先生成学生画像")
    return student, normalize_student_profile_json(profile.profile_json or {}, student)


def _match_to_payload(match_result: Any) -> dict[str, Any]:
    return {
        "job_id": str(match_result.job_profile_id),
        "job_profile_id": str(match_result.job_profile_id),
        "total_score": match_result.total_score,
        "scores_json": dict(match_result.scores_json or {}),
        "gaps_json": list(match_result.gaps_json or []),
    }


async def _resolve_matching_results(db: AsyncSession, student_id: UUID, target_job_ids: list[UUID] | None = None) -> list[dict[str, Any]]:
    if target_job_ids:
        results = []
        for job_id in target_job_ids:
            results.append(_match_to_payload(await match_student_job(db, student_id, job_id, mode="deep")))
        if not results:
            raise ValueError("未能生成目标岗位的匹配结果")
        return results
    recommended = await recommend_jobs(db, student_id, top_k=5)
    if not recommended:
        raise ValueError("暂无岗位匹配结果，请先完成匹配推荐")
    return [_match_to_payload(item) for item in recommended]


async def _resolve_career_path(db: AsyncSession, student_profile: dict[str, Any], matching_results: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not matching_results:
        return None
    target_role = _extract_job_info(matching_results[0])["role_name"]
    try:
        return await find_path_with_student_profile(db, student_profile, target_role, "expert")
    except Exception as exc:
        logger.warning("Career path generation failed for %s: %s", target_role, exc)
        return None


async def generate_outline(
    student_profile: dict[str, Any],
    matching_results: list[dict[str, Any]],
    career_path: dict[str, Any] | None = None,
) -> dict[str, Any]:
    del student_profile, matching_results, career_path
    return {"title": DEFAULT_REPORT_TITLE, "chapters": REPORT_CHAPTERS, "generated_by": "template"}


async def generate_chapters(
    outline: dict[str, Any],
    student_profile: dict[str, Any],
    matching_results: list[dict[str, Any]],
    career_path: dict[str, Any] | None,
    db: AsyncSession,
) -> list[dict[str, Any]]:
    del outline, db
    content_json, _, _ = _build_report_content(student_profile, matching_results, career_path)
    return list(content_json["chapters"])


def _next_version(version: str | None) -> str:
    try:
        return f"{float(version or '1.0') + 0.1:.1f}"
    except (TypeError, ValueError):
        return "1.1"


async def merge_and_save(student_id: UUID, report_data: dict[str, Any], db: AsyncSession) -> CareerReport:
    content_json = normalize_report_content(dict(report_data.get("content_json") or {}))
    summary = _clean_paragraph(str(report_data.get("summary") or content_json.get("summary") or ""))
    recommendations = list(report_data.get("recommendations") or [])
    existing = (
        await db.execute(
            select(CareerReport)
            .where(CareerReport.student_id == student_id)
            .order_by(desc(CareerReport.updated_at), desc(CareerReport.created_at))
            .limit(1)
        )
    ).scalars().first()
    if existing is None:
        report = CareerReport(
            student_id=student_id,
            status="completed",
            version="1.0",
            content_json=content_json,
            summary=summary,
            recommendations=recommendations,
        )
        db.add(report)
        await db.flush()
    else:
        report = existing
        report.status = "completed"
        report.version = _next_version(report.version)
        report.content_json = content_json
        report.summary = summary
        report.recommendations = recommendations
        report.pdf_path = None
        report.docx_path = None
        await db.flush()
    db.add(
        ReportVersion(
            report_id=report.id,
            version=report.version,
            content=content_json,
            change_notes="重新生成报告",
        )
    )
    await db.commit()
    await db.refresh(report)
    return report


async def generate_full_report(student_id: UUID, db: AsyncSession, target_job_ids: list[UUID] | None = None) -> CareerReport:
    _, student_profile = await _load_student_profile(student_id, db)
    matching_results = await _resolve_matching_results(db, student_id, target_job_ids)
    career_path = await _resolve_career_path(db, student_profile, matching_results)
    outline = await generate_outline(student_profile, matching_results, career_path)
    chapters = await generate_chapters(outline, student_profile, matching_results, career_path, db)
    content_json, summary, recommendations = _build_report_content(student_profile, matching_results, career_path)
    content_json["chapters"] = chapters
    content_json["metadata"]["student_id"] = str(student_id)
    content_json["metadata"]["target_job_ids"] = [str(item) for item in target_job_ids or []]
    return await merge_and_save(
        student_id,
        {
            "content_json": content_json,
            "summary": summary,
            "recommendations": recommendations,
            "matching_results": matching_results,
            "career_path": career_path,
        },
        db,
    )


async def generate_report(student_id: UUID, db: AsyncSession, job_ids: list[UUID] | None = None) -> dict[str, Any]:
    return serialize_career_report(await generate_full_report(student_id, db, job_ids))


def _build_export_chart_html(content: dict[str, Any]) -> str:
    normalized = normalize_report_content(content)
    dimensions = normalized.get("dimensions") or []
    if not dimensions:
        matching_results = content.get("matching_results") or []
        if isinstance(matching_results, list) and matching_results:
            top_match = matching_results[0] if isinstance(matching_results[0], dict) else {}
            if isinstance(top_match, dict):
                dimensions = _extract_dimensions(top_match)
    if not dimensions:
        return ""
    rows = []
    for item in dimensions:
        rows.append(
            f'<div class="chart-row"><div class="chart-label">{_escape_html(item.get("label"))}</div>'
            f'<div class="chart-bar"><div class="chart-fill" style="width: {item.get("score", 0)}%"></div></div>'
            f'<div class="chart-value">{item.get("score", 0)}</div></div>'
        )
    return '<div class="chart-container"><h3>四维匹配概览</h3>' + "".join(rows) + "</div>"


def _build_export_html(report: CareerReport, content_json: dict[str, Any]) -> str:
    content = normalize_report_content(content_json)
    cards = []
    for chapter in content["chapters"]:
        extra_html = ""
        if chapter["chapter_id"] == 2:
            extra_html = _build_export_chart_html(content)
        elif chapter["chapter_id"] == 3 and isinstance(chapter.get("data"), list):
            items = []
            for item in chapter["data"]:
                items.append(
                    f'<div class="action-item"><strong>{_escape_html(item.get("priority"))} / {_escape_html(item.get("item"))}</strong>'
                    f'<div>{_escape_html(item.get("action"))}</div><div class="muted">周期：{_escape_html(item.get("timeline"))}</div></div>'
                )
            extra_html = '<div class="action-list">' + "".join(items) + "</div>"
        elif chapter["chapter_id"] == 4 and isinstance(chapter.get("data"), dict):
            nodes = []
            for item in chapter["data"].get("primary_path") or []:
                nodes.append(
                    f'<div class="path-node"><div class="muted">{_escape_html(item.get("stage"))}</div>'
                    f'<div><strong>{_escape_html(item.get("title"))}</strong></div><div>{_escape_html(item.get("condition"))}</div></div>'
                )
            alt_titles = [f"<li>{_escape_html(item.get('title'))}</li>" for item in (chapter["data"].get("alt_paths") or [])]
            extra_html = '<div class="path-list">' + "".join(nodes) + "</div>" + (f"<ul>{''.join(alt_titles)}</ul>" if alt_titles else "")
        cards.append(
            f'<section class="card"><div class="card-head"><h2>{_escape_html(chapter["title"])}</h2><span class="badge">已生成</span></div>'
            f'<p>{_escape_html(chapter.get("text"))}</p>{extra_html}</section>'
        )
    rec_html = "".join(
        f'<div class="recommendation"><strong>{_escape_html(item.get("title"))}</strong><span>{_escape_html(item.get("content"))}</span></div>'
        for item in (report.recommendations or [])
    )
    title = content.get("title") or DEFAULT_REPORT_TITLE
    summary = report.summary or content.get("summary") or ""
    generated_at = report.created_at.strftime("%Y-%m-%d %H:%M:%S") if report.created_at else datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")
    return f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>{_escape_html(title)}</title>
<style>
body{{font-family:"Microsoft YaHei","PingFang SC",sans-serif;background:#f4f6fb;color:#111827;margin:0;padding:32px}}
.container{{max-width:860px;margin:0 auto}} .hero,.card,.panel{{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:24px;margin-bottom:18px;box-shadow:0 10px 30px rgba(15,23,42,.06)}}
.hero{{background:linear-gradient(135deg,#4f46e5,#2563eb);color:#fff}} .hero h1{{margin:0 0 10px}} .hero p{{margin:0;line-height:1.8}}
.card-head{{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}} .card-head h2{{margin:0;font-size:22px}}
.badge{{background:#dcfce7;color:#166534;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700}} p{{line-height:1.9;white-space:pre-wrap}}
.chart-container,.action-item,.path-node,.recommendation{{background:#f8fafc;border-radius:16px;padding:14px 16px;margin-top:12px}} .muted{{color:#6b7280;font-size:12px}}
.chart-row{{display:flex;align-items:center;gap:12px;margin:10px 0}} .chart-label{{width:72px;font-weight:700}} .chart-bar{{flex:1;height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden}} .chart-fill{{height:100%;background:linear-gradient(90deg,#60a5fa,#2563eb)}} .chart-value{{width:40px;text-align:right}}
.recommendation{{display:grid;gap:6px}} .footer{{text-align:center;color:#6b7280;font-size:12px;margin-top:18px}}
</style></head><body><div class="container"><section class="hero"><h1>{_escape_html(title)}</h1><p>{_escape_html(summary)}</p></section>{''.join(cards)}<section class="panel"><h3>推荐建议</h3>{rec_html or '<div class="recommendation">当前暂无额外建议。</div>'}</section><div class="footer"><div>生成时间：{_escape_html(generated_at)}</div><div>版本：{_escape_html(report.version or '1.0')}</div></div></div></body></html>"""


async def export_to_pdf(report_id: UUID, db: AsyncSession) -> str:
    report = await db.get(CareerReport, report_id)
    if report is None:
        raise ValueError(f"Report {report_id} not found")
    html_content = _build_export_html(report, report.content_json or {})
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    html_path = EXPORT_DIR / f"career_report_{report.student_id}_{timestamp}.html"
    pdf_path = EXPORT_DIR / f"career_report_{report.student_id}_{timestamp}.pdf"
    html_path.write_text(html_content, encoding="utf-8")
    script = """
import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    html_path = Path(sys.argv[1]).resolve()
    pdf_path = Path(sys.argv[2]).resolve()
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        page = await browser.new_page()
        await page.goto(html_path.as_uri(), wait_until='networkidle')
        await page.pdf(path=str(pdf_path), format='A4', print_background=True, margin={'top': '18mm', 'right': '14mm', 'bottom': '18mm', 'left': '14mm'})
        await browser.close()

asyncio.run(main())
"""
    try:
        result = await asyncio.to_thread(
            subprocess.run,
            [sys.executable, "-c", script, str(html_path), str(pdf_path)],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError((result.stderr or result.stdout or "").strip())
    except Exception as exc:  # pragma: no cover
        logger.error("PDF export failed for report %s: %s", report_id, exc)
        raise RuntimeError(f"PDF 导出失败: {exc}") from exc
    report.pdf_path = str(pdf_path)
    await db.commit()
    return str(pdf_path)


async def _export_to_html(report_id: UUID, db: AsyncSession) -> str:
    report = await db.get(CareerReport, report_id)
    if report is None:
        raise ValueError(f"Report {report_id} not found")
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    html_path = EXPORT_DIR / f"career_report_{report.student_id}_{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}.html"
    html_path.write_text(_build_export_html(report, report.content_json or {}), encoding="utf-8")
    return str(html_path)


async def export_to_docx(report_id: UUID, db: AsyncSession) -> str:
    report = await db.get(CareerReport, report_id)
    if report is None:
        raise ValueError(f"Report {report_id} not found")
    from docx import Document
    content = normalize_report_content(report.content_json or {})
    document = Document()
    document.add_heading(content.get("title") or DEFAULT_REPORT_TITLE, 0)
    if report.summary:
        document.add_heading("报告摘要", level=1)
        document.add_paragraph(report.summary)
    for chapter in content["chapters"]:
        document.add_heading(chapter["title"], level=1)
        if chapter.get("text"):
            document.add_paragraph(chapter["text"])
        if chapter["chapter_id"] == 3 and isinstance(chapter.get("data"), list):
            for item in chapter["data"]:
                document.add_paragraph(f"{item.get('priority')} - {item.get('item')}: {item.get('action')}", style="List Bullet")
    if report.recommendations:
        document.add_heading("推荐建议", level=1)
        for item in report.recommendations:
            document.add_paragraph(f"{item.get('title')}: {item.get('content')}", style="List Bullet")
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    docx_path = EXPORT_DIR / f"career_report_{report.student_id}_{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}.docx"
    document.save(str(docx_path))
    report.docx_path = str(docx_path)
    await db.commit()
    return str(docx_path)


def _build_report_polish_context(content: dict[str, Any], report: CareerReport) -> dict[str, Any]:
    return {
        "title": content.get("title") or DEFAULT_REPORT_TITLE,
        "summary": content.get("summary") or report.summary or "",
        "target_job": content.get("target_job") or {},
        "dimensions": content.get("dimensions") or [],
        "actions": content.get("actions") or [],
        "paths": content.get("paths") or {},
        "chapters": [
            {
                "chapter_id": chapter.get("chapter_id"),
                "title": chapter.get("title"),
                "text": chapter.get("text") or "",
            }
            for chapter in (content.get("chapters") or [])
        ],
    }


async def _ai_polish_report_content(content: dict[str, Any], report: CareerReport) -> tuple[dict[str, Any], list[str]]:
    context = _build_report_polish_context(content, report)
    prompt = REPORT_POLISH_USER_TEMPLATE.format(
        report_context=json.dumps(context, ensure_ascii=False, indent=2)
    )
    result = await llm.generate_json(
        prompt=prompt,
        system_prompt=REPORT_POLISH_SYSTEM_PROMPT,
        temperature=0.4,
        max_retries=2,
        timeout=25,
    )

    polished_summary = _clean_paragraph(_safe_text(result.get("summary")))
    raw_chapters = result.get("chapters")
    if not isinstance(raw_chapters, list):
        raise ValueError("AI 润色结果缺少 chapters 数组")

    current_chapters = {chapter["chapter_id"]: dict(chapter) for chapter in content.get("chapters") or []}
    changes: list[str] = []
    polished_chapters: list[dict[str, Any]] = []
    seen_ids: set[int] = set()

    for item in raw_chapters:
        if not isinstance(item, dict):
            continue
        chapter_id = int(item.get("chapter_id") or 0)
        original = current_chapters.get(chapter_id)
        if original is None:
            continue
        polished_text = _clean_paragraph(_safe_text(item.get("text")))
        if not polished_text:
            raise ValueError(f"AI 润色结果缺少第 {chapter_id} 章正文")
        if polished_text != (original.get("text") or ""):
            changes.append(f"AI 改写了《{original['title']}》正文")
        original["text"] = polished_text
        polished_chapters.append(original)
        seen_ids.add(chapter_id)

    missing_ids = sorted(set(current_chapters) - seen_ids)
    if missing_ids:
        raise ValueError(f"AI 润色结果缺少章节: {', '.join(str(item) for item in missing_ids)}")

    polished_chapters.sort(key=lambda item: item["chapter_id"])
    updated_content = dict(content)
    if polished_summary and polished_summary != (content.get("summary") or ""):
        changes.insert(0, "AI 改写了报告摘要")
    updated_content["summary"] = polished_summary or content.get("summary") or ""
    updated_content["chapters"] = polished_chapters
    updated_content["metadata"] = {
        **dict(content.get("metadata") or {}),
        "last_polished_at": datetime.now(UTC).isoformat(),
        "last_polish_mode": "ai",
    }
    return updated_content, changes


async def polish_report(report_id: UUID, db: AsyncSession) -> dict[str, Any]:
    report = await db.get(CareerReport, report_id)
    if report is None:
        return {"polished": False, "error": "Report not found"}
    content = normalize_report_content(report.content_json or {})
    if not any((chapter.get("text") or "").strip() for chapter in content.get("chapters") or []):
        return {"polished": False, "error": "报告正文为空，请先生成报告"}

    updated_content, changes = await _ai_polish_report_content(content, report)
    if not changes:
        return {"polished": True, "changes": [], "version": report.version or "1.0"}

    report.content_json = updated_content
    report.summary = updated_content.get("summary") or report.summary
    report.version = _next_version(report.version)
    db.add(
        ReportVersion(
            report_id=report.id,
            version=report.version,
            content=updated_content,
            change_notes="AI 增强润色报告文案",
        )
    )
    await db.commit()
    return {"polished": True, "changes": changes, "version": report.version}


async def check_completeness(report_id: UUID, db: AsyncSession) -> dict[str, Any]:
    report = await db.get(CareerReport, report_id)
    if report is None:
        raise ValueError("Report not found")
    content = normalize_report_content(report.content_json or {})
    missing = []
    if not content.get("summary"):
        missing.append("报告摘要")
    if not content.get("dimensions"):
        missing.append("四维匹配结果")
    if not content.get("actions"):
        missing.append("行动计划")
    if not (content.get("paths") or {}).get("primary_path"):
        missing.append("职业路径规划")
    for chapter in REPORT_CHAPTERS:
        current = next((item for item in content["chapters"] if item["chapter_id"] == chapter["chapter_id"]), None)
        if current is None or not current.get("text"):
            missing.append(chapter["title"])
    suggestions = []
    if "四维匹配结果" in missing:
        suggestions.append("先确保学生画像和岗位匹配结果已生成，再重新生成报告。")
    if "行动计划" in missing:
        suggestions.append("补充至少 3 条可执行行动项，并给出时间周期。")
    if "职业路径规划" in missing:
        suggestions.append("补充主路径和横向备选岗位，便于后续导出与复盘。")
    if not suggestions and missing:
        suggestions.append("重新生成一次报告以补齐缺失内容。")
    return {"complete": not missing, "missing_items": missing, "suggestions": suggestions, "chapter_count": len(content["chapters"])}


async def create_report_version(report_id: UUID, version: str, db: AsyncSession, change_notes: str | None = None) -> dict[str, Any]:
    report = await db.get(CareerReport, report_id)
    if report is None:
        raise ValueError(f"Report {report_id} not found")
    report_version = ReportVersion(report_id=report.id, version=version, content=normalize_report_content(report.content_json or {}), change_notes=change_notes)
    db.add(report_version)
    await db.commit()
    return {"id": str(report_version.id), "report_id": str(report_version.report_id), "version": report_version.version, "created_at": report_version.created_at.isoformat() if report_version.created_at else None}
