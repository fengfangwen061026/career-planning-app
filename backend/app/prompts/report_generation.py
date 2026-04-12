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
4. 除第二/三/四/五章末尾的结构化 JSON 外，正文全部输出纯文本，不使用 Markdown 标记符（不用 ##、**、- 等）
5. 每章正文 150–300 字，简洁有力
6. 技能提升时长参考标准：初级技能（如 Redis 基础）1–3周，中级技能（如微服务架构）1–3个月，高级技能（如分布式系统设计）3–6个月。禁止给出"持续学习"此类无时限表述
7. 所有 JSON 中的数字字段必须是数字类型，不得是字符串
"""

# 第一章：个人优势总结
CHAPTER_1_PROMPT = """根据以下学生画像，生成"个人优势总结"章节正文。

要求：
- 2–3 段纯文字，共 150–250 字
- 第一段：总体定位一句话（学校/专业/竞争力分位）
- 第二段：列举 3 个核心优势，每个优势必须附上简历中的具体证据
- 第三段：指出与目标岗位最匹配的 1–2 个优势点
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
[正文引言，50–80字，概述总体情况，说明补齐后综合分可提升多少]

```json
{{
  "short_term": [
    {{
      "priority": "必须补齐",
      "item": "差距项名称",
      "gap_desc": "缺什么",
      "score_impact": -数字,
      "action": "具体行动（一句话，包含资源来源，如'通过官方文档+实战项目'）",
      "timeline": "X周内",
      "resources": ["推荐学习路径1", "推荐学习路径2"]
    }}
  ],
  "medium_term": [
    {{
      "priority": "建议提升",
      "item": "提升项名称",
      "gap_desc": "为什么要提升",
      "score_impact": 数字,
      "action": "具体行动",
      "timeline": "6–18个月内",
      "resources": ["推荐路径"]
    }}
  ]
}}
```

规则：
- short_term：0–6个月内可完成的必须补齐项（必备技能缺失，影响≥8分）
- medium_term：6–18个月的建议提升项（加分项，影响<8分）
- timeline 必须是具体时间（如"3周内"），禁止写"持续学习"或"长期坚持"
- resources 给出 1–2 个具体推荐（如"菜鸟教程Redis文档"、"GitHub上的XXX实战项目"）
- 每个时期最多 4 条

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
CHAPTER_5_PROMPT = """根据以下行动计划，生成"评估周期"章节。

输出格式（严格遵守）：
[正文，100–150字，说明评估意义，建议3个月一次自评，6个月后重新匹配]

```json
{
  "review_checkpoints": [
    {
      "month": 1,
      "goal": "完成X技能学习",
      "kpi": "能独立完成一个XX项目/通过XX测试",
      "action": "具体验证方式"
    },
    {
      "month": 3,
      "goal": "综合分提升至XX分",
      "kpi": "重新运行匹配系统，分数达到XX",
      "action": "重新上传更新后的简历"
    },
    {
      "month": 6,
      "goal": "完成中期目标",
      "kpi": "获得实习机会或参与XX类项目",
      "action": "更新简历，重新运行完整匹配"
    }
  ]
}
```

注意：
- month 的 goal 和 kpi 必须基于第三章的行动计划，不得凭空捏造
- kpi 必须是可量化的（有具体数字或可验证的标准）
- 禁止写"持续努力"、"保持学习"等不可量化的 kpi

行动计划摘要：{action_summary}
主要差距项：{main_gaps}
"""


REPORT_POLISH_SYSTEM_PROMPT = """你是一位资深职业规划顾问和求职文案编辑。

你的任务不是重写报告结构，而是在不改变事实的前提下，润色摘要和五章正文。

硬性约束：
1. 只能基于输入数据改写，禁止编造不存在的经历、技能、分数、公司、项目、岗位要求。
2. 不得修改报告结构，不得新增、删除或调整章节。
3. 不得修改四维分数、行动项、路径节点、推荐建议，只能改写摘要和章节正文。
4. 语言要更自然、更像职业顾问写给学生的正式报告，避免模板腔和重复句式。
5. 每章正文控制在 90-220 字，摘要控制在 60-140 字。
6. 只输出 JSON 对象，不要解释，不要 Markdown。
"""


REPORT_POLISH_USER_TEMPLATE = """请润色这份职业发展报告的摘要和五章正文。

请参考以下事实数据：
{report_context}

输出 JSON 格式如下：
{{
  "summary": "润色后的摘要",
  "chapters": [
    {{"chapter_id": 1, "text": "润色后的第一章正文"}},
    {{"chapter_id": 2, "text": "润色后的第二章正文"}},
    {{"chapter_id": 3, "text": "润色后的第三章正文"}},
    {{"chapter_id": 4, "text": "润色后的第四章正文"}},
    {{"chapter_id": 5, "text": "润色后的第五章正文"}}
  ]
}}
"""
