# Data Migration and Backup

Updated: 2026-10-23

## 1. Current Data Approach

The default mode uses a local JSON database:

```text
data/db.json
```

JSON mode fits demos and single-instance small-team trials. Its mutex only covers the current Node.js process.

For a multi-user pilot, use PostgreSQL. The current adapter stores app state as one JSONB document in `open_sales_assistant_state`; a transaction row lock serializes application writes. All writes share this lock, so frequent writes and slow AI requests can queue. Larger deployments need a migration to relational tables.

## 2. Data Version

Current schema version:

```text
schemaVersion = 4
```

The service checks and fills missing fields during startup and reads. When migration happens, it creates a backup first. Version 4 adds admin roles, team IDs, and lead owner IDs.

## 3. Automatic Backup

Default backup directory:

```text
data/backups/
```

Before writes, the system checks whether a daily backup already exists:

```text
data/backups/YYYY-MM-DD-daily.json
```

If an automatic migration happens, it creates a pre-migration backup:

```text
data/backups/timestamp-before-migration.json
```

## 4. Custom Backup Directory

Configure an external backup path in `.env`:

```env
DATA_BACKUP_DIR=/opt/open-sales-assistant-backups
```

For production-like self-hosting, keep backups outside the project directory to avoid accidental deletion during updates.

Both JSON and PostgreSQL modes write logical backups as JSON files. For production, copy `DATA_BACKUP_DIR` to an independent backup location regularly.

## 5. Export and Manual Backup

Admin data export:

```text
GET /api/admin/data/export
```

Manual backup:

```text
POST /api/admin/data/backup
```

Both require admin authentication.

## 6. Open-Source Repository Rules

Do not commit:

- `.env`
- `uploads/`
- `data/backups/`
- real customer data
- API keys, tokens, or passwords

Safe to commit:

- sanitized demo data in `data/db.json`
- `.env.example`
- data structure and migration docs

## 7. Restore Data

1. Stop the Node service.
2. Find the backup file to restore.
3. Copy it to `data/db.json`.
4. Start the Node service.
5. The service will check schema version and fill missing fields.

Save the current `data/db.json` before restoring another version.

## 8. Importing into PostgreSQL and Restoring PostgreSQL

1. Create an empty PostgreSQL database and set `STORAGE_DRIVER=postgres` and `DATABASE_URL` in `.env`.
2. Stop the app, keep the original `data/db.json`, and run:

   ```bash
   npm run migrate:postgres -- --file data/db.json
   ```

3. Start the app and verify accounts, leads, and activities.

The command refuses to import into a non-empty target. Use `--replace` only when the target can be fully replaced; the script backs up a non-empty target first. Import clears existing admin sessions, so users must sign in again.

To restore a PostgreSQL JSON backup, stop the app and run:

```bash
npm run migrate:postgres -- --file data/backups/<backup-file>.json --replace
```

This writes the backup state back to PostgreSQL. Confirm `DATABASE_URL` points to the intended database before running the command.
