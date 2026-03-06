# 统一画像 Schema 设计文档

> 基于 `data_analysis_report.md`（JD 数据分析）和 `resume_schema.md`（简历解析 Schema）设计
> 核心目标：JobProfile 与 StudentProfile 在同一维度空间对齐，支持四维匹配打分

---

## 一、统一画像维度定义

匹配引擎在四个维度对齐打分，每个维度包含若干子项，JobProfile 和 StudentProfile 使用完全相同的子项结构。

### 1.1 维度总览

| 维度 | 权重建议 | 说明 | 子项数 |
|------|---------|------|--------|
| D1: 基础要求 | 20% | 学历、经验、地域等硬性门槛 | 5 |
| D2: 职业技能 | 35% | 硬技能（编程/工具/专业技能）匹配度 | 按技能词表动态 |
| D3: 职业素养 | 25% | 沟通、协作、领导力等软素养 | 6 |
| D4: 发展潜力 | 20% | 学习能力、成长轨迹、跨领域适配 | 5 |

### 1.2 D1: 基础要求 (BasicRequirements)

| 子项 | 数据类型 | 取值范围 | Job 含义 | Student 含义 |
|------|----------|----------|----------|-------------|
| `degree` | enum | `大专` / `本科` / `硕士` / `博士` | 最低学历要求 | 最高学历 |
| `experience_years` | float | 0-30 | 最低经验年限 | 实际经验年限（实习折算 0.5） |
| `city` | string | 城市名 | 工作地点 | 期望/当前城市 |
| `salary_min` | int | 0-999999（元/月） | 岗位最低月薪 | 期望最低月薪 |
| `salary_max` | int | 0-999999（元/月） | 岗位最高月薪 | 期望最高月薪 |

**匹配规则**：
- `degree`：Student.degree >= Job.degree → 通过（硬门槛）
- `experience_years`：Student >= Job → 满分；差值在 1 年内 → 按比例扣分；差值 >2 年 → 不匹配
- `city`：精确匹配 or 同省份模糊匹配
- `salary`：区间重叠度

### 1.3 D2: 职业技能 (ProfessionalSkills)

| 子项 | 数据类型 | 取值范围 | 说明 |
|------|----------|----------|------|
| `skill_id` | string | 技能词表 ID | 标准化技能标识 |
| `skill_name` | string | 技能词表标准名 | 如 `Java`、`财务分析` |
| `category` | enum | 见技能词表分层 | 技能所属类别 |
| `level` | int | 1-5 | Job: 要求等级; Student: 掌握等级 |
| `importance` | enum | `required` / `preferred` / `bonus` | 仅 Job 使用，技能重要程度 |
| `evidence` | object | `{source, text}` | 证据来源和原文 |

**level 定义**（Job 与 Student 统一）：

| 等级 | 含义 (Job 要求) | 含义 (Student 能力) | 对应关键词 |
|------|----------------|-------------------|-----------|
| 1 | 了解即可 | 听说过/学过 | 了解、接触 |
| 2 | 基本掌握 | 课程学习/少量实践 | 掌握、学习过 |
| 3 | 熟悉运用 | 有项目使用经验 | 熟悉 |
| 4 | 熟练操作 | 多次项目/工作中使用 | 熟练、熟练掌握 |
| 5 | 精通/专家 | 深入理解+可指导他人 | 精通、专家级 |

**匹配计算**：
- 技能重叠度 = |Job.skills ∩ Student.skills| / |Job.skills(required+preferred)|
- 缺口成本 = Σ (Job.skill[i].level - Student.skill[i].level) × importance_weight，仅计算 Student 不达标的技能
- importance_weight: required=3, preferred=2, bonus=1

### 1.4 D3: 职业素养 (SoftCompetencies)

| 子项 | 数据类型 | 取值范围 | Job 含义 | Student 含义 |
|------|----------|----------|----------|-------------|
| `communication` | int | 1-5 | 岗位对沟通的要求等级 | 候选人沟通能力评估 |
| `teamwork` | int | 1-5 | 团队协作要求 | 团队协作能力 |
| `leadership` | int | 1-5 | 领导力/管理要求 | 领导力表现 |
| `stress_tolerance` | int | 1-5 | 抗压要求 | 抗压能力 |
| `responsibility` | int | 1-5 | 责任心要求 | 责任心表现 |
| `problem_solving` | int | 1-5 | 问题解决要求 | 问题解决能力 |

