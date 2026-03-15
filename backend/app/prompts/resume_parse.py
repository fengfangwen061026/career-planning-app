"""Resume parsing prompt templates.

This module provides simplified prompt templates for LLM-based resume parsing.
"""

RESUME_PARSE_SYSTEM_PROMPT = """你是专业的简历解析器。
从用户提供的简历原文中提取结构化信息。

规则：
- 只输出 JSON，不输出任何其他内容
- 不要加 markdown 代码块（不要加 ```json）
- 即使简历格式混乱也要尽力提取
- 没有的字段填空数组[]或null，不要省略任何字段
- evidence 字段填写简历中对应的原文片段
- proficiency 只能是以下之一：熟练、掌握、了解、入门
- degree 只能是以下之一：大专、本科、硕士、博士
- award level 只能是以下之一：国家级、省级、校级、其他
"""

RESUME_PARSE_USER_TEMPLATE = """请解析以下简历，严格按照 Schema 输出 JSON：

简历原文：
{resume_text}

输出 Schema（直接输出 JSON，不加任何说明文字）：
{{
  "education": [
    {{"school": "学校名", "degree": "本科", "major": "专业", "start_year": 2020, "end_year": 2024, "evidence": "原文片段"}}
  ],
  "experience": [
    {{"company": "公司名", "role": "职位", "start_date": "2023-06", "end_date": "2023-09", "description": "工作描述", "is_internship": true, "evidence": "原文片段"}}
  ],
  "projects": [
    {{"name": "项目名", "description": "项目描述", "tech_stack": ["React", "Python"], "role": "角色", "outcome": "成果", "evidence": "原文片段"}}
  ],
  "skills": [
    {{"name": "Python", "category": "编程语言", "proficiency": "熟练", "evidence": "原文片段"}}
  ],
  "certificates": [
    {{"name": "证书名", "level": "级别", "obtained_date": "2023-06", "evidence": "原文片段"}}
  ],
  "awards": [
    {{"name": "奖项名", "level": "校级", "date": "2023-05", "evidence": "原文片段"}}
  ],
  "self_intro": "自我评价原文或null",
  "parse_confidence": 0.8,
  "missing_fields": []
}}
"""


def build_resume_parse_prompt(resume_text: str) -> list[dict[str, str]]:
    """Build messages for resume parsing.

    Args:
        resume_text: Raw resume text (extracted from DOCX/PDF/etc.)

    Returns:
        List of message dicts ready for LLM call.
    """
    user_content = RESUME_PARSE_USER_TEMPLATE.format(resume_text=resume_text.strip())

    return [
        {"role": "system", "content": RESUME_PARSE_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
