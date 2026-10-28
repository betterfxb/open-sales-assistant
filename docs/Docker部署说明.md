# Docker 部署说明

更新时间：2026-10-23

本说明用于通过 Docker Compose 运行 Open Sales Assistant。

如果你希望自部署流程可重复，并且不想在宿主机上手动安装 Node.js，建议使用 Docker。

## 1. 环境要求

- Docker Engine
- Docker Compose v2

检查：

```bash
docker --version
docker compose version
```

## 2. 配置环境变量

复制示例文件：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
PORT=3100
PUBLIC_BASE_URL=http://localhost:3100
STORAGE_DRIVER=json
DEMO_LANGUAGE_SWITCH=false

ADMIN_USERNAME=admin
ADMIN_PASSWORD=替换为至少 12 位的强密码

AI_PROVIDER=kimi
AI_BASE_URL=https://api.moonshot.cn/v1
AI_API_KEY=请替换为你自己的 API Key
AI_TEXT_MODEL=kimi-k2.6
AI_VISION_MODEL=kimi-k2.6
```

不要把 `.env` 提交到 GitHub。

如果 `AI_API_KEY` 为空，应用仍然可以启动，并在依赖 AI 的流程中使用本地 fallback 回复。

默认界面和 demo 数据都是英文。只有当你明确希望公开语言切换同时替换该部署中的 demo 数据时，才设置 `DEMO_LANGUAGE_SWITCH=true`。

## 3. 启动

```bash
docker compose up -d --build
```

打开：

```text
http://localhost:3100/
http://localhost:3100/login.html
http://localhost:3100/admin.html
http://localhost:3100/api/health
```

## 4. 查看状态和日志

```bash
docker compose ps
docker compose logs -f
```

## 5. 停止

```bash
docker compose down
```

该命令会停止容器，但会保留本地 `data/` 和 `uploads/` 文件。

## 6. 数据持久化

`docker-compose.yml` 挂载：

| 宿主机路径 | 容器路径 | 用途 |
| --- | --- | --- |
| `./data` | `/app/data` | JSON 数据库和备份 |
| `./uploads` | `/app/uploads` | 上传文件 |

JSON 存储继续作为默认存储模式：

```env
STORAGE_DRIVER=json
```

Docker 快速启动不需要数据库。单实例试用可继续使用 JSON。多人小团队试点可用 PostgreSQL Compose 覆盖文件：

1. 在 `.env` 中设置 `ADMIN_PASSWORD`、`POSTGRES_PASSWORD`（建议使用长的字母数字随机值）和 `STORAGE_DRIVER=postgres`。
2. 导入现有 JSON 数据，并启动 PostgreSQL 服务：

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.postgres.yml run --rm open-sales-assistant npm run migrate:postgres -- --file /app/data/db.json
   ```

3. 启动完整服务：

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.postgres.yml up -d --build
   ```

首次部署没有 JSON 数据时，可直接执行第 3 步。PostgreSQL 数据保存在 `postgres_data` Docker volume；应用逻辑备份保存在 `./data/backups/`。运行 PostgreSQL 模式前请确认 `DATABASE_URL` 中的密码格式可用于 URL；使用特殊字符时需进行 URL 编码。

PostgreSQL 当前将完整应用状态存为一条 JSONB 记录，写请求会串行处理，适用于低到中等写入量的团队试点。JSON 文件模式的并发锁只对单个 Node.js 进程有效。

## 7. 更新

```bash
git pull
docker compose up -d --build
```

除非你明确要重置数据，否则不要覆盖生产环境的 `data/db.json`。

## 8. 反向代理

生产域名建议在容器前面放 Nginx 或其他反向代理：

```nginx
server {
    listen 80;
    server_name 你的域名;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 9. 排查

如果容器启动成功，但 AI 回复仍是 fallback，检查：

```bash
docker compose exec open-sales-assistant printenv AI_API_KEY
docker compose logs -f
```

如果上传文件失败，检查宿主机 `uploads/` 目录是否允许 Docker 写入。
