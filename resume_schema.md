# 简历解析 Schema 设计文档

---

## 一、简历样本概况

### 1.1 文件清单

| 文件名 | 格式 | 存储结构 | 内容状态 |
|--------|------|----------|----------|
| 蓝色简约行政文职个人简历.docx | DOCX | 段落式 | 有效 |
| 应届生求职简历教师.docx | DOCX | 段落式 | 有效 |
| 个人简历.docx | DOCX | 段落式 | 有效（销售岗） |
| 简约个人单页简历.docx | DOCX | 段落式 | 有效（银行柜员） |
| 蓝色简约财务个人简历.docx | DOCX | 段落式 | 有效（财务岗） |
| 个人求职简历人事.docx | DOCX | 表格式（1x2单元格） | 有效（人事岗） |
| 绿色商务开发工程师个人简历.docx | DOCX | 表格式（1x2单元格） | 有效（开发岗） |
| 读博简历模板.docx | DOCX | 仅图片/排版 | 空模板，无可提取文字 |
| 应届生通用简历.docx | DOCX | 仅图片/排版 | 空模板，无可提取文字 |

**结论**：7 份有效简历，全部为 DOCX 格式。存在两种存储结构：段落式（5份）和表格式（2份），解析器需同时支持。

### 1.2 DOCX 存储结构特征

| 结构类型 | 特点 | 解析策略 |
|----------|------|----------|
| **段落式** | 信息按段落顺序排列，section 标题隐含在格式中（加粗/字号），无显式分隔 | 按段落顺序遍历，通过关键词和时间模式识别 section 边界 |
| **表格式** | 全部内容在一个 1x2 的大表格中，左栏放基本信息+证书，右栏放经历+技能 | 先提取 table cell 文本，再按段落逻辑解析 |
| **图片式** | 简历模板仅含图形/排版元素，无可提取文字 | 需 OCR 预处理（如 Tesseract / Azure Document Intelligence） |

---

## 二、代表性简历结构分析（5 份）

### 2.1 行政文职简历（蓝色简约行政文职个人简历.docx）

**信息块**：
| 块 | 内容 | 表述模式 |
|----|------|----------|
| 基本信息 | 姓名、性别、年龄、学历、电话、邮箱、应聘岗位 | `姓名：XXX` 制表符分隔的键值对 |
| 教育经历 | 学校、专业、时间段、主修课程 | `时间段 \t 学校 \t 专业`，下一段为课程列表 |
| 工作经历 | 2段，公司+职位+时间+职责（每条一段） | `时间段 \t 公司 \t 职位`，后跟分条职责描述 |
| 证书技能 | 证书和掌握技能合并在一起 | `专业证书：` 和 `掌握技能：` 前缀 |
| 自我评价 | 一段综合描述 | 自由文本，包含责任心、沟通能力等关键词 |

**信息密度**：中等。有课程列表但无 GPA，有工作描述但缺量化成果。

### 2.2 教师简历（应届生求职简历教师.docx）

**信息块**：
| 块 | 内容 |
|----|------|
| 基本信息 | 姓名、性别、出生日期、籍贯、学历、政治面貌、婚姻、电话、邮箱、求职意向、工作年限 |
| 教育经历 | 学校、专业、时间段、主修课程 |
| 实习经历 | 1段实习（学校+职位+职责） |
| 校园活动 | 秘书协会干事，兼职推广 |
| 证书荣誉 | 教师资格证、英语六级、普通话二甲 |
| 专业技能 | 课程研发、演讲授课 |
| 自我评价 | 热爱教育、性格描述 |

**信息密度**：较高。包含校园活动和社会实践，有软素养信号。

### 2.3 开发工程师简历（绿色商务开发工程师个人简历.docx）

**信息块**：
| 块 | 内容 |
|----|------|
| 基本信息 | 姓名、生日、籍贯、工作年限、电话、邮箱、住址、求职意向 |
| 技能条 | 工作/沟通/组织/领导能力（图形化进度条，无文字值） |
| 教育经历 | 学校、专业（含学位）、时间段、主修课程 |
| 工作经历 | 2段，公司+职位+工作描述 |
| 语言/办公/专业技能 | 分三行列出 |
| 技术详述 | 框架、数据库、算法等技术栈描述 |

**信息密度**：最高。技术栈描述详细，有具体框架/工具名称，便于技能提取。

### 2.4 销售简历（个人简历.docx）

