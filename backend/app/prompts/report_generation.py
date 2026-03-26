# backend/app/prompts/report_generation.py
"""
报告生成 Prompt 模板
每章独立生成，按顺序调用。
输出规范：纯文字段落 + 末尾（如需）一个 JSON 块，JSON 用 ```json ``` 包裹。
前端按章节分别解析正文和 JSON。
"""

REPORT_SYSTEM_PROMPT = """你是一个专业的大学生职业规划顾问，语言风格专业但亲切。

核心要求：
1. 内容必须基于提供的实际数据，禁止编造不存在的技能或经历
2. 建议必须具体可操作，禁止空话套话
3. 涉及技能差距必须明确：缺什么、影响多少分、怎么补、需要多长时间
4. 除第二/三/四章末尾的结构化 JSON 外，正文全部输出纯文本，不使用 Markdown 标记符（不用 ##、**、- 等）
5. 每章正文 150–300 字，简洁有力
"""

# 第一章：个人优势总结
CHAPTER_1_PROMPT = """根据以下学生画像，生成"个人优势总结"章节正文。

要求：
- 2–3 段纯文字，共 150–250 字
- 第一段：总体定位一句话（学校/专业/竞争力分位）
- 第二段：列举 3 个核心优势，每个优势必须附上简历中的具体证据
- 第三段：指出与目标岗位最匹配的 1–2 个优势��
- 禁止使用列表符号，全部写成自然段落

学生画像：
姓名：{name}
学校/专业/年级：{school}
综合竞争力：{overall_score}/100，同类 Top {percentile}%
技能（前5）：{top_skills}
实习经历：{internships}
项目经历：{projects}
证书/奖项：{certificates}
软素养：{soft_skills}

目标岗位：{target_job_name}
"""

# 第二章：目标岗位分析
CHAPTER_2_PROMPT = """根据以下匹配数据，生成"目标岗位分析"章节。

输出格式（严格遵守）：
[正文段落，100–150字，说明岗位核心要求和综合匹配情况]

```json
{{
  "overall_score": 数字,
  "dimensions": {{
    "basic": {{"score": 数字, "reason": "一句话说明得失分原因"}},
    "skills": {{"score": 数字, "reason": "一句话"}},
    "competency": {{"score": 数字, "reason": "一句话"}},
    "potential": {{"score": 数字, "reason": "一句话"}}
  }}
}}
```

匹配数据：
目标岗位：{target_job_name}
综合匹配分：{overall_score}
四维分数：基础要求 {basic_score} / 技术技能 {skills_score} / 职业素养 {competency_score} / 发展潜力 {potential_score}
匹配亮点：{match_highlights}
主要差距：{main_gaps}
"""

# 第三章：差距与行动计划
CHAPTER_3_PROMPT = """根据以下差距清单，生成"差距与行动计划"章节。

输出格式（严格遵守）：
[正文引言，50–80字，总结主要差距]

```json
[
  {{
    "priority": "必须补齐",
    "item": "差距项名称",
    "gap_desc": "缺什么",
    "score_impact": -数字,
    "action": "具体行动（一句话）",
    "timeline": "X周/月内"
  }}
]
```

优先级规则：
- "必须补齐"：必备技能缺失，影响 ≥ 10分
- "建议提升"：加分项缺口，影响 < 10分

差距清单：
{gap_list}

学生当前技能：
{student_skills}
"""

# 第四章：职业路径规划
CHAPTER_4_PROMPT = """根据以下信息，生成"职业路径规划"章节。

输出格式（严格遵守）：
[正文引言，50–80字，说明推荐主路径和理由]

```json
{{
  "primary_path": [
    {{
      "stage": "现在",
      "title": "{target_job_name}（初级）",
      "condition": "需要完成的事项（一句话）",
      "is_current": true
    }},
    {{
      "stage": "2年后",
      "title": "岗位名（中级）",
      "condition": "需要掌握的能力",
      "is_current": false
    }},
    {{
      "stage": "5年+",
      "title": "岗位名（高级/负责人）",
      "condition": "需要掌握的能力",
      "is_current": false
    }}
  ],
  "alt_paths": [
    {{
      "title": "可转岗位名",
      "skill_overlap": 数字,
      "gap_skills": ["缺失技能1", "缺失技能2"]
    }}
  ]
}}
```

学生画像摘要：{student_summary}
目标岗位：{target_job_name}
可选相关岗位：{related_jobs}
学生主要技能：{student_skills}
"""

# 第五章：评估周期
CHAPTER_5_PROMPT = """根据以下行动计划，生成"评估周期"章节正文。

要求：
- 2 段纯文字，共 100–150 字
- 第一段：建议 3 个月自评一次，给出 3 个具体的短期检查点（直接写在句子里，不用列表符号）
- 第二段：6 个月后建议重新上传简历重新匹配，说明意义
- 禁止使用任何列表符号

行动计划摘要：{action_summary}
主要差距项：{main_gaps}
"""
