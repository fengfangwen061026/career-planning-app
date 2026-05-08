# 生产部署说明

这套部署文件与仓库当前代码保持一致，目标拓扑如下：

- `/` -> `/var/www/career/mobile`
- `/admin/` -> `/var/www/career/admin`
- `/api/`、`/ws/` -> `127.0.0.1:8000`
- PostgreSQL 16 + pgvector -> `127.0.0.1:5433`
- Redis 7 -> `127.0.0.1:6379`

## 1. 服务器初始化

在新机器上以 `root` 运行：

```bash
bash deploy/scripts/bootstrap_server.sh
```

## 2. 准备后端环境变量

复制示例文件并填写真实值：

```bash
cd /opt/career-ai/app
cp backend/.env.example backend/.env
```

注意：

- `POSTGRES_PASSWORD` 必须与 `DATABASE_URL` 中的密码完全一致
- `docker compose` 启动时请使用 `--env-file backend/.env`
- Alembic 与 systemd 现在都支持优先读取 `backend/.env`

## 3. 部署应用

在仓库根目录运行：

```bash
bash deploy/scripts/deploy_app.sh
```

脚本会执行：

- `docker compose --env-file backend/.env up -d`
- 后端虚拟环境安装与 Alembic 迁移
- 管理端和移动端构建
- 静态文件同步到 `/var/www/career`
- 安装 systemd 服务与 Nginx 站点配置
- 申请或复用 Let’s Encrypt 证书

## 4. 验收

```bash
bash deploy/scripts/validate_deploy.sh
```

## 5. 模板文件

- `deploy/nginx/career.http.conf`: 申请证书前使用的 HTTP 配置
- `deploy/nginx/career.conf`: HTTPS 正式配置
- `deploy/systemd/career-backend.service`: 后端 systemd 服务
