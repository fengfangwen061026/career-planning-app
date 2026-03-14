"""Matching prompt templates - 四维度人岗匹配评分."""
import json


# ── 职业素养评估 Prompt ───────────────────────────────────────────

COMPETENCY_SYSTEM_PROMPT = """你是一位资深的人才测评专家。你需要根据学生的项目经历、实习经历等描述，客观评估其职业素养。

评估维度：
1. communication - 沟通能力
2. teamwork - 团队协作
3. stress_tolerance - 抗压能力
4. innovation - 创新能力
5. learning_ability - 学习能力

评分规则：
- 每项 0-100 分
- 必须有证据支撑，从经历描述中找到具体依据
- 没有证据的维度，该项打分不超过 40，且 confidence 设为 0.3
- confidence 范围 0-1，反映证据充分程度

你必须返回严格的 JSON 格式。"""

COMPETENCY_USER_TEMPLATE = """请根据以下学生画像信息，评估其职业素养。

学生画像：
{student_profile}

岗位要求的素养权重参考（仅供参考，评估以事实为准）：
{job_competency_requirements}

请返回 JSON，格式：
{{
  "items": [
    {{
      "dimension": "communication",
      "score": 75,
      "evidence": "在 XX 项目中担任对接客户的角色，独立完成需求沟通",
      "confidence": 0.8
    }},
    ...
  ]
}}"""


# ── 发展潜力评估 Prompt ───────────────────────────────────────────

POTENTIAL_SYSTEM_PROMPT = """你是一位资深的人才发展专家。你需要根据学生的学习轨迹、项目经验等，评估其发展潜力。

评估维度：
1. growth_trajectory - 成长轨迹（学习速度、技能迭代频率）
2. self_driven - 自驱力（自学项目、开源贡献、竞赛获奖等自发行为）
3. learning_speed - 学习能力（跨领域学习、快速上手新技术的证据）
4. adaptability - 适应能力（跨行业经验、角色转换能力）

评分规则：
- 每项 0-100 分
- 必须有证据支撑
- 没有足够证据时保守打分（不超过 50），绝不编造证据
- confidence 范围 0-1

你必须返回严格的 JSON 格式。"""

POTENTIAL_USER_TEMPLATE = """请根据以下学生画像信息，评估其发展潜力。

学生画像：
{student_profile}

请返回 JSON，格式：
{{
  "items": [
    {{
      "dimension": "growth_trajectory",
      "score": 70,
      "evidence": "从 Python 基础到独立完成机器学习项目仅用 6 个月",
      "confidence": 0.7
    }},
    ...
  ]
}}"""


def build_competency_prompt(
    student_profile: dict,
    job_competency_requirements: dict,
) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": COMPETENCY_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": COMPETENCY_USER_TEMPLATE.format(
                student_profile=json.dumps(student_profile, ensure_ascii=False, indent=2),
                job_competency_requirements=json.dumps(job_competency_requirements, ensure_ascii=False, indent=2),
            ),
        },
    ]


def build_potential_prompt(
    student_profile: dict,
) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": POTENTIAL_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": POTENTIAL_USER_TEMPLATE.format(
                student_profile=json.dumps(student_profile, ensure_ascii=False, indent=2),
            ),
        },
    ]