每个子项附带 `evidence[]`，记录推断依据。

**来源映射**：
- Job 端：从 JD 岗位详情中由 LLM 推断（如"需要较强的沟通能力" → communication=4）
- Student 端：从简历多来源综合推断（自我评价 + 经历描述 + 校园活动）

### 1.5 D4: 发展潜力 (GrowthPotential)

| 子项 | 数据类型 | 取值范围 | Job 含义 | Student 含义 |
|------|----------|----------|----------|-------------|
| `learning_ability` | int | 1-5 | 岗位学习要求（技术迭代速度） | 学习能力评估 |
| `career_stability` | int | 1-5 | 期望稳定性 | 职业稳定性预测 |
| `growth_trajectory` | enum | `entry`/`growing`/`mature`/`expert` | 岗位阶段定位 | 个人成长阶段 |
| `industry_adaptability` | int | 1-5 | 跨行业适配需求 | 跨行业适配能力 |
| `role_match_score` | float | 0-1 | — | 求职意向与岗位 Role 的语义相似度 |

---

## 二、JobProfile JSON Schema

```json
{
  "$schema": "JobProfile v1.0",

  "id": "string (UUID)",
  "source_job_code": "string (原始岗位编码)",

  "basic_info": {
    "title": "string (原始岗位名称)",
    "role": "string (归一化 Role 大类)",
    "sub_role": "string | null (细分方向)",
    "company_name": "string",
    "industries": ["string"],
    "company_size": "string",
    "company_stage": "string | null",
    "city": "string",
    "district": "string | null",
    "published_at": "string (YYYY-MM-DD)"
  },

  "dimensions": {
    "basic_requirements": {
      "degree": {
        "value": "string (大专/本科/硕士/博士)",
        "evidence": {
          "source": "string (jd_description)",
          "text": "string (原文片段)"
        }
      },
      "experience_years": {
        "value": 0,
        "evidence": { "source": "string", "text": "string" }
      },
      "city": {
        "value": "string"
      },
      "salary_min": {
        "value": 0,
        "unit": "元/月"
      },
      "salary_max": {
        "value": 0,
        "unit": "元/月"
      },
      "salary_months": {
        "value": 12
      }
    },

    "professional_skills": [
      {
        "skill_id": "string",
        "skill_name": "string",
        "category": "string",
        "level": 3,
        "importance": "required | preferred | bonus",
        "evidence": {
          "source": "jd_description",
          "text": "string (原文片段)"
        }
      }
    ],

    "soft_competencies": {
      "communication":     { "value": 3, "evidence": [{"source": "string", "text": "string"}] },
      "teamwork":          { "value": 3, "evidence": [] },
      "leadership":        { "value": 2, "evidence": [] },
      "stress_tolerance":  { "value": 3, "evidence": [] },
      "responsibility":    { "value": 4, "evidence": [] },
      "problem_solving":   { "value": 3, "evidence": [] }
    },

    "growth_potential": {
      "learning_ability":       { "value": 3, "evidence": [] },
      "career_stability":       { "value": 3, "evidence": [] },
      "growth_trajectory":      { "value": "entry | growing | mature | expert" },
      "industry_adaptability":  { "value": 2, "evidence": [] }
    }
  },

  "raw_description": "string (清洗后的 JD 全文)",
  "company_intro": "string | null",

  "_meta": {
    "created_at": "string (ISO 8601)",
    "parse_version": "string",
    "llm_model": "string",
    "confidence": 0.85
  }
}
```

### JobProfile 示例

