# CareerAI 项目概览与架构说明

> **文档用途**：Claude Code / Codex 执行代码任务时的上下文文档，包含项目架构、模块边界、已有实现和开发约定  
> **版本**：v1.0 · 2026-03-24  
> **仓库**：https://github.com/fengfangwen061026/career-planning-app

---

## 一、项目概况

**CareerAI** 是一个 AI 驱动的大学生职业规划 Web 应用，参加第十七届中国大学生服务外包创新创业大赛（A13 赛题）。

核心流程：**简历上传 → AI 解析生成学生画像 → 四维人岗匹配 → 双轨职业路径规划 → 可编辑报告导出**

关键时间节点：
- **2026-04-05**：内部截止（功能冻结）
- **2026-04-11 ~ 04-15**：初赛作品提交窗口
- **2026-04-16 ~ 05-05**：线上评审

---

## 二、仓库结构

```
career-planning-app/
├── backend/                    # Python FastAPI 后端
│   ├── app/
│   │   ├── main.py             # FastAPI 应用入口
│   │   ├── config.py           # 配置（读取根目录 .env）
│   │   ├── models/             # SQLAlchemy ORM 模型
│   │   ├── routers/            # API 路由
│   │   ├── services/           # 业务逻辑层
│   │   │   ├── ai/             # AI 相关服务
│   │   │   │   ├── llm_provider.py    # 统一 LLM 封装
│   │   │   │   ├── embedding.py       # DashScope 向量嵌入
│   │   │   │   ├── job_profile_generator.py
│   │   │   │   ├── resume_parser.py
│   │   │   │   ├── student_profile_generator.py
│   │   │   │   ├── matching_engine.py
│   │   │   │   └── report_generator.py
│   │   │   └── ...
│   │   └── schemas/            # Pydantic 请求/响应模型
│   ├── alembic/                # 数据库迁移
│   └── requirements.txt
├── frontend/
│   ├── admin/                  # 管理端（React + Vite + Ant Design）
│   └── mobile/                 # 学生端（独立 Vite 项目）
├── .env                        # 环境变量（API keys, DB URL, 模型名等）
└── README.md
```

---

## 三、技术架构

### 3.1 分层架构

```
┌──────────────────────────────────────────────┐
│ 界面层 (Presentation)                         │
│   Admin Frontend (React+Vite+AntDesign)       │
│   Mobile Frontend (React+Vite, 独立项目)      │
├──────────────────────────────────────────────┤
│ 应用层 (Application) - FastAPI                │
│   /api/jobs       - JD 数据管理               │
│   /api/profiles   - 岗位画像 CRUD             │
│   /api/students   - 学生画像 + 简历上传       │
│   /api/matching   - 人岗匹配                  │
│   /api/reports    - 报告生成/编辑/导出         │
│   /api/graph      - 岗位图谱数据              │
│   /api/dashboard  - 管理端统计                │
├──────────────────────────────────────────────┤
│ AI 能力层 (AI Services)                       │
│   LLMProvider     - 统一大模型接口封装        │
│   EmbeddingService- DashScope text-embedding-v4│
│   ResumeParser    - 简历解析（mammoth+LLM）   │
│   ProfileGenerator- 画像生成（统计+LLM融合）  │
│   MatchingEngine  - 四维评分引擎              │
│   ReportGenerator - 报告分块生成              │
├──────────────────────────────────────────────┤
│ 数据层 (Data)                                 │
│   PostgreSQL 16 + pgvector                    │
│   文件存储（本地/简历文件+报告PDF）           │
└──────────────────────────────────────────────┘
```

### 3.2 技术选型

| 组件 | 选型 | 备注 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | |
| 构建工具 | Vite | 管理端和学生端各自独立构建 |
| UI 库 | Ant Design (管理端) | 学生端自定义组件 |
| 图表 | Recharts | |
| 图谱可视化 | D3.js | 替换了早期的 Cytoscape.js |
| 后端框架 | FastAPI | async 支持 |
| ORM | async SQLAlchemy | |
| 数据库迁移 | Alembic | |
| 数据库 | PostgreSQL 16 + pgvector | |
| LLM | StepFun Step-3.5-Flash | 开发环境通过 OpenRouter 调用 |
| 向量嵌入 | Alibaba Cloud DashScope text-embedding-v4 | 1024 维 |
| DOCX 解析 | mammoth | 提取纯文本 |

---

## 四、核心模块详解

### 4.1 LLM 调用约定

```python
# 统一通过 LLMProvider 调用，支持一键切换模型
# 开发环境配置（.env）:
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-xxx
LLM_MODEL=stepfun/step-3.5-flash

# 生产环境配置:
LLM_BASE_URL=https://api.stepfun.com/v1
LLM_API_KEY=xxx
LLM_MODEL=step-3.5-flash
```