**信息块**：基本信息、教育、2段工作经历（含具体业绩）、语言/专业/办公技能、自我评价

**特点**：有量化成果（"薪资3800元"、"超额完成销售任务"），信息密度中等。

### 2.5 财务简历（蓝色简约财务个人简历.docx）

**信息块**：基本信息、教育、2段实习经历（含具体工作量）、专业/办公技能、自我评价

**特点**：有量化数据（"3家子公司"、"4册底稿"、"近35册"），信息密度较高。

---

## 三、信息块分布与表述模式汇总

### 3.1 各简历信息块覆盖

| 信息块 | 行政 | 教师 | 销售 | 银行 | 财务 | 人事 | 开发 |
|--------|:----:|:----:|:----:|:----:|:----:|:----:|:----:|
| 基本信息 | Y | Y | Y | Y | Y | Y | Y |
| 求职意向 | Y | Y | Y | Y | Y | Y | Y |
| 教育经历 | Y | Y | Y | Y | Y | Y | Y |
| 主修课程 | Y | Y | Y | Y | Y | Y | Y |
| 工作/实习经历 | Y | Y | Y | Y | Y | Y | Y |
| 校园活动 | - | Y | - | - | - | Y | - |
| 证书 | Y | Y | Y | Y | - | Y | Y |
| 技能列表 | Y | Y | Y | Y | Y | - | Y |
| 自我评价 | Y | Y | Y | Y | Y | Y | - |
| GPA/成绩 | - | - | - | - | - | - | - |
| 项目经历 | - | - | - | - | - | - | - |
| 技能熟练度 | Y | - | Y | Y | Y | - | Y |

### 3.2 常见表述模式

**基本信息**：
- 键值对格式：`姓名：XXX`，用制表符或空格对齐
- 常见字段：姓名、性别、年龄/出生、学历、电话、邮箱、籍贯、政治面貌、婚姻

**教育经历**：
- 统一模式：`时间段 \t 学校名 \t 专业/学位`
- 下接 `主修课程：` 后列出课程清单（顿号或逗号分隔）

**工作/实习经历**：
- 头部：`时间段 \t 公司名 \t 职位`
- 职责描述：分条列出（数字编号或无编号），每条一个段落
- 常见动词：负责、参与、协助、完成、编写、管理

**技能**：
- 前缀分类：`语言技能：` / `专业技能：` / `办公技能：`
- 熟练度词汇：熟练、熟悉、精通、掌握、了解

**自我评价**：
- 自由文本段落
- 高频关键词：责任心、沟通能力、团队协作、学习能力、吃苦耐劳

---

## 四、统一简历解析目标 Schema

```json
{
  "$schema": "ResumeProfile v1.0",

  "basic_info": {
    "name": "string",
    "gender": "string | null",
    "birth_date": "string | null",
    "age": "integer | null",
    "phone": "string | null",
    "email": "string | null",
    "location": "string | null",
    "hometown": "string | null",
    "political_status": "string | null",
    "marital_status": "string | null",
    "ethnicity": "string | null",
    "job_intention": "string | null",
    "expected_salary": "string | null",
    "work_years": "string | null"
  },

  "education": [
    {
      "school": "string",
      "major": "string",
      "degree": "string (本科/硕士/博士/大专)",
      "start_date": "string (YYYY.MM)",
      "end_date": "string (YYYY.MM)",
      "gpa": "string | null",
      "courses": ["string"],
      "honors": ["string"]
    }
  ],

  "work_experience": [
    {
      "company": "string",
      "title": "string",
      "start_date": "string (YYYY.MM)",
      "end_date": "string (YYYY.MM | 至今)",
      "type": "string (全职/实习/兼职)",
      "responsibilities": ["string"],
      "achievements": ["string"]
    }
  ],

  "project_experience": [
    {
      "name": "string",
      "role": "string | null",
      "start_date": "string | null",
      "end_date": "string | null",
      "tech_stack": ["string"],
      "description": "string",
      "achievements": ["string"]
    }
  ],

  "skills": [
    {
      "category": "string (language/professional/office/programming)",
      "name": "string",
      "proficiency": "string (精通/熟练/熟悉/掌握/了解)",
      "proficiency_evidence": "string | null"
    }
  ],

  "certificates": [
    {
      "name": "string",
      "date": "string | null",
      "level": "string | null"
    }
  ],

  "awards": [
    {
      "name": "string",
      "date": "string | null",
      "level": "string (国家级/省级/校级/其他) | null"
    }
  ],

  "campus_activities": [
    {
      "organization": "string",
      "role": "string",
      "period": "string | null",
      "description": "string | null"
    }
  ],

  "soft_skills": {
    "communication": {
      "score": "integer (1-5)",
      "evidence": ["string"]
    },
    "teamwork": {
      "score": "integer (1-5)",
      "evidence": ["string"]
    },
    "leadership": {
      "score": "integer (1-5)",
      "evidence": ["string"]
    },
    "stress_tolerance": {
      "score": "integer (1-5)",
      "evidence": ["string"]
    },
    "learning_ability": {
      "score": "integer (1-5)",
      "evidence": ["string"]
    },
    "responsibility": {
      "score": "integer (1-5)",
      "evidence": ["string"]
    }
  },

  "self_evaluation": "string | null",

  "_meta": {
    "source_file": "string",
    "file_format": "string (docx/pdf/txt)",
    "parse_method": "string (paragraph/table/ocr/llm)",
    "parse_confidence": "float (0-1)",
    "parsed_at": "string (ISO 8601)"
  }
}
```

