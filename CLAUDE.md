# 大学生职业规划 Web 应用

## 项目简介

基于 AI 的大学生职业规划 Web 应用。

- **前端**: TypeScript + React (Vite)，端口 5173
- **后端**: Python + FastAPI，端口 8000
- **数据库**: PostgreSQL + pgvector，端口 5433
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

## 数据现实

### 数据集描述
- **记录数**：9958 条（去重后按岗位编码）
- **去重岗位数**：51 个
- **数据来源**：智联招聘

### 数据质量问题（必须记录）
1. **岗位详情截断**：平均仅 295 字符，151 条为空值。部分 JD 文本被上游采集截断
2. **薪资格式不统一**：三种模式混存 —— "5000-7000元"、"2-3万"、"1.5-3万·14薪"
3. **地址含 None**：部分记录如 "郑州-None"，区级信息缺失
4. **行业字段重复拼接**：如 "物联网,物联网"、"计算机软件,计算机软件"
5. **日期缺年份**：只有 "5月19日" 格式，无法确定年份
6. **岗位分布不均匀**：头部 5 个岗位各约 591 条，尾部 21 个岗位各恰好 147 条（采样策略导致）

## 功能优先级

- P0: 简历解析 → 学生画像 → 岗位画像 → 匹配评分 → 报告生成导出