```json
{
  "id": "jp-001-abc",
  "source_job_code": "CC668565120J40736166805",

  "basic_info": {
    "title": "前端开发",
    "role": "前端开发",
    "sub_role": null,
    "company_name": "东莞市恒亚罗斯计算机科技有限公司",
    "industries": ["计算机软件", "互联网", "IT服务"],
    "company_size": "20-99人",
    "company_stage": "天使轮",
    "city": "东莞",
    "district": "虎门镇",
    "published_at": "2025-05-19"
  },

  "dimensions": {
    "basic_requirements": {
      "degree": {
        "value": "本科",
        "evidence": { "source": "jd_description", "text": "本科及以上学历" }
      },
      "experience_years": {
        "value": 1,
        "evidence": { "source": "jd_description", "text": "1年以上前端开发经验" }
      },
      "city": { "value": "东莞" },
      "salary_min": { "value": 3000, "unit": "元/月" },
      "salary_max": { "value": 4000, "unit": "元/月" },
      "salary_months": { "value": 12 }
    },

    "professional_skills": [
      {
        "skill_id": "lang-js",
        "skill_name": "JavaScript",
        "category": "编程语言",
        "level": 4,
        "importance": "required",
        "evidence": { "source": "jd_description", "text": "负责公司项目web前端页面的设计和开发" }
      },
      {
        "skill_id": "framework-vue",
        "skill_name": "Vue.js",
        "category": "前端框架",
        "level": 3,
        "importance": "preferred",
        "evidence": { "source": "jd_description", "text": "参与前端架构在项目中的落地" }
      },
      {
        "skill_id": "skill-responsive",
        "skill_name": "响应式设计",
        "category": "前端技能",
        "level": 3,
        "importance": "preferred",
        "evidence": { "source": "jd_description", "text": "优化前端体验和页面响应速度" }
      }
    ],

    "soft_competencies": {
      "communication":     { "value": 3, "evidence": [{"source": "jd_description", "text": "配合后端开发工程师实现界面功能"}] },
      "teamwork":          { "value": 4, "evidence": [{"source": "jd_description", "text": "配合后端开发工程师"}] },
      "leadership":        { "value": 1, "evidence": [] },
      "stress_tolerance":  { "value": 2, "evidence": [] },
      "responsibility":    { "value": 3, "evidence": [] },
      "problem_solving":   { "value": 3, "evidence": [{"source": "jd_description", "text": "持续的优化前端体验"}] }
    },

    "growth_potential": {
      "learning_ability":       { "value": 3, "evidence": [] },
      "career_stability":       { "value": 3, "evidence": [] },
      "growth_trajectory":      { "value": "entry" },
      "industry_adaptability":  { "value": 2, "evidence": [] }
    }
  },

  "raw_description": "1.负责公司项目web前端页面的设计和开发、测试、优化工作；2.参与前端架构在项目中的落地、实施...",
  "company_intro": "南极芯科技是一家专业设计，研发...",

  "_meta": {
    "created_at": "2026-03-05T10:00:00Z",
    "parse_version": "1.0",
    "llm_model": "gpt-4o",
    "confidence": 0.82
  }
}
```

---

## 三、StudentProfile JSON Schema

```json
{
  "$schema": "StudentProfile v1.0",

  "id": "string (UUID)",

  "basic_info": {
    "name": "string",
    "gender": "string | null",
    "birth_date": "string | null",
    "phone": "string | null",
    "email": "string | null",
    "location": "string | null",
    "hometown": "string | null",
    "job_intention": "string | null",
    "job_intention_role": "string (归一化后的 Role)",
    "expected_salary_min": "int | null",
    "expected_salary_max": "int | null"
  },

  "education": [
    {
      "school": "string",
      "major": "string",
      "degree": "string",
      "start_date": "string",
      "end_date": "string",
      "gpa": "float | null",
      "courses": ["string"],
      "honors": ["string"],
      "evidence": { "source": "resume_education", "text": "string" }
    }
  ],

  "experience": [
    {
      "type": "string (全职/实习/兼职/项目/校园活动)",
      "organization": "string",
      "title": "string",
      "start_date": "string",
      "end_date": "string",
      "responsibilities": ["string"],
      "achievements": ["string"],
      "extracted_skills": ["string (skill_id)"],
      "evidence": { "source": "resume_work_exp | resume_project | resume_campus", "text": "string" }
    }
  ],

  "dimensions": {
    "basic_requirements": {
      "degree": {
        "value": "string (最高学历)",
        "evidence": { "source": "resume_education", "text": "string" }
      },
      "experience_years": {
        "value": 0.0,
        "evidence": { "source": "resume_work_exp", "text": "string" }
      },
      "city": { "value": "string" },
      "salary_min": { "value": 0, "unit": "元/月" },
      "salary_max": { "value": 0, "unit": "元/月" }
    },

    "professional_skills": [
      {
        "skill_id": "string",
        "skill_name": "string",
        "category": "string",
        "level": 3,
        "evidence": {
          "source": "resume_skills | resume_work_exp | resume_project",
          "text": "string (原文)"
        }
      }
    ],

    "soft_competencies": {
      "communication":     { "value": 3, "evidence": [{"source": "string", "text": "string"}] },
      "teamwork":          { "value": 3, "evidence": [] },
      "leadership":        { "value": 2, "evidence": [] },
      "stress_tolerance":  { "value": 2, "evidence": [] },
      "responsibility":    { "value": 3, "evidence": [] },
      "problem_solving":   { "value": 3, "evidence": [] }
    },

    "growth_potential": {
      "learning_ability":       { "value": 3, "evidence": [] },
      "career_stability":       { "value": 3, "evidence": [] },
      "growth_trajectory":      { "value": "entry" },
      "industry_adaptability":  { "value": 3, "evidence": [] },
      "role_match_score":       { "value": 0.0 }
    }
  },

  "certificates": [
    {
      "name": "string",
      "date": "string | null",
      "level": "string | null",
      "evidence": { "source": "resume_certificates", "text": "string" }
    }
  ],

  "self_evaluation": "string | null",

  "_meta": {
    "source_file": "string",
    "file_format": "string",
    "parse_method": "string",
    "parse_confidence": 0.85,
    "created_at": "string (ISO 8601)"
  }
}
```

