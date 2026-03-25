# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 大学生职业规划 Web 应用

基于 AI 的大学生职业规划 Web 应用。

- **前端**: TypeScript + React (Vite)，端口 5173
- **后端**: Python + FastAPI，端口 8000
- **数据库**: PostgreSQL + pgvector，端口 5433（通过 Docker 启动）
- **LLM**: 任意 OpenAI 兼容接口，通过环境变量配置

## 常用命令

```bash
# 启动基础设施（PostgreSQL + Redis）
docker-compose up -d

# 启动后端
cd backend && uvicorn app.main:app --reload --port 8000

# 启动前端
cd frontend && npm run dev

# 执行数据库迁移
cd backend && alembic upgrade head

# 运行后端测试（全部）
cd backend && pytest tests/

# 运行单个测试文件
cd backend && pytest tests/test_resume_parser.py -v

# mypy 类型检查
cd backend && mypy app

# tsc 类型检查
cd frontend && npx tsc --noEmit
```

## 架构约定

- 所有 LLM 调用通过 `backend/app/ai/llm_provider.py` 封装，禁止在其他地方直接初始化 OpenAI client
- 支持双 LLM 配置：`LLM_*` 用于通用调用，`PROFILE_LLM_*` 用于学生画像生成（可选，回退到主配置）
- 画像数据结构变更需同步：
  - `backend/app/schemas/profiles.py`
  - `frontend/src/types/profiles.ts`
- 数据库变更必须走 Alembic 迁移（`backend/alembic/versions/`）
- 前端所有 API 调用通过 `frontend/src/api/` 下的模块，base client 在 `api/client.ts`（axios，代理 `/api` → `http://127.0.0.1:8000`）

## 核心数据流

```
简历上传 (PDF/DOCX)
  → resume_parser.py（提取文本）
  → student_profile.py（LLM 生成4D画像）
  → StudentProfile 存入数据库（含向量 embedding）
  → matching.py（多维度评分：胜任力×5 + 潜力×4 + 技能 + 学历）
  → report.py / report_generator.py（生成 HTML/PDF/DOCX）
  → static/exports/ 导出文件
```

## Embedding 缓存层

`backend/app/ai/embedding.py` 实现两级缓存：
1. L1：内存 LRU（OrderedDict，最多 2048 条）
2. L2：数据库持久化（`SkillEmbedding` 表）
- 缓存 key：`SHA256(normalized_text)`

## 职业图谱服务

`backend/app/services/graph.py`：
- **垂直晋升**：基于 Role 职级（entry/growing/mature/expert），边权重 = 晋升难度
- **横向换岗**：技能 Jaccard 相似度 > 0.3 时建边，存储可转移技能 / gap 技能 / 行动计划
- **路径规划**：Dijkstra 算法，支持学生画像 → 目标岗位推荐路径
- 前端用 Cytoscape.js 可视化（`frontend/src/routes/JobGraph.tsx`）

## 关键模型位置

| 模型 | 文件 |
|------|------|
| Student, Resume, StudentProfile | `backend/app/models/student.py` |
| Job, Role, Company | `backend/app/models/job.py` |
| MatchResult, MatchScore | `backend/app/models/matching.py` |
| CareerReport | `backend/app/models/report.py` |
| GraphNode, GraphEdge | `backend/app/models/graph.py` |

## 环境变量（`.env`）

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/career_planning
LLM_BASE_URL=<OpenAI 兼容地址>
LLM_API_KEY=<key>
LLM_MODEL=<model>
PROFILE_LLM_BASE_URL=<可选，画像专用>
PROFILE_LLM_API_KEY=<可选>
PROFILE_LLM_MODEL=<可选>
EMBEDDING_BASE_URL=<embedding 服务地址>
EMBEDDING_API_KEY=<key>
EMBEDDING_MODEL=<model>
LLM_CONCURRENT_LIMIT=10
```

## 数据现实

**数据集**：9958 条智联招聘数据，去重后 51 个岗位

**数据质量问题**：
1. **岗位详情截断**：平均仅 295 字符，151 条为空值
2. **薪资格式不统一**：混存 "5000-7000元"、"2-3万"、"1.5-3万·14薪"
3. **地址含 None**：部分记录如 "郑州-None"
4. **行业字段重复拼接**：如 "物联网,物联网"
5. **日期缺年份**：只有 "5月19日" 格式
6. **岗位分布不均**：头部 5 岗位各 ~591 条，尾部 21 岗位各恰好 147 条

## 功能优先级

- P0: 简历解析 → 学生画像 → 岗位画像 → 匹配评分 → 报告生成导出
