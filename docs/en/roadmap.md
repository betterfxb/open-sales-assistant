# Full Roadmap for the Team Sales Assistant

Updated: 2026-10-23

## 1. Positioning

Open Sales Assistant is intended to be a self-hosted AI sales assistant for teams and individual sales workflows, not a commercial SaaS platform.

It addresses these problems:

- Sales materials are scattered, making it hard for new salespeople to learn products and scripts quickly.
- Customer questions repeat frequently, so teams need a unified and maintainable FAQ and objection-handling base.
- AI can help organize materials and generate reviewable suggestions, but it should not overwrite the formal knowledge base automatically.
- Small teams need a simple system for sales materials, customer conversations, follow-up records, and basic data operations.

The committed demo data uses a training-course sales scenario. Future examples can cover software, local services, consulting, B2B products, and other sales contexts.

## 2. Current Capabilities

- Node.js + Express monolith.
- Customer-facing chat page, login page, and admin console.
- Local JSON database in `data/db.json`.
- Material upload, AI analysis, and reviewable knowledge suggestions.
- Sales playbook, FAQ, objection handling, and knowledge summary editing.
- Customer profiles, chat history, AI-generated profile analysis, and follow-up records.
- Lead workspace with import, owner assignment, follow-up queues, activity timeline, and AI drafts.
- Team accounts and super-admin, manager, and sales-rep roles.
- Basic admin operation logs for key write actions.
- Certificate lookup as a demo business module.
- Data export, manual backup, and deployment documentation.
- JSON remains the default lightweight mode; an optional PostgreSQL adapter, migration CLI, and logical backup/restore are available.

## 3. Iteration Plan

### P0: Runnable Open-Source Baseline (Complete)

Goal: make the project easy to clone, run, and understand with the committed demo data.

- Keep README, license, contribution guide, security policy, and docs complete.
- Clearly mark demo data as non-production sample data.
- Keep `.env.example` suitable for local development.
- Keep JSON storage for fast evaluation.
- Maintain basic tests, smoke tests, and health checks.

### P1: User Validation and Scale

Goal: support lightweight collaboration around customers and leads.

- Validate the current workflow, role boundaries, backup, and restore with one or two small teams.
- Move PostgreSQL state from one JSONB row to relational tables as data volume and write concurrency grow.
- Add real PostgreSQL integration checks to CI.
- Improve follow-up search, filtering, and export.

### P2: Knowledge and AI Quality

Goal: make AI-assisted knowledge management controllable and auditable.

- Knowledge base version history and rollback.
- Editable AI suggestions before acceptance.
- Material editing, search, and batch operations.
- Better conflict detection.
- Prompt and response evaluation examples.
- AI usage logs and cost estimates.

### P3: Data and Deployment Hardening

Goal: make self-hosting safer and easier.

- Continue improving data migration.
- Add restore tooling.
- Improve operation log filters, detail views, and export.
- Continue PostgreSQL relational schema migration without removing JSON storage.
- Improve Docker deployment and containerized self-hosting examples.
- Add a production deployment checklist.

### P4: Ecosystem Connectors

Goal: connect the assistant with existing team tools.

- Form lead import.
- Excel/CSV customer and material import.
- CRM connector examples.
- WeCom, Feishu, Slack, or email notification examples.
- MCP connector examples for exposing sales materials and customer context to AI tools.

## 4. Open-Source Maintenance Goals

- Keep each iteration self-hostable.
- Keep JSON storage available for local demos and lightweight self-hosting.
- Never commit customer data, commercial deployment config, or private API keys.
- Validate new features with demo data and reproducible tests.
- Use issues and pull requests to maintain a visible roadmap.
- Use Codex for issue triage, PR review, test generation, documentation, and release notes.
