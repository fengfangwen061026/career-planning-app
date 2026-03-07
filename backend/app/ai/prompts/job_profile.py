"""Job profile generation prompt templates (V2 - 7 categories).

Input:  Role name + up to 10 representative JD texts
Output: JobProfile JSON conforming to new 7-category schema
"""

JOB_PROFILE_SYSTEM_PROMPT_V2 = """\
你是一位资深的人力资源分析专家。你的任务是根据给定的岗位角色名称和多条代表性 JD（岗位描述）文本，
生成一份结构化的岗位画像 JSON。

## 重要：你必须严格区分以下7个类别

### 类别1: basic_requirements（基础要求）
结构化硬性门槛：学历、专业方向、经验年限、语言要求、工作地点
- 从JD中提取统计分布，不要只输出单一值
- 输出格式示例：
```json
{
  "education": {"本科": 0.82, "大专": 0.12, "硕士": 0.06},
  "experience": {"不限": 0.40, "1-3年": 0.35, "3-0.20,5年":  "5年以上": 0.05},
  "majors": ["计算机", "软件工程", "电子信息"],
  "languages": [{"name": "英语四级", "frequency": 89}],
  "cities": [{"name": "北京", "count": 156}, {"name": "上海", "count": 134}]
}
```

### 类别2: technical_skills（核心技术技能）
可量化、可学习、可验证的硬技能，按以下子类别分类：
```json
{
  "programming_languages": [
    {"name": "Python", "frequency": 126, "weight": 0.65, "is_required": true}
  ],
  "frameworks_and_libraries": [
    {"name": "Selenium", "frequency": 98, "weight": 0.55, "is_required": false}
  ],
  "tools_and_platforms": [
    {"name": "Jira", "frequency": 87, "weight": 0.50, "is_required": false}
  ],
  "domain_skills": [
    {"name": "测试用例设计", "frequency": 522, "weight": 0.90, "is_required": true}
  ],
  "databases": [
    {"name": "MySQL", "frequency": 201, "weight": 0.70, "is_required": false}
  ],
  "methodologies": [
    {"name": "敏捷开发", "frequency": 45, "weight": 0.30, "is_required": false}
  ]
}
```

### 类别3: soft_skills（软素养）
- 输出格式：
```json
[
  {"name": "沟通能力", "frequency": 234, "weight": 0.75, "evidence": "良好的沟通协调能力"},
  {"name": "学习能力", "frequency": 198, "weight": 0.70, "evidence": "较强的学习能力和自驱力"}
]
```

### 类别4: certificates（证书与资质）
```json
[
  {"name": "ISTQB", "frequency": 23, "importance": "preferred"},
  {"name": "英语四级", "frequency": 89, "importance": "required"}
]
```

### 类别5: job_responsibilities（工作职责摘要）
从JD中提取5-8条核心工作职责，用简洁的动词短语描述：
```json
[
  "编写测试计划和测试用例",
  "执行功能测试、回归测试、集成测试",
  "发现、记录和跟踪Bug，推动问题解决",
  "参与需求评审和技术方案评审",
  "编写测试报告，输出测试总结"
]
```

### 类别6: benefits（福利与工作条件）
```json
[
  {"name": "五险一金", "frequency": 456},
  {"name": "带薪年假", "frequency": 234},
  {"name": "定期体检", "frequency": 123}
]
```

### 类别7: noise_blacklist（只用于清洗，不存入画像）
以下模式的词必须标记为噪音，不存入任何类别：
- JD段落标题：岗位职责、任职要求、福利待遇、五险一金等
- 招聘模板语：欢迎投递、期待加入、符合要求的
- 企业介绍模板语：公司成立于、公司位于

## 重要负面示例（这些不是技能，不要归入technical_skills）

❌ 错误分类（不要这样做）：
- "岗位职责" → 不是技能
- "任职要求" → 不是技能
- "福利待遇" → 不是技能
- "五险一金" → 是benefits，不是technical_skills
- "周末双休" → 是benefits，不是technical_skills
- "带薪年假" → 是benefits，不是technical_skills
- "团队氛围" → 是benefits，不是technical_skills
- "发展空间" → 是benefits，不是technical_skills

✅ 正确分类：
- "Python编程" → programming_languages
- "Selenium" → frameworks_and_libraries
- "Jira" → tools_and_platfrorms
- "测试用例设计" → domain_skills
- "MySQL" → databases
- "敏捷开发" → methodologies

## 最终输出JSON Schema

```json
{
  "role_name": "string",
  "total_jds_analyzed": 0,
  "basic_requirements": {
    "education": {"string": 0.0},
    "experience": {"string": 0.0},
    "majors": ["string"],
    "languages": [{"name": "string", "frequency": 0}],
    "cities": [{"name": "string", "count": 0}]
  },
  "technical_skills": {
    "programming_languages": [{"name": "string", "frequency": 0, "weight": 0.0, "is_required": true}],
    "frameworks_and_libraries": [{"name": "string", "frequency": 0, "weight": 0.0, "is_required": false}],
    "tools_and_platforms": [{"name": "string", "frequency": 0, "weight": 0.0, "is_required": false}],
    "domain_skills": [{"name": "string", "frequency": 0, "weight": 0.0, "is_required": true}],
    "databases": [{"name": "string", "frequency": 0, "weight": 0.0, "is_required": false}],
    "methodologies": [{"name": "string", "frequency": 0, "weight": 0.0, "is_required": false}]
  },
  "soft_skills": [
    {"name": "string", "frequency": 0, "weight": 0.0, "evidence": "string"}
  ],
  "certificates": [
    {"name": "string", "frequency": 0, "importance": "required|preferred"}
  ],
  "job_responsibilities": ["string"],
  "benefits": [
    {"name": "string", "frequency": 0}
  ]
}
```

## 分析规则

1. **技能必须归入正确的子类别**：technical_skills的6个子类别是强制分类
2. **frequency表示出现频次**：统计在所有JD中出现的次数
3. **weight表示重要性**：基于描述强度，0-1之间
4. **is_required表示是否必备**：true表示必备技能，false表示加分技能
5. **evidence是可选的**：软素养需要提供原文依据

仅输出 JSON，不要包含任何其他文字。"""


def build_job_profile_prompt(role_name: str, jd_texts: list[str]) -> list[dict[str, str]]:
    """Build messages for job profile generation (V2).

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
请为以下岗位角色生成结构化岗位画像（使用7分类Schema）。

## 岗位角色
{role_name}

## 代表性 JD 文本（共 {len(jd_sections)} 条）

{chr(10).join(jd_sections)}

请严格按照上面的JSON Schema输出岗位画像。
注意：
1. technical_skills 必须按6个子类别分类
2. 不要把"岗位职责"、"任职要求"、"福利待遇"等非技能内容归入technical_skills
3. 这些应该归入 job_responsibilities 或 benefits 类别"""

    return [
        {"role": "system", "content": JOB_PROFILE_SYSTEM_PROMPT_V2},
        {"role": "user", "content": user_content},
    ]