关键规则：
- OpenRouter 请求必须设置 `HTTP-Referer` 和 `X-Title` header（在 `AsyncOpenAI` 初始化时传入 `default_headers`）
- 延迟敏感任务设置 `disable_reasoning=True`（简历解析、软技能评估）
- 所有结构化输出使用 `structured_output` + JSON Schema 强制校验
- 后台任务（画像生成等）不限制时间，数据质量优先

### 4.2 岗位画像生成流程

```
JD 原始数据 (jobs 表, ~9,178 条)
    ↓ 按岗位角色聚合
相近 JD 聚合组 (51 种角色)
    ↓ 
统计抽取: 高频技能/工具/证书关键词
    ↓
LLM 结构化抽取: 使用全部可用 JD (180K token budget)
    ↓
融合校验: 统计结果 + LLM 结果合并，每字段保留来源证据
    ↓
结构化岗位画像 (job_profiles 表)
```

### 4.3 学生画像生成流程

```
简历文件 (DOCX/PDF)
    ↓ mammoth 提取纯文本
简历纯文本
    ↓ LLM 结构化抽取 (structured_output)
原始结构化数据 (教育/实习/项目/技能/证书/成果)
    ↓ 标准化归一 (技能词表 + 同义词映射)
标准化画像 + 完整度评分 + 竞争力评分
```

软素养 schema（已统一）:
```json
{
  "soft_competencies": {
    "communication": {"value": 4, "evidence": "担任项目组对外联络人..."},
    "pressure_resistance": {"value": 3, "evidence": "独立完成毕设答辩..."},
    "learning_ability": {"value": 5, "evidence": "3个月自学React并..."}
  }
}
```

### 4.4 人岗匹配引擎

四维评分架构：

```
学生画像 + 岗位画像
    ↓
┌─ ① 基础要求 ─── 学历/专业/城市/实习时间，规则化打分
├─ ② 职业技能 ─── 必备技能硬约束 + 加分技能叠加 + 向量语义补偿
├─ ③ 职业素养 ─── 行为证据抽取，有证据得分/无证据降权
└─ ④ 发展潜力 ─── 成长轨迹 + 学习深度 + 项目复杂度
    ↓
加权汇总 (权重按岗位类型配置)
    ↓
匹配总分 + 各维度分数 + 差距清单 (按优先级排序)
```

性能优化措施（已实施）：
- `asyncio.gather` 并发匹配
- Semaphore 限制 5 个并发 LLM 调用
- 规则预过滤减少 LLM 调用量
- 60s 超时保护
- 总耗时从 ~300s 降至 ~15s

### 4.5 岗位图谱

- 垂直晋升：level 分层（初级→中级→高级→负责人），基于 JD 年限/职责复杂度/团队规模
- 横向转岗：技能重叠度 + 缺口成本排序
- 前端：D3.js 力导向图，节点可点击查看岗位画像

### 4.6 报告生成

分块生成策略（避免长文一次性生成不稳定）：
```
第一步: 生成结构化纲要 (章节标题 + 要点)
第二步: 逐章生成内容
第三步: 合并 + 完整性检查
```

报告必需章节（赛题要求）：
1. 个人能力画像摘要
2. 目标岗位分析（匹配度 + 四维评分）
3. 差距与行动计划（短期/中期）
4. 职业路径规划（垂直 + 横向）
5. 评估周期与指标

---

## 五、前端架构

### 5.1 管理端 (frontend/admin/)

基于 Ant Design 的标准后台管理界面：
- Dashboard 统计面板
- JD 数据管理 (表格 + 搜索 + 分页)
- 岗位画像管理 (列表 + 详情 Modal)
- 岗位图谱 (D3.js 全屏可视化)
- 学生管理

### 5.2 学生端 (frontend/mobile/)

独立 Vite 项目，移动优先设计：

**设计风格**：硅谷果味美学（frosted glass + 弹性动画）
- 主色：#4F46E5 靛蓝
- 字体：-apple-system, PingFang SC
- 卡片：毛玻璃效果 `backdrop-filter: blur(20px)`
- 动效：`cubic-bezier` 弹性动画，参考 `动效设计规范_v1_0.docx`

**页面结构**（15 个屏幕）：
- S-01~03: 引导页 (Onboarding)
- S-04: 简历上传
- S-05: 解析等待（SSE 进度）
- S-06: 学生画像仪表盘
- S-07: 画像补全页
- S-08~10: 岗位探索 + 匹配结果
- S-11: 匹配详情（四维雷达图 + 差距清单 + 职业路径）
- S-12~13: 报告页（生成中 / 生成完成）
- S-14: 空状态
- S-15: 个人设置