### StudentProfile 示例

```json
{
  "id": "sp-001-xyz",

  "basic_info": {
    "name": "稻小壳",
    "gender": "女",
    "birth_date": "19XX-08-06",
    "phone": "138-0000-0001",
    "email": "kingsoft@docer.cn",
    "location": "广东广州白云区",
    "hometown": "广东广州",
    "job_intention": "开发工程师",
    "job_intention_role": "后端开发",
    "expected_salary_min": null,
    "expected_salary_max": null
  },

  "education": [
    {
      "school": "稻壳学院",
      "major": "计算机科学与技术",
      "degree": "本科",
      "start_date": "20XX.09",
      "end_date": "20XX.06",
      "gpa": null,
      "courses": ["电磁理论", "天线原理", "电子线路", "数字电路", "算法与数据结构", "计算机基础", "单片机", "信号与系统分析"],
      "honors": [],
      "evidence": { "source": "resume_education", "text": "20XX.9-20XX.6 稻壳学院 计算机科学与技术-本科" }
    }
  ],

  "experience": [
    {
      "type": "全职",
      "organization": "金山办公软件有限公司",
      "title": "Java开发工程师",
      "start_date": "20XX.09",
      "end_date": "20XX.06",
      "responsibilities": [
        "完成自主研发的知识管理软件二次开发",
        "实现高性能、维护性以及良好系统可伸缩性的代码编写",
        "编写及优化软件功能说明书"
      ],
      "achievements": [],
      "extracted_skills": ["lang-java", "skill-high-perf"],
      "evidence": { "source": "resume_work_exp", "text": "金山办公软件有限公司 Java开发工程师..." }
    }
  ],

  "dimensions": {
    "basic_requirements": {
      "degree": {
        "value": "本科",
        "evidence": { "source": "resume_education", "text": "计算机科学与技术-本科" }
      },
      "experience_years": {
        "value": 3.0,
        "evidence": { "source": "resume_basic", "text": "工作年限：XX年" }
      },
      "city": { "value": "广州" },
      "salary_min": { "value": 0, "unit": "元/月" },
      "salary_max": { "value": 0, "unit": "元/月" }
    },

    "professional_skills": [
      {
        "skill_id": "lang-java",
        "skill_name": "Java",
        "category": "编程语言",
        "level": 4,
        "evidence": { "source": "resume_skills", "text": "三年以上互联网项目Java开发经验，编程基础扎实" }
      },
      {
        "skill_id": "framework-spring",
        "skill_name": "Spring",
        "category": "后端框架",
        "level": 3,
        "evidence": { "source": "resume_skills", "text": "熟悉主流的Java开源框架，如spring、springboot、Springcloud等" }
      },
      {
        "skill_id": "db-mysql",
        "skill_name": "MySQL",
        "category": "数据库",
        "level": 4,
        "evidence": { "source": "resume_skills", "text": "熟悉mysql、Oracle等主流数据库的设计和开发，有数据库优化经验" }
      },
      {
        "skill_id": "skill-algo",
        "skill_name": "数据结构与算法",
        "category": "计算机基础",
        "level": 3,
        "evidence": { "source": "resume_skills", "text": "具有扎实的计算机知识，在数据结构、算法和代码方面有较强的能力" }
      }
    ],

    "soft_competencies": {
      "communication":     { "value": 3, "evidence": [{"source": "resume_skills", "text": "良好的沟通表达能力"}] },
      "teamwork":          { "value": 3, "evidence": [{"source": "resume_work_exp", "text": "参与项目业务需求讨论"}] },
      "leadership":        { "value": 2, "evidence": [] },
      "stress_tolerance":  { "value": 3, "evidence": [{"source": "resume_skills", "text": "高性能高并发编程"}] },
      "responsibility":    { "value": 3, "evidence": [] },
      "problem_solving":   { "value": 4, "evidence": [{"source": "resume_skills", "text": "有独立设计算法、解决程序问题的能力"}] }
    },

    "growth_potential": {
      "learning_ability":       { "value": 3, "evidence": [] },
      "career_stability":       { "value": 3, "evidence": [] },
      "growth_trajectory":      { "value": "growing" },
      "industry_adaptability":  { "value": 3, "evidence": [] },
      "role_match_score":       { "value": 0.0 }
    }
  },

  "certificates": [
    {
      "name": "英语CET-6",
      "date": null,
      "level": "六级",
      "evidence": { "source": "resume_certificates", "text": "英语CET-6" }
    },
    {
      "name": "普通话二级甲等",
      "date": null,
      "level": "二级甲等",
      "evidence": { "source": "resume_certificates", "text": "普通话二级甲等" }
    }
  ],

  "self_evaluation": null,

  "_meta": {
    "source_file": "绿色商务开发工程师个人简历.docx",
    "file_format": "docx",
    "parse_method": "table+llm",
    "parse_confidence": 0.80,
    "created_at": "2026-03-05T10:30:00Z"
  }
}
```

