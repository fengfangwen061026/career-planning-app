# backend/app/services/job_transition.py
import asyncio
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.job_transition import JobTransition


class JobTransitionService:
    """基于技能重叠度计算岗位间换岗关系"""

    async def compute_all_transitions(self, db: AsyncSession) -> dict:
        """
        计算所有岗位画像之间的换岗关系。
        返回统计摘要。
        """
        # 1. 获取所有岗位画像
        from app.models.job import JobProfile as JobProfileModel
        result = await db.execute(select(JobProfileModel))
        profiles = result.scalars().all()

        if len(profiles) < 2:
            return {"error": "岗位画像数量不足，至少需要2个"}

        # 2. 提取每个岗位的技能集
        job_skills = {}  # {profile_id: {"name": str, "skills": set}}
        for p in profiles:
            profile_json = p.profile_json if hasattr(p, 'profile_json') else {}
            if isinstance(profile_json, str):
                import json
                profile_json = json.loads(profile_json)

            # 尝试多种可能的技能字段名
            skills = set()
            for field in ['required_skills', 'skills', 'technical_skills', 'core_skills']:
                raw = profile_json.get(field, [])
                if isinstance(raw, list):
                    for item in raw:
                        if isinstance(item, str):
                            skills.add(item.lower().strip())
                        elif isinstance(item, dict):
                            # 支持多种字段名: name, skill, skill_name
                            name = item.get('name', item.get('skill', item.get('skill_name', '')))
                            if name:
                                skills.add(name.lower().strip())

            # 也收集 bonus_skills / preferred_skills
            for field in ['bonus_skills', 'preferred_skills', 'nice_to_have']:
                raw = profile_json.get(field, [])
                if isinstance(raw, list):
                    for item in raw:
                        if isinstance(item, str):
                            skills.add(item.lower().strip())
                        elif isinstance(item, dict):
                            name = item.get('name', item.get('skill', item.get('skill_name', '')))
                            if name:
                                skills.add(name.lower().strip())

            role_name = getattr(p, 'role_name', None) or profile_json.get('role_name', f'岗位{p.id}')
            job_skills[p.id] = {"name": role_name, "skills": skills, "profile_json": profile_json}

        # 3. 清除旧数据
        await db.execute(delete(JobTransition))
        await db.commit()

        # 4. 两两计算
        transitions = []
        ids = list(job_skills.keys())

        for i, src_id in enumerate(ids):
            src = job_skills[src_id]
            if not src["skills"]:
                continue

            candidates = []
            for j, tgt_id in enumerate(ids):
                if src_id == tgt_id:
                    continue
                tgt = job_skills[tgt_id]
                if not tgt["skills"]:
                    continue

                shared = src["skills"] & tgt["skills"]
                gap = tgt["skills"] - src["skills"]
                transferable = src["skills"] - tgt["skills"]

                if len(tgt["skills"]) == 0:
                    overlap = 0.0
                else:
                    overlap = len(shared) / len(tgt["skills"])

                # 转岗难度 = 缺口技能数 / 目标技能总数
                difficulty = len(gap) / max(len(tgt["skills"]), 1)

                candidates.append({
                    "target_id": tgt_id,
                    "target_name": tgt["name"],
                    "overlap": round(overlap, 3),
                    "difficulty": round(difficulty, 3),
                    "shared": list(shared)[:20],
                    "gap": list(gap)[:15],
                    "transferable": list(transferable)[:10],
                })

            # 按重叠度排序，取 top 3（保证每个岗位至少 2 条换岗路径）
            candidates.sort(key=lambda x: x["overlap"], reverse=True)
            top_candidates = candidates[:3]

            for c in top_candidates:
                if c["overlap"] < 0.1:  # 重叠度太低的不记录
                    continue

                advice = self._generate_advice(src["name"], c["target_name"], c["shared"], c["gap"])

                transition = JobTransition(
                    source_job_profile_id=src_id,
                    target_job_profile_id=c["target_id"],
                    source_role_name=src["name"],
                    target_role_name=c["target_name"],
                    skill_overlap_ratio=c["overlap"],
                    transition_difficulty=c["difficulty"],
                    shared_skills=c["shared"],
                    gap_skills=c["gap"],
                    transferable_skills=c["transferable"],
                    transition_advice=advice,
                )
                db.add(transition)
                transitions.append(transition)

        await db.commit()

        return {
            "total_transitions": len(transitions),
            "total_profiles": len(profiles),
            "message": f"已生成 {len(transitions)} 条换岗路径",
        }

    def _generate_advice(self, src: str, tgt: str, shared: list, gap: list) -> str:
        """生成一句话转岗建议"""
        if not gap:
            return f"从{src}转到{tgt}几乎不需要额外学习，技能高度重合"
        gap_str = "、".join(gap[:3])
        if len(gap) > 3:
            gap_str += f"等{len(gap)}项技能"
        return f"从{src}转{tgt}，需补充{gap_str}"

    async def get_transitions_for_job(self, job_profile_id: UUID, db: AsyncSession) -> list:
        """获取某岗位的所有换岗路径"""
        result = await db.execute(
            select(JobTransition).where(
                JobTransition.source_job_profile_id == job_profile_id
            ).order_by(JobTransition.skill_overlap_ratio.desc())
        )
        return [
            {
                "id": t.id,
                "target_id": t.target_job_profile_id,
                "target_name": t.target_role_name,
                "overlap": t.skill_overlap_ratio,
                "difficulty": t.transition_difficulty,
                "shared_skills": t.shared_skills,
                "gap_skills": t.gap_skills,
                "advice": t.transition_advice,
            }
            for t in result.scalars().all()
        ]

    async def get_all_transitions(self, db: AsyncSession) -> list:
        """获取所有换岗关系（用于图谱渲染）"""
        result = await db.execute(
            select(JobTransition).order_by(JobTransition.skill_overlap_ratio.desc())
        )
        return [
            {
                "source_id": str(t.source_job_profile_id),
                "source_name": t.source_role_name,
                "target_id": str(t.target_job_profile_id),
                "target_name": t.target_role_name,
                "overlap": t.skill_overlap_ratio,
                "difficulty": t.transition_difficulty,
                "shared_skills": t.shared_skills,
                "gap_skills": t.gap_skills,
                "advice": t.transition_advice,
            }
            for t in result.scalars().all()
        ]
