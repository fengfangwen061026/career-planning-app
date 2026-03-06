# 大学生职业规划 Web 应用

## 快速启动

### 1. 启动 Docker 服务

```bash
# 启动 PostgreSQL + Redis
docker-compose up -d

# 查看服务状态
docker-compose ps
```

### 2. 初始化数据库

```bash
# 执行 Alembic 迁移
cd backend && alembic upgrade head
```

### 3. 导入 JD 数据

```bash
# 导入原始 JD 数据（Excel 文件）
python scripts/seed_data.py -f "a13基于AI的大学生职业规划智能体-JD采样数据.xls"

# 批量大小可自定义（默认 500）
python scripts/seed_data.py -f "a13基于AI的大学生职业规划智能体-JD采样数据.xls" --batch-size 1000
```

### 4. 启动后端服务

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

### 5. 启动前端服务

```bash
cd frontend && npm run dev
```

## API 接口

### Jobs

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/jobs | 分页查询岗位列表 |
| GET | /api/jobs/{id} | 获取单个岗位详情 |
| PATCH | /api/jobs/{id} | 更新岗位信息 |
| DELETE | /api/jobs/{id} | 删除岗位 |

**查询参数：**
- `page`: 页码（默认 1）
- `page_size`: 每页数量（默认 20，最大 100）
- `role`: Role 筛选
- `keyword`: 关键词搜索（岗位名称/公司名/城市）

### Roles

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/roles | 获取所有 Role 列表及统计 |

**查询参数：**
- `include_stats`: 是否包含统计信息（默认 true）

## 环境变量

项目根目录 `.env` 文件包含以下配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DATABASE_URL | PostgreSQL 连接字符串 | postgresql+asyncpg://postgres:postgres@localhost:5432/career_planning |
| LLM_BASE_URL | LLM API 地址 | https://api.minimax.chat/v1 |
| LLM_API_KEY | LLM API 密钥 | - |
| LLM_MODEL | LLM 模型名称 | default-model |
| EMBEDDING_BASE_URL | Embedding API 地址 | https://api.minimax.chat/v1 |
| EMBEDDING_API_KEY | Embedding API 密钥 | - |
| EMBEDDING_MODEL | Embedding 模型名称 | default-embedding-model |

## Docker 服务

- **PostgreSQL**: localhost:5432 (数据库: career_planning)
- **Redis**: localhost:6379

## 技术栈

- 前端: TypeScript + React (Vite)
- 后端: Python + FastAPI
- 数据库: PostgreSQL + pgvector
- LLM: OpenAI 兼容接口
