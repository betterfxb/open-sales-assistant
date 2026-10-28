# Open Sales Assistant

[English](README.md) | [简体中文](README.zh-CN.md)

Open Sales Assistant is a self-hosted sales assistant starter kit. Its current product focus is a lightweight lead follow-up workspace for small B2B teams: track leads, owners, conversation history, and next actions, then prepare AI-assisted drafts for human review.

This is an early, single-team trial version, not a hosted multi-tenant SaaS. The target team and value proposition are still being validated. The AI does not send messages automatically.

The included dataset is an English demo for a training course sales scenario. It is kept as an initial example so new users can run the project immediately and understand the workflow.

For Chinese readers, see [README.zh-CN.md](README.zh-CN.md) for the full Chinese project overview, quick start, AI API configuration, and roadmap.

## Features

- H5/customer chat entry for sales consultation.
- Admin login and sales knowledge base management.
- Sales lead workspace with manual entry, CSV/XLSX import, stages, owners, follow-up dates, and a due/overdue queue.
- Team accounts with super-admin, manager, and sales-rep roles; sales reps see only their assigned leads.
- Lead activity timeline and AI-generated next-step/message drafts for human review; no automatic outbound sending.
- Text, document, and image material upload.
- AI-assisted material analysis and pending suggestions.
- FAQ, sales playbook, concern handling, and knowledge summary editing.
- Customer profile, chat history, AI analysis, and follow-up records.
- Admin operation logs for sign-in, data export/backup, knowledge, material, customer, certificate, and settings changes.
- Certificate record import and query demo flow.
- JSON-file storage for local development and single-instance trials, plus an optional PostgreSQL adapter and JSON migration/backup tools.
- English-first UI with an English/Chinese switch for customer chat, admin login, and admin console.
- English and Chinese demo fixtures. Local demo mode can switch the demo dataset together with the UI language.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Docker quick start:

```bash
cp .env.example .env
docker compose up -d --build
```

Set `ADMIN_PASSWORD` in `.env` to a unique password of at least 12 characters before starting. For a small multi-user pilot on PostgreSQL, follow the [Docker deployment guide](docs/en/docker-deployment.md).

Open:

- Customer entry: http://localhost:3100/
- Customer login: http://localhost:3100/login.html
- Admin console: http://localhost:3100/admin.html
- Health check: http://localhost:3100/api/health

Default admin credentials are configured in `.env`:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace_with_a_unique_password_at_least_12_chars
```

Set `AI_API_KEY` before using AI analysis or chat generation.

## Configure Your Own AI API

Open Sales Assistant uses environment variables for AI settings. It does not store API keys in the admin UI or in `data/db.json`.

Create your local `.env` file:

```bash
cp .env.example .env
```

Then edit `.env` and set your own OpenAI-compatible API key:

```env
AI_PROVIDER=kimi
AI_BASE_URL=https://api.moonshot.cn/v1
AI_API_KEY=your_api_key_here
AI_TEXT_MODEL=kimi-k2.6
AI_VISION_MODEL=kimi-k2.6
```

Do not commit `.env` to GitHub. The repository `.gitignore` already excludes it.

If `AI_API_KEY` is empty or still contains the placeholder text, the app uses local fallback responses. This is enough to test pages and data flow, but AI analysis and AI chat generation will not call a real model.

Provider examples:

```env
# Kimi / Moonshot
AI_PROVIDER=kimi
AI_BASE_URL=https://api.moonshot.cn/v1
AI_TEXT_MODEL=kimi-k2.6
AI_VISION_MODEL=kimi-k2.6

# OpenAI
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1
AI_TEXT_MODEL=gpt-4o-mini
AI_VISION_MODEL=gpt-4o-mini

# DeepSeek
AI_PROVIDER=deepseek
AI_BASE_URL=https://api.deepseek.com
AI_TEXT_MODEL=deepseek-chat
AI_VISION_MODEL=deepseek-chat

