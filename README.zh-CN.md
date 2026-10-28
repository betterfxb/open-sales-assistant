# Open Sales Assistant

[English](README.md) | 简体中文

Open Sales Assistant 是一个自部署的开源销售助手 starter kit。目前产品重点是为小型 B2B 团队提供轻量线索跟进工作台：记录线索、负责人、沟通历史和下一步动作，并基于已记录的信息准备由人工审核的 AI 草稿。

当前版本适合本地演示和单团队小范围试用，不是托管 SaaS，也不提供多租户隔离。目标团队和价值主张仍在验证中；AI 不会自动发送消息。

仓库内默认保留了一份英文课程销售场景的示例数据，用于帮助中英文用户和开源评审快速跑通流程。请把这些数据视为 demo 内容，真实使用前需要替换为你自己的产品资料、价格、FAQ、销售规则和合规说明。

## 适合谁使用

- 小团队想自部署一个 AI 销售助手。
- 个人销售想整理自己的产品资料、话术和客户问答。
- 开发者想基于一个轻量项目扩展 CRM、表单、客服或销售跟进能力。
- 开源贡献者想参与 AI sales assistant、知识库、销售自动化、prompt evaluation 等方向。

## 功能概览

- H5 客户咨询入口。
- 客户登录页和聊天页。
- 管理员登录和后台管理。
- 销售线索工作台：手动建档、CSV/XLSX 导入、阶段/负责人/下次跟进日期、今日及逾期待办。
- 团队账号和角色权限：超级管理员、销售主管、销售；销售只能访问分配给自己的线索。
- 线索沟通时间线，以及基于线索、历史沟通和销售知识生成的 AI 跟进建议草稿；需要人工核对，不会自动发送。
- 销售资料库管理。
- 文本、文档、图片资料上传。
- AI 辅助资料分析和待审核建议。
- FAQ、销售话术、异议处理、知识摘要编辑。
- 客户画像、聊天历史、AI 分析和跟进记录。
- 后台操作日志，记录登录、数据导出/备份、知识库、素材、客户、证书和配置等关键变更。
- 证书记录导入和查询 demo 流程。
- 基于 JSON 文件的本地存储，适合开发和小规模自部署试用。
- 可选 PostgreSQL 存储和 JSON 导入、备份与恢复；JSON 继续作为默认轻量模式。
- 默认英文界面，前台咨询、后台登录和管理后台支持中英文界面切换。
- 提供英文和中文 demo fixture。本地 demo 模式下，切换界面语言时会同步切换 demo 数据。

## 快速启动

```bash
npm install
cp .env.example .env
npm run dev
```

Docker 快速启动：

```bash
cp .env.example .env
docker compose up -d --build
```

复制 `.env.example` 后，请先把 `ADMIN_PASSWORD` 改成至少 12 位的强密码。多人小团队试点可用 PostgreSQL 覆盖配置，步骤见[Docker 部署说明](docs/Docker部署说明.md)。

打开：

- 客户入口：http://localhost:3100/
- 客户登录：http://localhost:3100/login.html
- 管理后台：http://localhost:3100/admin.html
- 健康检查：http://localhost:3100/api/health

默认管理员账号在 `.env` 中配置：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=替换为至少 12 位的强密码
```

使用 AI 分析或 AI 聊天生成前，需要先配置自己的 `AI_API_KEY`。

## 配置自己的 AI API

Open Sales Assistant 通过环境变量配置 AI 服务。项目不会在后台 UI 或 `data/db.json` 中保存用户的 API Key。

先复制环境变量文件：

```bash
cp .env.example .env
```

然后编辑 `.env`，填入你自己的 OpenAI-compatible API Key：

```env
AI_PROVIDER=kimi
AI_BASE_URL=https://api.moonshot.cn/v1
AI_API_KEY=your_api_key_here
AI_TEXT_MODEL=kimi-k2.6
AI_VISION_MODEL=kimi-k2.6
```

不要把 `.env` 提交到 GitHub。仓库 `.gitignore` 已经排除了 `.env`。

如果 `AI_API_KEY` 为空，或者仍然是占位文本，程序会使用本地 fallback 回复。这可以用于验证页面和数据流程，但不会调用真实 AI 模型。

常见服务商配置示例：

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

# DashScope / 通义千问
AI_PROVIDER=dashscope
AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_TEXT_MODEL=qwen-plus
AI_VISION_MODEL=qwen-vl-plus
```

`/api/health` 只返回 AI 是否已配置和当前模型名，不会返回 API Key。

## 文档入口