---

## 四、技能词表初始设计

### 4.1 分层分类体系

```
技能词表 (SkillTaxonomy)
├── L1: 技能域 (domain)
│   ├── L2: 技能类别 (category)
│   │   ├── L3: 具体技能 (skill)
│   │   │   ├── skill_id: 唯一标识
│   │   │   ├── canonical_name: 标准名称
│   │   │   ├── aliases: 同义词列表
│   │   │   └── related: 相关技能 ID 列表
```

### 4.2 初始词表（基于 JD 数据和简历样本）

#### 技术类 (tech)

| L2 类别 | skill_id | 标准名 | 同义词 |
|---------|----------|--------|--------|
| **编程语言** | `lang-java` | Java | java, JAVA, J2EE |
| | `lang-python` | Python | python, py, Python3 |
| | `lang-cpp` | C/C++ | C++, c++, C语言, cpp |
| | `lang-csharp` | C# | c#, CSharp, .NET(C#) |
| | `lang-js` | JavaScript | js, JS, javascript, ES6 |
| | `lang-ts` | TypeScript | ts, TS, typescript |
| | `lang-go` | Go | golang, Golang |
| | `lang-sql` | SQL | sql, SQL语句 |
| | `lang-cobol` | COBOL | cobol |
| **前端框架** | `fe-vue` | Vue.js | Vue, vue, Vue2, Vue3 |
| | `fe-react` | React | react, ReactJS |
| | `fe-html` | HTML/CSS | HTML, CSS, HTML5, CSS3, H5 |
| **后端框架** | `be-spring` | Spring | spring, Spring框架 |
| | `be-springboot` | Spring Boot | springboot, SpringBoot |
| | `be-springcloud` | Spring Cloud | springcloud, SpringCloud, 微服务 |
| | `be-django` | Django | django |
| | `be-fastapi` | FastAPI | fastapi |
| **数据库** | `db-mysql` | MySQL | mysql, Mysql, MYSQL |
| | `db-oracle` | Oracle | oracle, Oracle数据库 |
| | `db-sqlserver` | SQL Server | sql server, SqlServer, MSSQL |
| | `db-postgres` | PostgreSQL | postgres, PG, postgresql |
| | `db-redis` | Redis | redis |
| | `db-mongodb` | MongoDB | mongodb, Mongo |
| **DevOps/工具** | `tool-git` | Git | git, Git版本控制 |
| | `tool-docker` | Docker | docker, 容器 |
| | `tool-linux` | Linux | linux, Linux操作系统, CentOS, Ubuntu |
| | `tool-ci` | CI/CD | Jenkins, GitLab CI, 持续集成 |
| **测试** | `test-func` | 功能测试 | 功能测试, 黑盒测试 |
| | `test-auto` | 自动化测试 | 自动化测试, Selenium, Appium |
| | `test-perf` | 性能测试 | 性能测试, JMeter, LoadRunner |
| | `test-api` | 接口测试 | 接口测试, API测试, Postman |
| **嵌入式/硬件** | `hw-mcu` | 单片机 | 单片机, MCU, STM32, 51单片机 |
| | `hw-autosar` | AUTOSAR | AUTOSAR, autosar |
| | `hw-arm` | ARM | ARM, arm, Cortex |
| | `hw-can` | CAN总线 | CAN, CAN总线, CANOE |