# DashScope / Tongyi Qianwen
AI_PROVIDER=dashscope
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_TEXT_MODEL=qwen-plus
AI_VISION_MODEL=qwen-vl-plus
```

The `/api/health` endpoint only reports whether AI is configured and which model names are active. It never returns the API key.

## Documentation

Start here:

- English overview: [README.md](README.md)
- Chinese overview: [README.zh-CN.md](README.zh-CN.md)

| Topic | English | Chinese |
| --- | --- | --- |
| Current version | [current-version.md](docs/en/current-version.md) | [当前版本说明.md](docs/当前版本说明.md) |
| Roadmap | [roadmap.md](docs/en/roadmap.md) | [团队销售工具全功能开发与迭代计划.md](docs/团队销售工具全功能开发与迭代计划.md) |
| Development plan | [development-plan.md](docs/en/development-plan.md) | [开发计划.md](docs/开发计划.md) |
| Data migration and backup | [data-migration-and-backup.md](docs/en/data-migration-and-backup.md) | [数据迁移与备份说明.md](docs/数据迁移与备份说明.md) |
| Storage strategy | [storage-strategy.md](docs/en/storage-strategy.md) | [存储策略.md](docs/存储策略.md) |
| Prompt evaluation | [prompt-evaluation.md](docs/en/prompt-evaluation.md) | [销售回复Prompt评测.md](docs/销售回复Prompt评测.md) |
| Docker deployment | [docker-deployment.md](docs/en/docker-deployment.md) | [Docker部署说明.md](docs/Docker部署说明.md) |
| Server deployment | [server-deployment.md](docs/en/server-deployment.md) | [服务器部署说明.md](docs/服务器部署说明.md) |
| BT Panel deployment | [bt-panel-deployment.md](docs/en/bt-panel-deployment.md) | [宝塔面板部署指南.md](docs/宝塔面板部署指南.md) |

## Development Checks

```bash
npm test
```

The test command runs JavaScript syntax checks, storage and migration tests, an HTTP smoke test, and the baseline sales-reply evaluation. It does not require an AI API key or PostgreSQL; set `POSTGRES_TEST_DATABASE_URL` to also run the optional real-database integration test.

## Demo Data

`data/db.json` contains sample English training-course sales data. Treat it as demo content only:

- It demonstrates how sales materials become a knowledge base.
- It is not a production dataset.
- Replace it with your own product, service, pricing, FAQ, and compliance rules before real use.

To restore the committed demo dataset after local experiments:

```bash
npm run reset-demo
```

Language-specific demo reset commands:

```bash
npm run reset-demo:en
npm run reset-demo:zh
```

The default UI language is English. Selecting Chinese from the UI switches the interface to Chinese and, in local demo mode, switches the demo dataset to the Chinese fixture. In production, public demo switching is disabled unless `DEMO_LANGUAGE_SWITCH=true` is explicitly configured.

## Open Source Boundary

This repository is not a SaaS platform. The lead workspace is an early validation build; before adding industry-specific templates or channel connectors, validate that small B2B teams repeatedly use it to prevent missed follow-ups and prepare customer conversations faster. See [Sales Operations Agent MVP](docs/销售运营Agent-MVP.md).

The current pilot supports one team with PostgreSQL-backed storage, team roles, lead ownership, and serialized writes. PostgreSQL stores the full application state in one JSONB row, so all writes queue behind one lock; use it for low to moderate write volume. JSON remains suitable for local development and a single application process. Larger deployments need relational tables and multi-team isolation. This is not a hosted SaaS platform.

## Prompt Evaluation

Run the bilingual, no-key sales reply baseline:

```bash
npm run eval
```

To evaluate the configured AI provider and model instead:

```bash
npm run eval:ai
```

See [Sales Reply Prompt Evaluation](docs/en/prompt-evaluation.md) for dataset rules, safety checks, and contribution guidance.

JSON storage remains the default lightweight mode. PostgreSQL is available through an optional storage adapter; MySQL is not implemented.

## Roadmap

- Validate the lead workspace with a narrow group of small B2B teams.
- Migrate PostgreSQL state from one JSONB row to relational tables as data volume and write concurrency grow.
- Add multi-team isolation and run real PostgreSQL integration checks in CI.
- Improve operation log search and detail views.
- Add editable AI suggestions and knowledge version history.
- Improve Docker deployment and production self-hosting examples.
- Add customer segmentation and sales funnel dashboards.
- Add connector examples for CRM, forms, chat tools, and spreadsheets.
- Expand prompt evaluation with model comparisons and reviewed traces.

## Codex for Open Source Goal

This project is being prepared as an open-source sales assistant starter kit. Codex would be used for maintainer workflows such as issue triage, PR review, test generation, release notes, documentation updates, and prompt/evaluation improvements.

## License

MIT
