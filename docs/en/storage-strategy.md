# Storage Strategy

Updated: 2026-10-23

## 1. Decision

Open Sales Assistant keeps JSON file storage as its default lightweight mode and supports PostgreSQL as an optional storage mode.

Default mode:

```env
STORAGE_DRIVER=json
```

Current optional mode:

```env
STORAGE_DRIVER=postgres
```

MySQL is not implemented.

## 2. Why Keep JSON Storage

JSON storage is useful for the open-source baseline because:

- New users can clone the repository and run it without installing a database.
- Demo data is easy to inspect, reset, and review in Git.
- Small teams can evaluate the workflow before choosing a production database.
- Contributors can run tests and reproduce issues with minimal setup.
- It keeps the project approachable for non-infrastructure users.

JSON writes are serialized within one Node.js process. Use it for local demos and single-instance trials; do not share one JSON file across multiple Node.js processes or containers.

## 3. Current Storage Implementation

The storage interface is in `server/storage/`. Application code uses shared read, write, and transaction methods.

PostgreSQL stores the full application state as one JSONB document in `open_sales_assistant_state`. Every write request locks that row in a transaction before saving, which prevents concurrent instances from overwriting each other. This preserves the existing JSON data model for early small-team pilots.

All writes share one database row lock. Long-running AI generation and chat writes hold that lock too. As data volume, queries, or concurrent writes grow, move leads, members, activities, and operation logs into relational tables and migrate the queries.

## 4. Adapter Structure

Implemented modules:

```text
server/storage/
  index.js
  json-store.js
  postgres-store.js
```

Application routes call the shared storage interface. JSON file operations stay in the JSON adapter.

Current interface:

- `readDb()`
- `writeDb(db, options)`
- `createBackup(reason)`
- `transaction(callback)`
- `healthCheck()`
- `close()`

## 5. JSON and PostgreSQL Migration

Set the PostgreSQL connection in `.env`:

```env
STORAGE_DRIVER=postgres
DATABASE_URL=postgresql://sales_app:replace_with_a_secure_password@localhost:5432/open_sales_assistant
```

Import existing JSON data into an empty PostgreSQL database:

```bash
npm run migrate:postgres -- --file data/db.json
```

The command also accepts a JSON export from the admin interface. It refuses to replace a non-empty target unless `--replace` is passed. Import clears existing admin sessions, so users must sign in again. The command creates a backup before replacing a non-empty target.

Manual and daily PostgreSQL backups are JSON files in `DATA_BACKUP_DIR`. To restore, stop the app and run `npm run migrate:postgres -- --file <backup-path> --replace`, then start it again.

## 6. Compatibility Rules

Any database work must follow these rules:

- Do not remove JSON storage.
- Do not require a database for `npm test`.
- Do not require a database for the default quick start.
- PostgreSQL writes are serialized by a database row lock; the JSON lock only covers one Node.js process.
- Do not commit local production data.
- Keep demo data resettable through Git or an equivalent fixture.
- Keep docs clear about when JSON is enough and when a database is recommended.

## 7. When to Use Each Mode

Use JSON when:

- You are evaluating the project locally.
- You are testing demo data.
- You are developing features.
- You have a small internal proof of concept.

Use PostgreSQL when:

- Multiple team members are writing data at the same time.
- You need stronger backup, restore, audit, and migration workflows.
- You are preparing a production deployment.
- You need reporting, analytics, or external integrations at larger scale.

The current PostgreSQL adapter fits small-team pilots with low to moderate write volume. Large datasets, high concurrency, and complex reporting require a later move to relational tables.

## 8. Team Roles

- `super_admin`: manages accounts, exports, backups, and all leads.
- `manager`: views and assigns team leads and maintains other business modules.
- `sales_rep`: sees and follows up assigned leads; cannot delete leads or access other admin modules.

The current build uses one `team_default` team and does not implement multi-tenant isolation.