---

## 五、Schema 字段说明与解析策略

### 5.1 basic_info — 基本信息

| 字段 | 必填 | 提取方式 | 说明 |
|------|:----:|----------|------|
| name | Y | 正则：首行或 `姓名：` 后的值 | 通常在简历最顶部 |
| gender | N | 关键词 `性别：男/女` | 部分简历不含 |
| phone | N | 正则：`1[3-9]\d{9}` 或 `138-xxxx-xxxx` | 可能被星号遮蔽 |
| email | N | 正则：标准邮箱格式 | |
| job_intention | N | 关键词 `求职意向：` / `应聘岗位：` | 核心匹配字段 |
| work_years | N | 关键词 `工作经验：` / `工作年限：` | `应届` / `X年` |

### 5.2 education — 教育经历

**识别模式**：`日期范围 + 学校名 + 专业`，三者通常以制表符分隔在同一行。

**解析要点**：
- `degree` 从专业名后缀提取（`/本科`、`-本科`）或从 `学历：` 字段获取
- `courses` 从 `主修课程：` 后的文本中按顿号/逗号切分
- 所有样本均未提供 GPA，此字段预设为 null

### 5.3 work_experience — 工作/实习经历

**识别模式**：`日期范围 + 公司名 + 职位`，后跟多行职责描述。

**解析要点**：
- `type` 推断规则：职位含"实习"→ 实习；日期在毕业前 → 实习；否则 → 全职
- `responsibilities` vs `achievements`：含数字/百分比/完成量的归为成就，其余为职责
- 动词开头的句子几乎全是职责描述

### 5.4 project_experience — 项目经历

当前 7 份样本中**无独立项目经历块**，但部分工作经历中含项目描述（如财务简历的"审计项目"）。

**解析策略**：
- 从工作经历中识别含 `项目` 关键词的描述，拆分为独立项目
- 技术岗简历中从技术栈描述推断项目经验
- LLM 辅助提取项目名、技术栈、成果

### 5.5 skills — 技能清单

**识别关键词**：`专业技能` / `办公技能` / `语言技能` / `掌握技能` / `技能信息`

**熟练度推断规则**：

| 原文关键词 | 熟练度等级 | 数值映射 |
|-----------|-----------|---------|
| 精通 | expert | 5 |
| 熟练/熟练掌握/熟练使用 | proficient | 4 |
| 熟悉 | familiar | 3 |
| 掌握/了解 | basic | 2 |
| 接触/学习过 | beginner | 1 |

**proficiency_evidence**：记录原文中的具体证据（如"3年以上Java开发经验"）。

### 5.6 certificates & awards — 证书与奖项

**常见证书**（从样本统计）：
- 语言类：英语四级/六级、普通话等级
- 计算机类：计算机二级
- 职业类：教师资格证、人力资源管理师
- 荣誉类：国家励志奖学金、优秀志愿者

**识别方式**：关键词 `证书` / `荣誉` / `获` / `通过`，或从 `专业证书：` 段提取。

### 5.7 soft_skills — 软素养信号

**不依赖自评**，从全文多来源推断：

