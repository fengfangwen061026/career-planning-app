"""Report prompt templates - 职业规划报告生成."""
import json


# ── 报告纲要生成 Prompt ────────────────────────────────────────────

OUTLINE_SYSTEM_PROMPT = """你是一位资深的职业规划顾问。你需要根据学生画像、匹配结果和职业路径规划，生成结构化的报告纲要。

报告结构要求（固定5章）：
1. self_analysis - 个人分析与画像
2. target_matching - 目标岗位匹配分析
3. gap_analysis - 能力差距分析
4. career_path - 职业发展路径
5. action_plan - 行动计划与评估

你必须返回严格的 JSON 格式，不要包含任何其他内容。"""

OUTLINE_USER_TEMPLATE = """请根据以下信息生成职业规划报告的章节纲要。

学生画像：
{student_profile}

匹配结果：
{matching_result}

职业路径规划：
{career_path}

请返回 JSON 格式：
{{
  "chapters": [
    {{
      "id": "self_analysis",
      "title": "个人分析与画像",
      "key_points": ["要点1", "要点2", ...]
    }},
    {{
      "id": "target_matching",
      "title": "目标岗位匹配分析",
      "key_points": ["要点1", "要点2", ...]
    }},
    {{
      "id": "gap_analysis",
      "title": "能力差距分析",
      "key_points": ["要点1", "要点2", ...]
    }},
    {{
      "id": "career_path",
      "title": "职业发展路径",
      "key_points": ["要点1", "要点2", ...]
    }},
    {{
      "id": "action_plan",
      "title": "行动计划与评估",
      "key_points": ["要点1", "要点2", ...]
    }}
  ]
}}"""


# ── 逐章节内容生成 Prompt ───────────────────────────────────────────

CHAPTER_CONTENT_SYSTEM_PROMPT = """你是一位资深的职业规划顾问，精通报告撰写。你需要根据给定的章节纲要，生成专业的章节内容。

要求：
1. 内容必须基于提供的画像数据和匹配结果
2. 每个章节包含 title（标题）、sections（段落列表）、tables（表格配置）、charts（图表配置）
3. tables 和 charts 为空列表时表示该章节不需要
4. 不要编造数据，所有数据必须来自输入信息
5. 语言专业、客观、鼓励性

你必须返回严格的 JSON 格式。"""

CHAPTER_CONTENT_USER_TEMPLATE = """请生成报告章节「{chapter_title}」的详细内容。

章节 ID：{chapter_id}
章节标题：{chapter_title}
需要覆盖的关键点：{key_points}

学生画像：
{student_profile}

匹配结果：
{matching_result}

职业路径规划：
{career_path}

请返回 JSON 格式：
{{
  "title": "{chapter_title}",
  "sections": [
    {{
      "heading": "小节标题",
      "content": "小节内容，200-500字"
    }},
    ...
  ],
  "tables": [
    {{
      "title": "表格标题",
      "headers": ["列1", "列2", ...],
      "rows": [["行1列1", "行1列2", ...], ...]
    }}
  ],
  "charts": [
    {{
      "type": "bar|line|pie|radar",
      "title": "图表标题",
      "data": {{"labels": [...], "datasets": [{{"label": "...", "data": [...]}}]}}
    }}
  ]
}}"""


# ── 内容润色 Prompt ────────────────────────────────────────────────

POLISH_SYSTEM_PROMPT = """你是一位专业的文字编辑和内容润色专家。你需要改进报告内容的措辞和表达，使其更加专业、流畅、有说服力。

原则：
1. 只改写措辞，不改变任何事实和数据
2. 保持原文的核心意思不变
3. 提升语言的专业性和可读性
4. 适当增加鼓励性语言，增强学生的信心

你必须返回严格的 JSON 格式。"""

POLISH_USER_TEMPLATE = """请润色以下职业规划报告内容。

原始内容：
{original_content}

请返回 JSON 格式：
{{
  "polished_content": "润色后的完整内容",
  "changes": [
    {{
      "original": "原始表述",
      "polished": "润色后表述",
      "reason": "修改原因"
    }},
    ...
  ]
}}"""


# ── 完整性检查 Prompt ───────────────────────────────────────────────

