import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

function backupStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function createPostgresStore({ connectionString, backupDir, migrateDb, pool: suppliedPool }) {
  const pool = suppliedPool || new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 10),
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 5000)
  });
  pool.on?.('error', (error) => console.error('PostgreSQL pool error:', error));

  async function readPersistedDb(queryable = pool) {
    const result = await queryable.query('SELECT data FROM open_sales_assistant_state WHERE id = 1');
    if (!result.rows[0]) throw new Error('PostgreSQL app_state row is missing.');
    return result.rows[0].data;
  }

  async function writeBackup(name, db) {
    await fs.mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, name);
    await fs.writeFile(backupPath, JSON.stringify(db, null, 2), 'utf8');
    return backupPath;
  }

  async function createBackup(reason = 'manual', context = null) {
    const db = context?.rawDb || await readPersistedDb();
    return writeBackup(`${backupStamp()}-${reason}.json`, db);
  }

  async function ensureDailyBackup(context) {
    await fs.mkdir(backupDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const markerPath = path.join(backupDir, `${date}-daily.json`);
    try {
      await fs.access(markerPath);
      return markerPath;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    const db = context?.rawDb || await readPersistedDb();
    return writeBackup(`${date}-daily.json`, db);
  }

  return {
    driver: 'postgres',
    async initialize(emptyDb) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS open_sales_assistant_state (
          id smallint PRIMARY KEY CHECK (id = 1),
          revision bigint NOT NULL DEFAULT 0,
          data jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await pool.query(
        'INSERT INTO open_sales_assistant_state (id, revision, data) VALUES (1, 0, $1::jsonb) ON CONFLICT (id) DO NOTHING',
        [JSON.stringify(emptyDb)]
      );
      await pool.query('SELECT 1');
    },
    async read() {
      const raw = await readPersistedDb();
      return { ...migrateDb(raw), exists: true };
    },
    async beginTransaction() {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query('SELECT data FROM open_sales_assistant_state WHERE id = 1 FOR UPDATE');
        if (!result.rows[0]) throw new Error('PostgreSQL app_state row is missing.');
        const rawDb = result.rows[0].data;
        return { ...migrateDb(rawDb), rawDb, exists: true, client, closed: false };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
        throw error;
      }
    },
    async commit(context, db, options = {}) {
      if (context.closed) throw new Error('Cannot commit a closed PostgreSQL storage transaction.');
      try {
        if (context.dirty) {
          if (context.migrationBackup) await createBackup('before-migration', context);
          else if (!options.skipBackup) await ensureDailyBackup(context);
          await context.client.query(
            'UPDATE open_sales_assistant_state SET data = $1::jsonb, revision = revision + 1, updated_at = now() WHERE id = 1',
            [JSON.stringify(db)]
          );
        }
        await context.client.query('COMMIT');
      } catch (error) {
        await context.client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        if (!context.closed) {
          context.closed = true;
          context.client.release();
        }
      }
    },
    async rollback(context) {
      if (context.closed) return;
      context.closed = true;
      try {
        await context.client.query('ROLLBACK');
      } finally {
        context.client.release();
      }
    },
    createBackup,
    ensureDailyBackup,
    async healthCheck() {
      await pool.query('SELECT 1');
    },
    async close() {
      if (!suppliedPool) await pool.end();
    }
  };
}
