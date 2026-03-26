# backend/app/services/report_generator.py
"""职业发展报告生成服务 - 五章独立生成.

按顺序逐章调用 LLM，每章完成后立即写库，前端可轮询进度。
"""
import json
import logging
import re
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_provider import llm
from app.prompts.report_generation import (
    CHAPTER_1_PROMPT,
    CHAPTER_2_PROMPT,
    CHAPTER_3_PROMPT,
    CHAPTER_4_PROMPT,
    CHAPTER_5_PROMPT,
    REPORT_SYSTEM_PROMPT,
)

logger = logging.getLogger(__name__)


class ReportGeneratorService:
    """职业发展报告生成服务 - 五章逐章生成."""

    def __init__(self):
        self.llm = llm

    # ------------------------------------------------------------------
    # 公开接口
    # ------------------------------------------------------------------

    async def generate_report(
        self,
        student_profile: dict,
        job_profile: dict,
        matching_result: dict,
        related_jobs: list[dict],
        db: AsyncSession,
        student_id: UUID,
    ):
        """逐章生成报告并持久化，返回 CareerReport 对象。"""
        from app.models.report import CareerReport

        job_title = job_profile.get("role_name") or job_profile.get("title") or "未知岗位"

        # 创建 report 记录
        report = CareerReport(
            student_id=student_id,
            status="generating",
            chapters_done=0,
        )
        db.add(report)
        await db.commit()
        await db.refresh(report)

        chapter_configs = [
            (1, CHAPTER_1_PROMPT, False),
            (2, CHAPTER_2_PROMPT, True),
            (3, CHAPTER_3_PROMPT, True),
            (4, CHAPTER_4_PROMPT, True),
            (5, CHAPTER_5_PROMPT, False),
        ]

        action_summary = ""

        for ch_num, prompt_tpl, has_json in chapter_configs:
            try:
                prompt_vars = self._prepare_vars(
                    ch_num, student_profile, job_profile,
                    matching_result, related_jobs, action_summary,
                )
                prompt = prompt_tpl.format(**prompt_vars)
                raw = await self.llm.generate_text(
                    system_prompt=REPORT_SYSTEM_PROMPT,
                    user_prompt=prompt,
                    temperature=0.4,
                    max_tokens=1500,
                )
            except Exception as e:
                logger.error(f"Chapter {ch_num} LLM call failed: {e}")
                report.status = "failed"
                await db.commit()
                raise

            if has_json:
                text, json_data = self._split_text_and_json(raw)
            else:
                text, json_data = raw.strip(), None

            setattr(report, f"chapter_{ch_num}_text", text)
            if json_data:
                setattr(report, f"chapter_{ch_num}_data", json_data)
                # 第三章行动计划保存给第五章使用
                if ch_num == 3:
                    action_summary = self._extract_action_summary(json_data)

            report.chapters_done = ch_num
            await db.commit()
            logger.info(f"Report {report.id}: chapter {ch_num} done")

        report.status = "done"
        await db.commit()
        await db.refresh(report)
        return report

    # ------------------------------------------------------------------
    # 内部辅助
    # ------------------------------------------------------------------

    def _prepare_vars(
        self,
        ch_num: int,
        sp: dict,
        jp: dict,
        mr: dict,
        related_jobs: list[dict],
        action_summary: str,
    ) -> dict:
        """为每章 prompt 准备变量。"""
        job_title = jp.get("role_name") or jp.get("title") or "未知岗位"
        scores = mr.get("scores_json", {})
        gap_items = mr.get("gap_items", [])[:6]
        total_score = mr.get("total_score", 0)

        skills_list = [
            s.get("skill_name", s) if isinstance(s, dict) else str(s)
            for s in sp.get("skills", [])
        ]
        internships_list = [
            f"{i.get('company','未知')} · {i.get('title','')}"
            if isinstance(i, dict) else str(i)
            for i in sp.get("internships", [])[:3]
        ]
        projects_list = [
            p.get("project_name", str(p)) if isinstance(p, dict) else str(p)
            for p in sp.get("projects", [])[:3]
        ]
        certs = [
            c.get("name", str(c)) if isinstance(c, dict) else str(c)
            for c in sp.get("certificates", [])[:5]
        ]
        soft_skills = [
            s.get("name", str(s)) if isinstance(s, dict) else str(s)
            for s in sp.get("soft_skills", [])[:5]
        ]

        highlights = [g.get("highlight", "") for g in gap_items if g.get("is_match")][:3]
        gaps = [g.get("item", g.get("skill_name", "")) for g in gap_items if not g.get("is_match")][:3]

        gap_list_str = "\n".join(
            f"- {g.get('item', g.get('skill_name','未知'))}: 影响 {g.get('score_impact', 0)} 分"
            for g in gap_items
        ) or "无明显差距"

        related_summary = ", ".join(
            f"{j.get('role_name') or j.get('title', '未知')}（重叠 {j.get('skill_overlap', 0):.0%}）"
            for j in related_jobs[:3]
        ) or "暂无"

        main_gaps = ", ".join(gaps) or "无"
        action_sum = action_summary or "已列出具体行动项"

        return {
            # 第一章
            "name": sp.get("name", "同学"),
            "school": f"{sp.get('school', '未知')} · {sp.get('major', '')} · {sp.get('grade', '')}",
            "overall_score": total_score,
            "percentile": max(1, 100 - total_score),
            "top_skills": "、".join(skills_list[:5]) or "未知",
            "internships": "；".join(internships_list) or "无实习经历",
            "projects": "；".join(projects_list) or "无项目经历",
            "certificates": "、".join(certs) or "无",
            "soft_skills": "、".join(soft_skills) or "未知",
            "target_job_name": job_title,
            # 第二章
            "basic_score": scores.get("basic", scores.get("basic_requirements", 0)),
            "skills_score": scores.get("skills", scores.get("technical_skills", 0)),
            "competency_score": scores.get("competency", scores.get("professional_competency", 0)),
            "potential_score": scores.get("potential", scores.get("development_potential", 0)),
            "match_highlights": "、".join(highlights) or "技能匹配度较高",
            "main_gaps": main_gaps,
            # 第三章
            "gap_list": gap_list_str,
            "student_skills": "、".join(skills_list[:8]) or "未知",
            # 第四章
            "student_summary": f"{sp.get('name','同学')}，{sp.get('school','未知')}，综合得分 {total_score}",
            "related_jobs": related_summary,
            # 第五章
            "action_summary": action_sum,
        }

    @staticmethod
    def _split_text_and_json(raw: str) -> tuple[str, str | None]:
        """从 LLM 输出中分离正文和 JSON 块。"""
        json_match = re.search(r'```json\s*([\s\S]*?)\s*```', raw)
        if not json_match:
            return raw.strip(), None
        json_str = json_match.group(1).strip()
        text = raw[:json_match.start()].strip()
        return text, json_str

    @staticmethod
    def _extract_action_summary(json_str: str) -> str:
        """从第三章 JSON 中提取行动摘要给第五章用。"""
        try:
            items = json.loads(json_str)
            if isinstance(items, list):
                return "；".join(
                    f"{it.get('item','')}: {it.get('action','')}"
                    for it in items[:3]
                )
        except Exception:
            pass
        return ""