**底部 Tab Bar**: 4 Tab（上传/画像/探索/报告）

**当前状态**：大部分页面使用静态 mock 数据，API 接入进行中。

### 5.3 API 接入现状

| 端点类型 | 说明 | 管理端 | 学生端 |
|----------|------|--------|--------|
| 数据查询 | JD/画像/匹配结果 | ✅ 已接入 | ❓ 可复用 |
| 简历上传 | multipart + SSE | ✅ | ❓ 需接入 |
| 匹配触发 | POST + 异步结果 | ✅ | ❓ 需接入 |
| 报告生成 | 需新建端点（流式） | — | ❌ 需开发 |
| 多轮对话 | 需新建端点 | — | ❌ 需开发 |

---

## 六、数据库 Schema 关键表

### 6.1 jobs（JD 原始数据）

~9,178 条记录。Dashboard「已入库岗位」映射到此表。

### 6.2 job_profiles（岗位画像）

23 条记录。每条包含一个岗位角色的完整结构化画像 JSON。

### 6.3 students / student_profiles（学生画像）

包含解析后的结构化画像 + 完整度评分 + 竞争力评分。

### 6.4 matching_results（匹配结果）

四维评分 + 权重 + 差距清单 + 总分。

---

## 七、配置与环境

### 7.1 环境变量 (.env)

```bash
# 数据库
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/career_ai

# LLM (开发环境 - OpenRouter)
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-xxx
LLM_MODEL=stepfun/step-3.5-flash

# 向量嵌入 (DashScope)
DASHSCOPE_API_KEY=sk-xxx
EMBEDDING_MODEL=text-embedding-v4

# 其他
SECRET_KEY=xxx
```

### 7.2 配置读取

`config.py` 通过 `Path(__file__).resolve().parents[2]` 定位到项目根目录的 `.env`。
**绝对不硬编码任何 URL、API Key 或模型名称。**

### 7.3 开发环境

- OS: Windows + WSL2
- PowerShell 不支持 `&&` 命令链
- uvicorn 新增 `.py` 文件后需手动重启
- Vite 代理 SSE 需 `selfHandleResponse: false`

---

## 八、开发约定（Claude Code 必读）

### 8.1 代码变更规范

1. **先读数据再写代码**：生成 schema/配置前，先 grep 或读取实际项目文件确认当前状态
2. **Schema 两端验证**：任何涉及前后端数据交互的变更，必须同时检查两端的字段名和嵌套结构
3. **结构化输出强制**：所有 AI 生成结构化数据必须使用 `structured_output` + JSON Schema
4. **不猜测，不假设**：不确定时用 grep/find 查实际代码，不基于假设写代码

### 8.2 提交格式

所有代码变更以 `.md` prompt 文件形式交付，包含：
- 精确代码片段（带文件路径）
- search/grep 命令（定位需要修改的位置）
- 有序执行步骤
- 自动化 PASS/FAIL 验证命令

### 8.3 测试验证

每个变更必须包含验证步骤：
```bash
# 示例验证命令
curl -X POST http://localhost:8000/api/students/upload -F "file=@test.docx"
# 预期: HTTP 200, response.body 包含 student_profile_id
```

### 8.4 分工边界

| 角色 | 职责 |
|------|------|
| Claude (本项目) | 架构判断、代码审查、生成 prompt 文件、方向决策 |
| Claude Code | 按 prompt 文件执行代码修改、运行测试 |
| Codex (GPT) | 复杂自诊断任务（需要多轮探索的问题） |

---

## 九、当前开发优先级

### Phase 1: 功能补全（3/24 ~ 4/1）

1. **报告生成模块端到端打通**
   - 后端：`report_generator.py` 分块生成 + PDF 导出
   - 前端（学生端）：报告页 API 接入
   
2. **换岗路径数据补全**
   - 确保 ≥ 5 个岗位有 ≥ 2 条横向转岗路径
   - 图谱数据中包含 transferable_skills + gap_skills

3. **学生端核心页面 API 接入**
   - 简历上传 → SSE 进度
   - 画像页 → 真实数据渲染
   - 匹配页 → 四维评分 + 差距清单

### Phase 2: 质量打磨（4/1 ~ 4/5）

4. 报告编辑 + 润色 + 完整性检查
5. Demo 数据预加载
6. 准确率抽样验证
7. 端到端冒烟测试

### Phase 3: 交付物准备（4/5 ~ 4/11）

8. 项目概要介绍 PDF
9. 项目简介 PPT
10. 项目详细方案 PDF
11. 演示视频录制
12. 本地知识库资料整理