#### 通用技能类 (general)

| L2 类别 | skill_id | 标准名 | 同义词 |
|---------|----------|--------|--------|
| **办公软件** | `office-word` | Word | Word, word, 文档处理 |
| | `office-excel` | Excel | Excel, excel, 电子表格, 数据处理 |
| | `office-ppt` | PowerPoint | PPT, ppt, PowerPoint, 演示文稿 |
| | `office-suite` | Office套件 | office, Office, 办公软件, Microsoft Office |
| **语言能力** | `lang-en-cet4` | 英语CET-4 | 英语四级, CET4, CET-4, 大学英语四级 |
| | `lang-en-cet6` | 英语CET-6 | 英语六级, CET6, CET-6, 大学英语六级 |
| | `lang-jp-n1` | 日语N1 | 日语N1, JLPT N1, 日语一级 |
| | `lang-jp-n2` | 日语N2 | 日语N2, JLPT N2, 日语二级 |
| | `lang-mandarin` | 普通话 | 普通话, 普通话等级 |
| **专业资质** | `cert-teacher` | 教师资格证 | 教师资格证, 教师证 |
| | `cert-hr` | 人力资源管理师 | 人力资源管理师, HR证书 |
| | `cert-cpa` | 注册会计师 | CPA, 注册会计师 |
| | `cert-law` | 法律职业资格 | 法考, 司法考试, 法律职业资格 |

#### 业务技能类 (business)

| L2 类别 | skill_id | 标准名 | 同义词 |
|---------|----------|--------|--------|
| **销售** | `biz-sales` | 销售技巧 | 销售技巧, 客户开发, 商务谈判 |
| | `biz-crm` | 客户管理 | CRM, 客户关系管理 |
| **财务** | `biz-accounting` | 会计核算 | 会计, 会计核算, 账务处理 |
| | `biz-audit` | 审计 | 审计, 内审, 外审 |
| | `biz-tax` | 税务 | 税务, 纳税, 税法 |
| **人力资源** | `biz-recruit` | 招聘 | 招聘, 人才招聘, 校园招聘 |
| | `biz-training` | 培训 | 培训, 员工培训, 内训 |
| | `biz-labor-law` | 劳动法 | 劳动法, 劳资关系 |
| **行政** | `biz-admin` | 行政管理 | 行政管理, 行政事务, 办公管理 |
| | `biz-archive` | 档案管理 | 档案管理, 资料管理, 文件管理 |
| **项目管理** | `biz-pm` | 项目管理 | 项目管理, PMP, 项目经理 |
| | `biz-bidding` | 招投标 | 招投标, 投标, 标书 |

### 4.3 同义词映射规则

```python
# 映射规则优先级（从高到低）
# 1. 精确匹配：原文完全等于 canonical_name 或 aliases 中的某项
# 2. 大小写无关匹配：统一转小写后匹配
# 3. 包含匹配：原文包含技能名（需避免误匹配，如 "Java" 不应匹配 "JavaScript"）
# 4. 正则匹配：特殊模式，如 "3年以上Java" → 提取 "Java"
# 5. LLM 兜底：无法规则匹配的，由 LLM 判断归属

SYNONYM_RULES = {
    # 精确映射
    "exact": {
        "js": "lang-js",
        "JS": "lang-js",
        "vue": "fe-vue",
        # ...
    },
    # 正则模式
    "pattern": [
        (r"(?i)\bpython\d?\b", "lang-python"),
        (r"(?i)\bjava\b(?!script)", "lang-java"),   # Java but not JavaScript
        (r"(?i)\bspring\s*boot\b", "be-springboot"),
        (r"(?i)\bc\+\+|cpp\b", "lang-cpp"),
        (r"(?i)CET[-\s]?[46]|英语[四六]级", None),  # 需进一步区分4/6
    ],
    # 层级继承：子技能未匹配时向上归并
    "fallback_to_parent": {
        "be-springboot": "be-spring",    # SpringBoot → Spring
        "fe-vue": "fe-frontend",         # Vue → 前端开发
    }
}
```

