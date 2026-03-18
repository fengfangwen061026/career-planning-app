"""Job profile generation prompt templates (V3 - 8 fields).

Input: Role name + up to 10 representative JD texts
Output: JobProfile JSON conforming to the 8-field schema
"""

JOB_PROFILE_SYSTEM_PROMPT_V3 = """\
你是一名职业画像分析专家。请根据提供的岗位招聘数据，生成标准化的岗位画像 JSON。

重要要求：你必须严格输出符合给定 JSON Schema 的 JSON，不要输出任何额外文字。

### Schema 说明

```json
{
  "role_name": "string",
  "summary": "string - 岗位一句话概述，100字以内",
  "basic_requirements": {
    "education": "大专及以上|本科及以上|硕士及以上|博士及以上|不限",
    "majors": ["string"],
    "experience_years": {"min": number, "preferred": number},
    "certifications": [{"name": "string", "required": boolean}]
  },
  "technical_skills": [
    {
      "skill_name": "string",
      "category": "string",
      "importance": "required|preferred|bonus",
      "weight": "0.0-1.0 number",
      "proficiency_evidence": "string"
    }
  ],
  "soft_competencies": {
    "communication": {"value": "1-5 integer", "evidence": "string"},
    "teamwork": {"value": "1-5 integer", "evidence": "string"},
    "stress_tolerance": {"value": "1-5 integer", "evidence": "string"},
    "innovation": {"value": "1-5 integer", "evidence": "string"},
    "learning_ability": {"value": "1-5 integer", "evidence": "string"}
  },
  "development_potential": "string - 发展潜力描述，100字以内，仅做画像说明，不影响评分",
  "salary_range": {
    "entry_level": "string",
    "experienced": "string",
    "senior": "string"
  },
  "evidence_summary": "string"
}
```

### 字段约束

1. `soft_competencies.*.value` 必须是 1-5 的整数。
2. `soft_competencies.*.value` 的含义是：5=该岗位核心要求，1=几乎不要求。
3. `technical_skills[*].weight` 必须是 0.0-1.0 之间的小数，用于表示技能相对权重。
4. `development_potential` 只保留简短总结，不要输出对象结构。

### 输出要求

1. 必须严格输出符合 JSON Schema 的 JSON。
2. 所有技能名称优先使用中文，常见英文缩写可保留，如 `Python`、`SQL`、`Vue.js`。
3. 每个字段都要尽量基于 JD 证据，不得臆造 JD 中未出现的要求。
4. 只输出 JSON，不要包含 Markdown、解释或其他前后缀。
"""


def build_job_profile_prompt(role_name: str, jd_texts: list[str]) -> list[dict[str, str]]:
    """Build messages for job profile generation (V3)."""
    jd_sections: list[str] = []
    for i, jd in enumerate(jd_texts[:10], start=1):
        jd_sections.append(f"--- JD #{i} ---\n{jd.strip()}")

    example_output = """{
  "role_name": "数据分析师",
  "summary": "负责业务数据分析、报表搭建和洞察输出，支撑产品与运营决策。",
  "basic_requirements": {
    "education": "本科及以上",
    "majors": ["统计学", "数学", "计算机", "信息管理"],
    "experience_years": {"min": 1, "preferred": 3},
    "certifications": [{"name": "数据分析相关证书", "required": false}]
  },
  "technical_skills": [
    {
      "skill_name": "SQL",
      "category": "数据分析",
      "importance": "required",
      "weight": 0.85,
      "proficiency_evidence": "多条JD明确要求能够独立完成SQL查询、报表统计和数据提取。"
    }
  ],
  "soft_competencies": {
    "communication": {"value": 4, "evidence": "需要与业务、产品和运营团队沟通分析结论。"},
    "teamwork": {"value": 4, "evidence": "岗位描述多次提到跨部门协作和需求对接。"},
    "stress_tolerance": {"value": 3, "evidence": "涉及周期性报表与临时分析需求，需承受一定时效压力。"},
    "innovation": {"value": 3, "evidence": "要求能够提出数据洞察和优化建议，但并非核心创新岗位。"},
    "learning_ability": {"value": 4, "evidence": "需要持续学习业务指标体系和分析工具。"}
  },
  "development_potential": "适合在业务分析、数据运营和策略分析方向持续成长，后续可向高级分析师发展。",
  "salary_range": {
    "entry_level": "8k-12k",
    "experienced": "12k-20k",
    "senior": "20k+"
  },
  "evidence_summary": "综合多条JD可见，该岗位以SQL分析、跨团队协作和业务洞察输出为核心。"
}"""

    user_content = f"""\
请为以下岗位角色生成结构化岗位画像（使用 8 字段 Schema）。

## 岗位角色
{role_name}

## 代表性 JD 文本（共 {len(jd_sections)} 条）

{chr(10).join(jd_sections)}

请严格按照上面的 JSON Schema 输出岗位画像。

注意：
1. `technical_skills` 是数组，每个条目包含 `skill_name`、`category`、`importance`、`weight`、`proficiency_evidence`
2. `soft_competencies` 是固定 key 的对象，必须包含 `communication`、`teamwork`、`stress_tolerance`、`innovation`、`learning_ability`
3. `soft_competencies.*.value` 必须输出 1-5 整数，不要再输出 `importance`
4. 不要输出 `soft_skills`（旧字段），应使用 `soft_competencies`
5. `development_potential` 输出 100 字以内字符串，不要输出 `growth_indicators` 等数组

下面是一个完整输出示例，请参考字段格式：

```json
{example_output}
```"""

    return [
        {"role": "system", "content": JOB_PROFILE_SYSTEM_PROMPT_V3},
        {"role": "user", "content": user_content},
    ]