| 主题 | 中文 | English |
| --- | --- | --- |
| 当前版本 | [当前版本说明.md](docs/当前版本说明.md) | [current-version.md](docs/en/current-version.md) |
| 销售运营 Agent MVP | [销售运营Agent-MVP.md](docs/销售运营Agent-MVP.md) | — |
| 客户验证执行包 | [客户验证执行包.md](docs/客户验证执行包.md) | — |
| 客户访谈与试用记录模板 | [客户访谈与试用记录模板.md](docs/客户访谈与试用记录模板.md) | — |
| Roadmap | [团队销售工具全功能开发与迭代计划.md](docs/团队销售工具全功能开发与迭代计划.md) | [roadmap.md](docs/en/roadmap.md) |
| 开发计划 | [开发计划.md](docs/开发计划.md) | [development-plan.md](docs/en/development-plan.md) |
| 数据迁移与备份 | [数据迁移与备份说明.md](docs/数据迁移与备份说明.md) | [data-migration-and-backup.md](docs/en/data-migration-and-backup.md) |
| 存储策略 | [存储策略.md](docs/存储策略.md) | [storage-strategy.md](docs/en/storage-strategy.md) |
| Prompt 评测 | [销售回复Prompt评测.md](docs/销售回复Prompt评测.md) | [prompt-evaluation.md](docs/en/prompt-evaluation.md) |
| Docker 部署 | [Docker部署说明.md](docs/Docker部署说明.md) | [docker-deployment.md](docs/en/docker-deployment.md) |
| 服务器部署 | [服务器部署说明.md](docs/服务器部署说明.md) | [server-deployment.md](docs/en/server-deployment.md) |
| 宝塔面板部署 | [宝塔面板部署指南.md](docs/宝塔面板部署指南.md) | [bt-panel-deployment.md](docs/en/bt-panel-deployment.md) |

## 开发检查

```bash
npm test
```

`npm test` 会运行 JavaScript 语法检查、存储与迁移测试、HTTP 冒烟测试和销售回复基线评测，不需要 AI API Key 或 PostgreSQL。设置 `POSTGRES_TEST_DATABASE_URL` 后还会运行可选的真实数据库集成测试。

## Demo 数据

`data/db.json` 包含英文课程销售场景的示例数据。它的作用是演示销售资料如何变成知识库，不是生产数据。

本地实验后，如果需要恢复仓库中的 demo 数据：

```bash
npm run reset-demo
```

按语言恢复 demo 数据：

```bash
npm run reset-demo:en
npm run reset-demo:zh
```

默认界面语言是英文。点击中文语言按钮会把界面切换成中文；在本地 demo 模式下，也会同步把 demo 数据切换到中文 fixture。生产环境默认禁止公开切换 demo 数据，除非显式配置 `DEMO_LANGUAGE_SWITCH=true`。

## 开源边界

当前项目目标是提供一个清晰、可自部署、适合团队改造的销售助手基础版本。

当前线索工作台是面向早期验证的通用版本。建议先选定一类小型 B2B 销售团队验证“减少漏跟进、缩短准备下一步的时间”是否有稳定价值，再扩展行业模板和连接器。

后续仍可扩展：

- 多团队隔离和更细的权限。
- CRM、表单、客服工具、表格连接器。
- AI 建议版本管理和审核流程。
- prompt evaluation 和自动化测试。

但当前开源基线仍然聚焦在：让团队可以拥有自己的销售助手，而不是依赖一个托管的商业 SaaS 平台。

JSON 文件存储继续作为默认轻量模式；PostgreSQL 适用于单团队、低到中等写入量的多人试点。当前 PostgreSQL adapter 把完整状态存为一条 JSONB 记录，所有写请求串行处理；更大规模使用前需要把线索、成员和活动迁移到关系表。MySQL 尚未实现。

## Prompt 评测

运行不需要 API Key 的中英文销售回复基线评测：

```bash
npm run eval
```

如需评测 `.env` 中配置的真实 AI 服务商和模型：

```bash
npm run eval:ai
```

数据规则、安全检查和贡献方式见[销售回复 Prompt 评测](docs/销售回复Prompt评测.md)。

## Roadmap

- 将 PostgreSQL JSONB 状态逐步迁移到关系表，支持更大数据量和更高并发。
- 扩展到多团队隔离和更细的角色权限。
- 增加可编辑 AI 建议和知识版本历史。
- 改进操作日志和更安全的数据备份/恢复流程。
- 改进 Docker 部署和生产自部署示例。
- 增加客户分层和销售漏斗看板。
- 增加 CRM、表单、聊天工具、表格等连接器示例。
- 扩展 prompt evaluation，增加模型对比和经过审核的评测追踪。

## Codex for Open Source 目标

这个项目正在作为开源销售助手 starter kit 准备。Codex 将主要用于维护者工作流，例如 issue triage、PR review、测试生成、release notes、文档更新、prompt/evaluation 改进等。

## License

MIT