| 软素养 | 信号来源 | 示例 |
|--------|----------|------|
| 沟通能力 | 自我评价关键词、工作描述中的"沟通/协调/接待" | "负责与其他部门的协调工作" |
| 团队协作 | "团队"、"协作"、"配合"、校园组织经历 | "加入秘书协会，担任干事" |
| 领导力 | 管理职位、带团队经历、"负责/主导/统筹" | "担任宣传部干事，负责..." |
| 抗压能力 | "承受压力"、"高要求"、高强度工作描述 | "能承受一定的工作压力" |
| 学习能力 | "学习能力强"、快速上手描述、跨领域经历 | "能迅速接受新的理论与技能" |
| 责任心 | "责任心强"、"认真负责"、独立完成任务 | "工作认真负责，细心负责" |

**评分规则**：
- 1 分：无相关信号
- 2 分：仅在自我评价中提及（弱信号）
- 3 分：自我评价 + 1 处经历佐证
- 4 分：多处经历佐证
- 5 分：有量化成果佐证（如"带领5人团队完成..."）

---

## 六、解析实施方案

### 6.1 解析流水线

```
1. 文件读取
   ├── DOCX → python-docx 提取段落 + 表格
   ├── PDF  → pdfplumber / PyMuPDF 提取文本
   ├── 图片式 → OCR (Tesseract / 云端 API)
   └── TXT  → 直接读取

2. 文本预处理
   ├── 合并表格 cell 为连续文本
   ├── 去除多余空白、制表符标准化
   └── 识别 section 边界（基于关键词 + 时间模式）

3. 结构化提取（两阶段）
   ├── 阶段 1：规则引擎
   │   ├── 正则提取：姓名、电话、邮箱、日期
   │   ├── 关键词匹配：求职意向、学历、技能熟练度
   │   └── 模板匹配：时间+机构+角色 的三段式行
   │
   └── 阶段 2：LLM 结构化
       ├── 将预处理文本 + Schema 定义作为 prompt
       ├── LLM 输出 JSON 格式的结构化数据
       └── 校验：JSON Schema 验证 + 字段完整性检查

4. 后处理
   ├── 技能归一化（同义词合并）
   ├── 软素养评分（基于规则引擎）
   └── 置信度计算（基于字段填充率）
```

### 6.2 对应数据库表结构

```sql
CREATE TABLE student_profiles (
    id              SERIAL PRIMARY KEY,
    -- 基本信息
    name            VARCHAR(64) NOT NULL,
    gender          VARCHAR(4),
    birth_date      DATE,
    phone           VARCHAR(20),
    email           VARCHAR(128),
    location        VARCHAR(64),
    job_intention   VARCHAR(128),
    work_years      VARCHAR(16),

    -- 教育（最高学历冗余）
    school          VARCHAR(128),
    major           VARCHAR(128),
    degree          VARCHAR(16),
    graduation_year SMALLINT,

    -- 结构化 JSON 字段
    education       JSONB,          -- education[]
    work_experience JSONB,          -- work_experience[]
    project_experience JSONB,       -- project_experience[]
    skills          JSONB,          -- skills[]
    certificates    JSONB,          -- certificates[]
    awards          JSONB,          -- awards[]
    campus_activities JSONB,        -- campus_activities[]
    soft_skills     JSONB,          -- soft_skills{}
    self_evaluation TEXT,

    -- 元信息
    source_file     VARCHAR(256),
    parse_method    VARCHAR(32),
    parse_confidence FLOAT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

### 6.3 与岗位匹配的衔接字段

| 简历字段 | 对应岗位字段 (job_positions) | 匹配方式 |
|----------|------------------------------|----------|
| `job_intention` | `role` / `title` | 语义相似度 |
| `skills[].name` | `skills[]` | 关键词交集 + 语义匹配 |
| `education[].degree` | `education_req` | 学历等级比较 |
| `work_experience` 年限 | `experience_req` | 数值比较 |
| `location` | `city` | 精确 / 模糊匹配 |
| `soft_skills` | JD 描述中的软素养要求 | LLM 推断 |

---

## 七、质量与局限性说明

1. **样本量偏小**：仅 7 份有效简历（均为模板），真实简历的格式多样性远高于此
2. **无 GPA 样本**：所有样本均未包含 GPA/成绩信息，Schema 已预留但需在真实数据中验证
3. **项目经历缺失**：样本中无独立"项目经历"块，技术岗真实简历通常包含，Schema 已覆盖
4. **图片式简历**：2 份模板仅含图形，需 OCR 支持，建议优先使用 Azure Document Intelligence 或百度 OCR
5. **软素养评分主观性**：当前基于规则的评分偏保守，后续可结合 LLM 做更细致的推断