### 4.4 词表扩展机制

1. **自动发现**：对 JD 岗位详情做 NLP/LLM 提取，新出现的技能名加入候选列表
2. **人工审核**：候选列表定期审核，确认后加入正式词表
3. **频率阈值**：出现 ≥5 次的候选自动提升为正式技能
4. **版本管理**：词表每次更新记录版本号，画像中记录使用的词表版本

---

## 五、维度对齐说明

### 5.1 对齐原则

JobProfile 和 StudentProfile 的 `dimensions` 结构**完全同构**，确保可以直接逐字段计算匹配度。

```
JobProfile.dimensions              StudentProfile.dimensions
├── basic_requirements    ←→    ├── basic_requirements
│   ├── degree            ←→    │   ├── degree
│   ├── experience_years  ←→    │   ├── experience_years
│   ├── city              ←→    │   ├── city
│   └── salary_*          ←→    │   └── salary_*
├── professional_skills[] ←→    ├── professional_skills[]
│   (skill_id 对齐)              │   (skill_id 对齐)
├── soft_competencies     ←→    ├── soft_competencies
│   (6个子项 1-5)                │   (6个子项 1-5)
└── growth_potential      ←→    └── growth_potential
    (5个子项)                        (5个子项)
```

### 5.2 匹配度计算公式

#### 总分

```
MatchScore = w1 × D1_score + w2 × D2_score + w3 × D3_score + w4 × D4_score

其中: w1=0.20, w2=0.35, w3=0.25, w4=0.20 (可配置)
```

#### D1: 基础要求匹配

```python
def d1_score(job, student):
    # 学历：硬门槛
    degree_order = {"大专": 1, "本科": 2, "硕士": 3, "博士": 4}
    if degree_order[student.degree] < degree_order[job.degree]:
        return 0  # 学历不达标，直接淘汰（或大幅扣分）

    # 经验
    exp_diff = student.experience_years - job.experience_years
    exp_score = min(1.0, max(0, 1 + exp_diff / 2))  # 差2年以内按比例

    # 城市
    city_score = 1.0 if student.city == job.city else 0.5  # 同省0.5

    # 薪资区间重叠度
    overlap = max(0, min(job.salary_max, student.salary_max) - max(job.salary_min, student.salary_min))
    range_total = max(job.salary_max - job.salary_min, 1)
    salary_score = min(1.0, overlap / range_total)

    return 0.3 * 1.0 + 0.3 * exp_score + 0.2 * city_score + 0.2 * salary_score
```

#### D2: 技能匹配

```python
def d2_score(job, student):
    job_skills = {s.skill_id: s for s in job.professional_skills}
    stu_skills = {s.skill_id: s for s in student.professional_skills}

    total_weight = 0
    matched_weight = 0
    gap_cost = 0

    importance_w = {"required": 3, "preferred": 2, "bonus": 1}

    for sid, js in job_skills.items():
        w = importance_w[js.importance]
        total_weight += w

        if sid in stu_skills:
            ss = stu_skills[sid]
            level_ratio = min(1.0, ss.level / js.level)
            matched_weight += w * level_ratio
            if ss.level < js.level:
                gap_cost += (js.level - ss.level) * w
        else:
            gap_cost += js.level * w  # 完全缺失

    skill_match = matched_weight / total_weight if total_weight > 0 else 0
    return skill_match  # 0-1

    # gap_cost 单独输出，用于报告中的"技能缺口分析"
```

#### D3: 职业素养匹配

```python
def d3_score(job, student):
    dims = ["communication", "teamwork", "leadership",
            "stress_tolerance", "responsibility", "problem_solving"]
    scores = []
    for d in dims:
        j_val = getattr(job.soft_competencies, d).value
        s_val = getattr(student.soft_competencies, d).value
        # 学生 >= 岗位要求 → 满分；不足按比例
        scores.append(min(1.0, s_val / j_val) if j_val > 0 else 1.0)
    return sum(scores) / len(scores)
```

#### D4: 发展潜力匹配

