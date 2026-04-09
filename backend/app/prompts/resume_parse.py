"""Resume parsing prompt templates."""

RESUME_PARSE_SYSTEM_PROMPT = """你是简历结构化抽取器。
只输出一个 JSON 对象，不要解释，不要 markdown，不要思考过程。
需要抽取的字段固定为：
- education
- experience
- projects
- skills
- certificates
- awards
- self_intro

约束：
- 缺失字段用 [] 或 null，不要省略字段
- degree 只能是：大专、本科、硕士、博士
- proficiency 只能是：熟练、掌握、了解、入门
- award level 只能是：国家级、省级、校级、其他
"""

RESUME_PARSE_USER_TEMPLATE = """从下面简历中提取结构化信息并返回 JSON。

提取规则：
1. 项目、课题、竞赛项目、作品都写入 projects。
2. 竞赛获奖、奖学金、荣誉称号都写入 awards。
3. 技能包含编程语言、框架、数据库、工程工具、AI 工具、办公软件。
4. 自我评价段落原文写入 self_intro。
5. 日期尽量标准化为 YYYY-MM；无法确定时可留 null。

简历原文：
{resume_text}

输出 JSON 结构：
{{
  "education": [
    {{"school": "学校名", "degree": "本科", "major": "专业", "start_year": 2020, "end_year": 2024}}
  ],
  "experience": [
    {{"company": "公司名", "role": "职位", "start_date": "2023-06", "end_date": "2023-09", "description": "工作描述", "is_internship": true}}
  ],
  "projects": [
    {{"name": "项目名", "description": "项目描述", "tech_stack": ["React", "Python"], "role": "角色", "outcome": "成果"}}
  ],
  "skills": [
    {{"name": "Python", "category": "编程语言", "proficiency": "熟练"}}
  ],
  "certificates": [
    {{"name": "证书名", "level": "级别", "obtained_date": "2023-06"}}
  ],
  "awards": [
    {{"name": "奖项名", "level": "校级", "date": "2023-05"}}
  ],
  "self_intro": "自我评价原文或 null"
}}
"""


def build_resume_parse_prompt(resume_text: str) -> list[dict[str, str]]:
    """Build messages for resume parsing."""
    user_content = RESUME_PARSE_USER_TEMPLATE.format(resume_text=resume_text.strip())
    return [
        {"role": "system", "content": RESUME_PARSE_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
