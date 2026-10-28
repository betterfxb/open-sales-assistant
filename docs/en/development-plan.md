# Development Plan

Updated: 2026-10-23

## 1. Current Positioning

Open Sales Assistant is a self-hosted open-source starter kit for team sales assistants. The current version is suitable for individual salespeople, small teams, or pilot teams that need a sales knowledge base, customer consultation entry point, and basic follow-up workflow.

It is not a commercial SaaS platform and does not include hosted billing, multi-organization onboarding, or a platform operator console.

## 2. Project Modules

```text
open-sales-assistant/
  public/             # Customer chat and admin pages
  server/             # Express backend APIs
  data/               # Local JSON demo data
  uploads/            # Uploaded files, ignored by Git by default
  docs/               # Project documentation
  package.json
  .env.example
```

## 3. Completed Features

### Customer Chat

- Nickname registration, random password, and persistent login.
- Customer profile maintenance.
- Chat history persistence.
- AI responses based on the knowledge base.
- Optional image material attachments in responses.
- Certificate lookup demo flow.

### Admin Console

- Admin login and API authentication.
- Customer list, search, sorting, pagination, and deletion.
- Customer detail page, chat history, AI profile analysis, and follow-up records.
- Lead workspace with CSV/XLSX import, ownership, stages, due queues, activity timeline, and AI follow-up drafts.
- Super-admin, manager, and sales-rep roles with team and lead ownership access rules.
- Basic admin operation logs for key write actions.
- Text, image, and document material upload.
- AI material analysis and pending suggestions.
- Knowledge summary, sales playbook, FAQ, and objection handling.
- Certificate creation, deletion, batch import, and lookup.
- Consultation settings.

### Data and Deployment

- JSON storage by default and an optional PostgreSQL adapter with JSON import tooling.
- `schemaVersion` migration through version 4, including users, roles, teams, and lead ownership.
- Daily and manual logical backups for JSON and PostgreSQL, with documented restore steps.
- Serialized write transactions: PostgreSQL row lock across instances, JSON mutex within one process.
- Data export endpoint.
- PM2, Nginx, and BT Panel deployment references.

## 4. Next Priorities

### P0: Runnable Open-Source Baseline (Complete)

- Keep README, license, contribution guide, and security policy complete.
- Keep demo data safe, understandable, and replaceable.
- Add basic API tests and startup verification.
- Add a demo data reset script.

### P1: User Validation and Scale

- Run a controlled trial with one or two small teams and validate the lead workflow, permissions, and backup process.
- Migrate PostgreSQL state from one JSONB row to relational tables as scale requires.
- Add real PostgreSQL integration checks to CI.
- Improve operation log filters, detail views, and export.

### P2: Knowledge Quality

- Allow editing AI suggestions before acceptance.
- Add knowledge base version history and rollback.
- Add material search, editing, and batch management.
- Add AI usage logs and cost estimates.
- Add prompt evaluation examples.

### P3: Self-Hosting Improvements

- Improve Docker deployment.
- Continue PostgreSQL schema normalization while preserving JSON file storage.
- Add restore tooling.
- Add production deployment checklist.
- Add CRM, forms, spreadsheet, and team messaging connector examples.

## 5. Open-Source Application Focus

- Track roadmap and defects through GitHub issues.
- Close concrete work through commits and pull requests.
- Publish regular releases and changelogs.
- Use Codex to help with PR review, tests, docs, and release notes.
