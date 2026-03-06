# Career Planner Backend

基于 AI 的大学生职业规划后端服务。

## 技术栈

- **FastAPI**: 现代高性能 Web 框架
- **SQLAlchemy (async)**: 异步 ORM
- **PostgreSQL + pgvector**: 向量数据库
- **OpenAI SDK**: LLM 和 Embedding 接口

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填写配置
```

### 3. 运行数据库迁移

```bash
alembic upgrade head
```

### 4. 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

## API 端点

- `GET /health` - 健康检查
- `/api/jobs` - 岗位管理
- `/api/students` - 学生管理
- `/api/matching` - 人岗匹配
- `/api/reports` - 报告生成
- `/api/graph` - 知识图谱

## 开发规范

- 所有 LLM 调用通过 `app.ai.llm_provider` 封装
- 数据库变更必须走 Alembic 迁移
- 使用 async/await 异步编程
- 所有函数必须包含类型注解
