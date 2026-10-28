import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { Pool } from 'pg';
import { currentSchemaVersion, migrateDb } from '../server/db-schema.js';
import { createStorage } from '../server/storage/index.js';
import { createJsonStore } from '../server/storage/json-store.js';
import { createPostgresStore } from '../server/storage/postgres-store.js';

test('JSON storage serializes concurrent updates and rolls back failed transactions', async () => {
  const tempDir = await fs.mkdtemp(path.join(process.cwd(), '.tmp-sales-storage-test-'));
  const storage = await createStorage({
    driver: 'json',
    dataFile: path.join(tempDir, 'db.json'),
    backupDir: path.join(tempDir, 'backups'),
    migrateDb
  });

  try {
    await storage.transaction(async () => {
      const db = await storage.readDb();
      db.storageTestCounter = 0;
      await storage.writeDb(db);
    });

    await Promise.all(Array.from({ length: 32 }, () => storage.transaction(async () => {
      const db = await storage.readDb();
      const current = db.storageTestCounter;
      await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 4)));
      db.storageTestCounter = current + 1;
      await storage.writeDb(db);
    })));

    assert.equal((await storage.readDb()).storageTestCounter, 32);

    await assert.rejects(storage.transaction(async () => {
      const db = await storage.readDb();
      db.storageTestCounter = 999;
      await storage.writeDb(db);
      throw new Error('expected rollback');
    }), /expected rollback/);
    assert.equal((await storage.readDb()).storageTestCounter, 32);
  } finally {
    await storage.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('JSON storage refuses to commit a transaction after it was rolled back', async () => {
  const tempDir = await fs.mkdtemp(path.join(process.cwd(), '.tmp-sales-json-rollback-test-'));
  const store = createJsonStore({
    filePath: path.join(tempDir, 'db.json'),
    backupDir: path.join(tempDir, 'backups'),
    migrateDb
  });

  try {
    await store.initialize();
    const context = await store.beginTransaction();
    context.dirty = true;
    context.db.storageTestCounter = 1;
    await store.rollback(context);
    await assert.rejects(store.commit(context, context.db), /closed JSON storage transaction/);
    assert.equal((await store.read()).exists, false);
  } finally {
    await store.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('schema migration adds team and lead ownership fields while preserving records', () => {
  const { db, migrated } = migrateDb({
    schemaVersion: 3,
    students: [{ id: 'student-1', nickname: 'Legacy' }],
    leads: [{ id: 'lead-1', name: 'Legacy lead', owner: 'Admin' }],
    adminUsers: [{ id: 'admin-1', username: 'ADMIN', realName: 'Admin', status: 'active' }]
  });

  assert.equal(migrated, true);
  assert.equal(db.schemaVersion, currentSchemaVersion);
  assert.equal(db.students[0].id, 'student-1');
  assert.equal(db.adminUsers[0].username, 'admin');
  assert.equal(db.adminUsers[0].role, 'super_admin');
  assert.equal(db.adminUsers[0].teamId, 'team_default');
  assert.equal(db.leads[0].teamId, 'team_default');
  assert.equal(db.leads[0].ownerId, '');
});

class FakePostgresPool {
  constructor() {
    this.data = null;
    this.revision = 0;
    this.lock = Promise.resolve();
  }

  on() {}

  async query(sql, values = []) {
    if (sql.includes('INSERT INTO open_sales_assistant_state')) {
      if (!this.data) this.data = JSON.parse(values[0]);
      return { rows: [] };
    }
    if (sql.includes('SELECT data FROM open_sales_assistant_state')) {
      return { rows: this.data ? [{ data: structuredClone(this.data) }] : [] };
    }
    return { rows: [] };
  }

  async connect() {
    const previous = this.lock;
    let releaseLock;
    this.lock = new Promise((resolve) => { releaseLock = resolve; });
    await previous;
    let localData = structuredClone(this.data);
    let closed = false;
    return {
      query: async (sql, values = []) => {
        if (sql === 'BEGIN') return { rows: [] };
        if (sql.includes('SELECT data FROM open_sales_assistant_state') && sql.includes('FOR UPDATE')) {
          return { rows: [{ data: structuredClone(localData) }] };
        }
        if (sql.startsWith('UPDATE open_sales_assistant_state')) {
          localData = JSON.parse(values[0]);
          return { rows: [] };
        }
        if (sql === 'COMMIT') {
          this.data = structuredClone(localData);
          this.revision += 1;
          if (!closed) { closed = true; releaseLock(); }
          return { rows: [] };
        }
        if (sql === 'ROLLBACK') {
          if (!closed) { closed = true; releaseLock(); }
          return { rows: [] };
        }
        return { rows: [] };
      },
      release: () => {
        if (!closed) { closed = true; releaseLock(); }
      }
    };
  }
}

test('PostgreSQL adapter commits changes atomically and rolls back errors', async () => {
  const tempDir = await fs.mkdtemp(path.join(process.cwd(), '.tmp-sales-postgres-test-'));
  const pool = new FakePostgresPool();
  const storage = await createStorage({
    driver: 'postgres',
    databaseUrl: 'postgres://fake',
    dataFile: path.join(tempDir, 'unused.json'),
    backupDir: path.join(tempDir, 'backups'),
    migrateDb,
    postgresPool: pool
  });

  try {
    await storage.transaction(async () => {
      const db = await storage.readDb();
      db.storageTestCounter = 3;
      await storage.writeDb(db);
    });
    assert.equal((await storage.readDb()).storageTestCounter, 3);

    await assert.rejects(storage.transaction(async () => {
      const db = await storage.readDb();
      db.storageTestCounter = 10;
      await storage.writeDb(db);
      throw new Error('expected rollback');
    }), /expected rollback/);
    assert.equal((await storage.readDb()).storageTestCounter, 3);
    assert.equal(pool.revision, 1);
  } finally {
    await storage.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('PostgreSQL storage refuses to commit a transaction after it was rolled back', async () => {
  const tempDir = await fs.mkdtemp(path.join(process.cwd(), '.tmp-sales-pg-rollback-test-'));
  const pool = new FakePostgresPool();
  const store = createPostgresStore({
    connectionString: 'postgres://fake',
    backupDir: path.join(tempDir, 'backups'),
    migrateDb,
    pool
  });

  try {
    await store.initialize(migrateDb({}).db);
    const context = await store.beginTransaction();
    context.dirty = true;
    context.db.storageTestCounter = 1;
    await store.rollback(context);
    await assert.rejects(store.commit(context, context.db), /closed PostgreSQL storage transaction/);
    assert.equal((await store.read()).db.storageTestCounter, undefined);
    assert.equal(pool.revision, 0);
  } finally {
    await store.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('PostgreSQL integration uses an isolated temporary schema', {
  skip: !process.env.POSTGRES_TEST_DATABASE_URL && 'Set POSTGRES_TEST_DATABASE_URL to run against a PostgreSQL test database.'
}, async () => {
  const tempDir = await fs.mkdtemp(path.join(process.cwd(), '.tmp-sales-pg-integration-'));
  const connectionString = process.env.POSTGRES_TEST_DATABASE_URL;
  const schema = `osa_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const adminPool = new Pool({ connectionString, max: 1 });
  let isolatedPool;
  let storage;
  try {
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    isolatedPool = new Pool({ connectionString, max: 1, options: `-c search_path=${schema}` });
    storage = await createStorage({
      driver: 'postgres',
      databaseUrl: connectionString,
      dataFile: path.join(tempDir, 'unused.json'),
      backupDir: path.join(tempDir, 'backups'),
      migrateDb,
      postgresPool: isolatedPool
    });
    await storage.transaction(async () => {
      const db = await storage.readDb();
      db.storageTestCounter = 7;
      await storage.writeDb(db);
    });
    assert.equal((await storage.readDb()).storageTestCounter, 7);
    await assert.rejects(storage.transaction(async () => {
      const db = await storage.readDb();
      db.storageTestCounter = 9;
      await storage.writeDb(db);
      throw new Error('expected rollback');
    }), /expected rollback/);
    assert.equal((await storage.readDb()).storageTestCounter, 7);
  } finally {
    await storage?.close();
    await isolatedPool?.end();
    await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await adminPool.end();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