```python
def d4_score(job, student):
    # 学习能力
    learn = min(1.0, student.learning_ability / max(job.learning_ability, 1))
    # 成长阶段匹配
    trajectory_map = {"entry": 1, "growing": 2, "mature": 3, "expert": 4}
    t_diff = abs(trajectory_map[job.growth_trajectory] - trajectory_map[student.growth_trajectory])
    trajectory = max(0, 1 - t_diff * 0.3)
    # 行业适配
    industry = min(1.0, student.industry_adaptability / max(job.industry_adaptability, 1))
    # 意向匹配
    role_match = student.role_match_score  # 预计算的语义相似度

    return 0.25 * learn + 0.2 * trajectory + 0.2 * industry + 0.35 * role_match
```

### 5.3 匹配输出结构

```json
{
  "job_id": "jp-001-abc",
  "student_id": "sp-001-xyz",
  "total_score": 0.78,
  "dimension_scores": {
    "basic_requirements": { "score": 0.90, "weight": 0.20, "details": { "degree": "pass", "experience": 0.85, "city": 1.0, "salary": 0.8 } },
    "professional_skills": { "score": 0.72, "weight": 0.35, "matched_count": 3, "total_required": 4, "gap_cost": 5.0 },
    "soft_competencies": { "score": 0.80, "weight": 0.25, "per_item": { "communication": 1.0, "teamwork": 0.75, "leadership": 0.5, "stress_tolerance": 1.0, "responsibility": 0.75, "problem_solving": 1.0 } },
    "growth_potential": { "score": 0.65, "weight": 0.20 }
  },
  "skill_gaps": [
    { "skill_id": "fe-vue", "skill_name": "Vue.js", "job_level": 3, "student_level": 0, "gap": 3, "importance": "preferred" }
  ],
  "strengths": [
    { "skill_id": "lang-java", "skill_name": "Java", "student_level": 4, "job_level": 4, "note": "完全匹配" }
  ],
  "recommendations": [
    "建议学习 Vue.js 前端框架以补充技能缺口",
    "团队协作能力可通过更多项目经历提升"
  ]
}
```

### 5.4 对齐保障机制

| 保障点 | 方法 |
|--------|------|
| **技能 ID 统一** | Job 和 Student 的技能都映射到同一技能词表的 `skill_id`，确保可比 |
| **等级刻度统一** | 所有 1-5 分的子项使用相同定义，Job 表示"要求"，Student 表示"能力" |
| **证据可追溯** | 每个维度值都附带 `evidence`，记录来源段落，支持人工复核 |
| **缺失值处理** | Job 端缺失默认取最低要求；Student 端缺失默认取最低能力 |
| **词表版本锁定** | 画像生成时记录词表版本，避免不同版本的画像互相比较 |

---

## 六、数据库存储建议

```sql
-- 统一画像存储（两张表共享 dimensions JSONB 结构）

CREATE TABLE job_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_job_code VARCHAR(64) UNIQUE,
    basic_info      JSONB NOT NULL,
    dimensions      JSONB NOT NULL,       -- 四维结构化数据
    raw_description TEXT,
    company_intro   TEXT,
    skill_ids       TEXT[] GENERATED ALWAYS AS (
        ARRAY(SELECT jsonb_array_elements_text(
            jsonb_path_query_array(dimensions, '$.professional_skills[*].skill_id')
        ))
    ) STORED,                             -- 技能ID数组，用于 GIN 索引加速
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE student_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    basic_info      JSONB NOT NULL,
    education       JSONB,
    experience      JSONB,
    dimensions      JSONB NOT NULL,       -- 四维结构化数据（与 job 同构）
    certificates    JSONB,
    self_evaluation TEXT,
    skill_ids       TEXT[] GENERATED ALWAYS AS (
        ARRAY(SELECT jsonb_array_elements_text(
            jsonb_path_query_array(dimensions, '$.professional_skills[*].skill_id')
        ))
    ) STORED,
    source_file     VARCHAR(256),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 匹配结果表
CREATE TABLE match_results (
    id              SERIAL PRIMARY KEY,
    job_id          UUID REFERENCES job_profiles(id),
    student_id      UUID REFERENCES student_profiles(id),
    total_score     FLOAT NOT NULL,
    dimension_scores JSONB NOT NULL,
    skill_gaps      JSONB,
    strengths       JSONB,
    recommendations JSONB,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(job_id, student_id)
);

-- 索引
CREATE INDEX idx_jp_skill_ids ON job_profiles USING GIN(skill_ids);
CREATE INDEX idx_sp_skill_ids ON student_profiles USING GIN(skill_ids);
CREATE INDEX idx_jp_role ON job_profiles ((basic_info->>'role'));
CREATE INDEX idx_match_score ON match_results(total_score DESC);
```