COMPLETENESS_SYSTEM_PROMPT = """你是一位资深的职业规划质量审核专家。你需要检查职业规划报告的完整性和质量，发现可能缺失或不足的部分。

检查维度：
1. 内容完整性 - 是否覆盖了所有必要的分析维度
2. 数据充分性 - 是否有足够的数据支撑结论
3. 逻辑连贯性 - 各章节之间是否逻辑通顺
4. 可操作性 - 行动计划是否具体可执行
5. 专业性 - 术语使用是否准确规范

你必须返回严格的 JSON 格式。"""

COMPLETENESS_USER_TEMPLATE = """请检查以下职业规划报告的完整性。

报告内容：
{report_content}

学生画像：
{student_profile}

目标岗位：
{target_jobs}

请返回 JSON 格式：
{{
  "missing_items": [
    {{
      "chapter": "章节ID",
      "issue": "缺失或不足的具体问题",
      "severity": "high|medium|low"
    }}
  ],
  "suggestions": [
    {{
      "type": "addition|modification|deletion",
      "location": "建议修改的位置",
      "suggestion": "具体建议",
      "reason": "建议原因"
    }}
  ]
}}"""


# ── Prompt 构建函数 ───────────────────────────────────────────────

def build_outline_prompt(
    student_profile: dict,
    matching_result: dict,
    career_path: dict,
) -> list[dict[str, str]]:
    """生成报告纲要的 prompt。

    Args:
        student_profile: 学生画像数据
        matching_result: 匹配结果数据
        career_path: 职业路径规划数据

    Returns:
        支持 LLM 调用的 prompt 列表
    """
    return [
        {"role": "system", "content": OUTLINE_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": OUTLINE_USER_TEMPLATE.format(
                student_profile=json.dumps(student_profile, ensure_ascii=False, indent=2),
                matching_result=json.dumps(matching_result, ensure_ascii=False, indent=2),
                career_path=json.dumps(career_path, ensure_ascii=False, indent=2),
            ),
        },
    ]


def build_chapter_content_prompt(
    chapter_id: str,
    chapter_title: str,
    key_points: list[str],
    student_profile: dict,
    matching_result: dict,
    career_path: dict,
) -> list[dict[str, str]]:
    """生成单个章节内容的 prompt。

    Args:
        chapter_id: 章节 ID
        chapter_title: 章节标题
        key_points: 需要覆盖的关键点列表
        student_profile: 学生画像数据
        matching_result: 匹配结果数据
        career_path: 职业路径规划数据

    Returns:
        支持 LLM 调用的 prompt 列表
    """
    return [
        {"role": "system", "content": CHAPTER_CONTENT_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": CHAPTER_CONTENT_USER_TEMPLATE.format(
                chapter_id=chapter_id,
                chapter_title=chapter_title,
                key_points=json.dumps(key_points, ensure_ascii=False),
                student_profile=json.dumps(student_profile, ensure_ascii=False, indent=2),
                matching_result=json.dumps(matching_result, ensure_ascii=False, indent=2),
                career_path=json.dumps(career_path, ensure_ascii=False, indent=2),
            ),
        },
    ]


def build_polish_prompt(
    original_content: str,
) -> list[dict[str, str]]:
    """生成内容润色的 prompt。

    Args:
        original_content: 需要润色的原始内容

    Returns:
        支持 LLM 调用的 prompt 列表
    """
    return [
        {"role": "system", "content": POLISH_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": POLISH_USER_TEMPLATE.format(
                original_content=original_content,
            ),
        },
    ]


def build_completeness_prompt(
    report_content: dict,
    student_profile: dict,
    target_jobs: list[dict],
) -> list[dict[str, str]]:
    """生成完整性检查的 prompt。

    Args:
        report_content: 报告内容
        student_profile: 学生画像数据
        target_jobs: 目标岗位列表

    Returns:
        支持 LLM 调用的 prompt 列表
    """
    return [
        {"role": "system", "content": COMPLETENESS_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": COMPLETENESS_USER_TEMPLATE.format(
                report_content=json.dumps(report_content, ensure_ascii=False, indent=2),
                student_profile=json.dumps(student_profile, ensure_ascii=False, indent=2),
                target_jobs=json.dumps(target_jobs, ensure_ascii=False, indent=2),
            ),
        },
    ]
