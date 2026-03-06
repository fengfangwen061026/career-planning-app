# 大学生职业规划 Web 应用

## 项目简介

基于 AI 的大学生职业规划 Web 应用。

- **前端**: TypeScript + React (Vite)，端口 5173
- **后端**: Python + FastAPI，端口 8000
- **数据库**: PostgreSQL + pgvector
- **LLM**: 任意 OpenAI 兼容接口，通过环境变量配置：
  - `LLM_BASE_URL`: API 基础地址
  - `LLM_API_KEY`: API 密钥
  - `LLM_MODEL`: 模型名称

## 架构约定

- 所有 LLM 调用通过 `backend/app/services/llm_provider.py` 封装，禁止在其他地方直接初始化 OpenAI client
- 画像数据结构变更需同步：
  - `backend/app/schemas/profiles.py`
  - `frontend/src/types/profiles.ts`
- 数据库变更必须走 Alembic 迁移

## 常用命令

```bash
# 启动后端
cd backend && uvicorn app.main:app --reload --port 8000

# 启动前端
cd frontend && npm run dev

# 执行数据库迁移
cd backend && alembic upgrade head

# mypy 类型检查
cd backend && mypy app

# tsc 类型检查
cd frontend && npx tsc --noEmit
```

## 功能优先级

- P0: 简历解析 → 学生画像 → 岗位画像 → 匹配评分 → 报告生成导出
