import { AsyncLocalStorage } from 'node:async_hooks';
import { createJsonStore } from './json-store.js';
import { createPostgresStore } from './postgres-store.js';

export async function createStorage({ driver, dataFile, backupDir, databaseUrl, migrateDb, postgresPool }) {
  let adapter;
  if (driver === 'json') {
    adapter = createJsonStore({ filePath: dataFile, backupDir, migrateDb });
  } else if (driver === 'postgres') {
    if (!databaseUrl) throw new Error('DATABASE_URL is required when STORAGE_DRIVER=postgres.');
    adapter = createPostgresStore({ connectionString: databaseUrl, backupDir, migrateDb, pool: postgresPool });
  } else {
    throw new Error(`Unsupported STORAGE_DRIVER "${driver}". Use "json" or "postgres".`);
  }

  const contextStorage = new AsyncLocalStorage();

  function activeContext() {
    const context = contextStorage.getStore();
    return context?.adapter === adapter ? context : null;
  }

  async function beginTransaction() {
    const context = await adapter.beginTransaction();
    context.adapter = adapter;
    context.rawDb = structuredClone(context.rawDb ?? context.db);
    context.dirty = Boolean(context.migrated && context.exists);
    context.migrationBackup = context.dirty;
    return context;
  }

  async function runTransaction(callback) {
    const current = activeContext();
    if (current) return callback(current);

    const context = await beginTransaction();
    try {
      return await contextStorage.run(context, async () => {
        const result = await callback(context);
        await adapter.commit(context, context.db, { skipBackup: context.skipBackup });
        return result;
      });
    } catch (error) {
      await adapter.rollback(context);
      throw error;
    }
  }

  function createTransactionMiddleware({ afterUpload = false } = {}) {
    return function transactionMiddleware(req, res, next) {
      const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ||
        (req.method === 'GET' && req.path === '/api/admin/data/export');
      const uploads = ['/api/admin/leads/import', '/api/materials/upload', '/api/admin/certificates/import'];
      const readOnlyPost = /^\/api\/admin\/leads\/[^/]+\/copilot$/.test(req.path);
      if (!isWrite || (uploads.includes(req.path) && !afterUpload) || readOnlyPost) return next();

      beginTransaction().then((context) => {
        let finalizing = false;
        const originalJson = res.json.bind(res);
        res.json = function transactionalJson(body) {
          if (finalizing) return res;
          finalizing = true;
          const statusCode = res.statusCode;
          const finalize = statusCode >= 400
            ? adapter.rollback(context)
            : adapter.commit(context, context.db, { skipBackup: context.skipBackup });
          finalize.then(
            () => originalJson(body),
            (error) => {
              console.error('Storage transaction failed:', error);
              if (!res.headersSent) {
                res.statusCode = 500;
                originalJson({ error: '数据保存失败，请稍后重试' });
              } else {
                res.destroy(error);
              }
            }
          );
          return res;
        };

        res.once('close', () => {
          if (!finalizing) void adapter.rollback(context).catch((error) => console.error('Storage rollback failed:', error));
        });

        contextStorage.run(context, () => next());
      }).catch(next);
    };
  }

  const storage = {
    driver,
    async initialize() {
      await adapter.initialize(migrateDb({}).db);
    },
    async readDb() {
      const context = activeContext();
      if (context) return context.db;

      const result = await adapter.read();
      if (result.migrated && result.exists) {
        return runTransaction(async (transaction) => {
          transaction.dirty = true;
          transaction.migrationBackup = true;
          return transaction.db;
        });
      }
      return result.db;
    },
    async writeDb(db, options = {}) {
      const context = activeContext();
      if (context) {
        context.db = migrateDb(db).db;
        context.dirty = true;
        context.skipBackup = Boolean(options.skipBackup);
        return;
      }
      await runTransaction(async (transaction) => {
        transaction.db = migrateDb(db).db;
        transaction.dirty = true;
        transaction.skipBackup = Boolean(options.skipBackup);
      });
    },
    async transaction(callback) {
      return runTransaction(callback);
    },
    async createBackup(reason = 'manual') {
      return adapter.createBackup(reason, activeContext());
    },
    async healthCheck() {
      return adapter.healthCheck();
    },
    async close() {
      return adapter.close();
    },
    transactionMiddleware: createTransactionMiddleware(),
    uploadTransactionMiddleware: createTransactionMiddleware({ afterUpload: true })
  };

  await storage.initialize();
  return storage;
}
