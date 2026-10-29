# Docker Deployment

Updated: 2026-10-23

This guide runs Open Sales Assistant with Docker Compose.

Docker is recommended when you want a repeatable self-hosted deployment without manually installing Node.js on the host.

## 1. Requirements

- Docker Engine
- Docker Compose v2

Check:

```bash
docker --version
docker compose version
```

## 2. Configure Environment Variables

Copy the example file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3100
PUBLIC_BASE_URL=http://localhost:3100
STORAGE_DRIVER=json
DEMO_LANGUAGE_SWITCH=false

ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace_with_a_strong_password_at_least_12_chars

AI_PROVIDER=kimi
AI_BASE_URL=https://api.moonshot.cn/v1
AI_API_KEY=replace_with_your_own_api_key
AI_TEXT_MODEL=kimi-k2.6
AI_VISION_MODEL=kimi-k2.6
```

Do not commit `.env` to GitHub.

If `AI_API_KEY` is empty, the app still starts and uses local fallback responses for AI-dependent flows.

The default UI is Simplified Chinese, while the checked-in demo dataset is an English training-course sales scenario. Set `DEMO_LANGUAGE_SWITCH=true` only when you intentionally want public UI language switching to also replace the demo dataset on that deployment.

## 3. Start

```bash
docker compose up -d --build
```

Open:

```text
http://localhost:3100/
http://localhost:3100/login.html
http://localhost:3100/admin.html
http://localhost:3100/api/health
```

## 4. Logs and Status

```bash
docker compose ps
docker compose logs -f
```

## 5. Stop

```bash
docker compose down
```

This stops the container but keeps local `data/` and `uploads/` files.

## 6. Data Persistence

`docker-compose.yml` mounts:

| Host path | Container path | Purpose |
| --- | --- | --- |
| `./data` | `/app/data` | JSON database and backups |
| `./uploads` | `/app/uploads` | Uploaded files |

JSON storage remains the default storage mode:

```env
STORAGE_DRIVER=json
```

The Docker quick start does not require a database. Keep JSON for a single-instance trial. For a small multi-user pilot, use the PostgreSQL Compose override:

1. Set `ADMIN_PASSWORD`, `POSTGRES_PASSWORD` (use a long random alphanumeric value), and `STORAGE_DRIVER=postgres` in `.env`.
2. Import existing JSON data and start the PostgreSQL service:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.postgres.yml run --rm open-sales-assistant npm run migrate:postgres -- --file /app/data/db.json
   ```

3. Start the complete deployment:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.postgres.yml up -d --build
   ```

For a new deployment with no JSON data, run step 3 directly. PostgreSQL data stays in the `postgres_data` Docker volume; app logical backups go to `./data/backups/`. Ensure the `DATABASE_URL` password is URL-safe; URL-encode special characters.

The current PostgreSQL adapter stores the complete application state in one JSONB row and serializes writes. It fits team pilots with low to moderate write volume. JSON file locking only works within one Node.js process.

## 7. Update

```bash
git pull
docker compose up -d --build
```

Do not overwrite production `data/db.json` unless you intentionally want to reset data.

## 8. Reverse Proxy

For production domains, put Nginx or another reverse proxy in front of the container:

```nginx
server {
    listen 80;
    server_name your-domain;

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

## 9. Troubleshooting

If the container starts but AI responses are fallback responses, check:

```bash
docker compose exec open-sales-assistant printenv AI_API_KEY
docker compose logs -f
```

If file uploads fail, check that the host `uploads/` directory is writable by Docker.
