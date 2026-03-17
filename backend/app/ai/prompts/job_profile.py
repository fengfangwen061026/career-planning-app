"""Job profile generation prompt templates (V3 - 8 fields).

Input:  Role name + up to 10 representative JD texts
Output: JobProfile JSON conforming to new 8-field schema
"""

JOB_PROFILE_SYSTEM_PROMPT_V3 = """\
你是一个职业数据分析专家。根据提供的岗位招聘数据，生成标准化的岗位画像JSON。

## 重要：你必须严格输出符合给定 JSON Schema 的结构，不输出任何额外文字

### Schema 说明

```json
{
  "role_name": "string",
  "summary": "string - 岗位一句话描述，50字以内",
  "basic_requirements": {
    "education": "大专及以上|本科及以上|硕士及以上|博士及以上|不限",
    "majors": ["string"],
    "experience_years": {"min": number, "preferred": number},
    "certifications": [{"name": "string", "required": boolean}]
  },
  "technical_skills": [
    {"name": "string", "category": "string", "importance": "必备|加分|了解即可", "frequency_pct": number}
  ],
  "soft_skills": [
    {"name": "string", "importance": "核心素养|重要|一般", "evidence": "string"}
  ],
  "development_potential": {
    "growth_indicators": ["string"],
    "learning_requirements": ["string"],
    "innovation_signals": ["string"]
  },
  "salary_range": {
    "entry_level": "string",
    "experienced": "string",
    "senior": "string"
  },
  "evidence_summary": "string"
}
```

## 输出要求

1. 必须严格输出符合 JSON Schema 的结构
2. 所有技能名称使用中文，英文缩写保留（如 Python、SQL、Vue.js）
3. 每个字段必须有 evidence 来源依据
4. 不得编造在 JD 样本中未出现的技能或要求

仅输出 JSON，不要包含任何其他文字。"""


def build_job_profile_prompt(role_name: str, jd_texts: list[str]) -> list[dict[str, str]]:
    """Build messages for job profile generation (V3).

    Args:
        role_name: Normalized role name (e.g. "软件测试")
        jd_texts: Up to 10 representative JD texts for this role

    Returns:
        List of message dicts ready for LLM call.
    """
    jd_sections: list[str] = []
    for i, jd in enumerate(jd_texts[:10], start=1):
        jd_sections.append(f"--- JD #{i} ---\n{jd.strip()}")

    user_content = f"""\
请为以下岗位角色生成结构化岗位画像（使用8字段Schema）。

## 岗位角色
{role_name}

## 代表性 JD 文本（共 {len(jd_sections)} 条）

{chr(10).join(jd_sections)}

请严格按照上面的JSON Schema输出岗位画像。
注意：
1. technical_skills 是数组，每个技能包含 name, category, importance, frequency_pct
2. soft_skills 是数组，每个技能包含 name, importance, evidence
3. 不要输出 certificates, job_responsibilities, benefits 等旧字段"""

    return [
        {"role": "system", "content": JOB_PROFILE_SYSTEM_PROMPT_V3},
        {"role": "user", "content": user_content},
    ]
