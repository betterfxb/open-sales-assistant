import fs from 'node:fs/promises';
import path from 'node:path';
import { createMutex } from './mutex.js';

function backupStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function isMissingFile(error) {
  return error?.code === 'ENOENT';
}

export function createJsonStore({ filePath, backupDir, migrateDb }) {
  const writeMutex = createMutex();

  async function readFile() {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const result = migrateDb(JSON.parse(raw));
      return { ...result, exists: true };
    } catch (error) {
      if (!isMissingFile(error)) throw error;
      return { ...migrateDb({}), exists: false };
    }
  }

  async function writeFile(db) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    try {
      await fs.writeFile(tempPath, JSON.stringify(db, null, 2), 'utf8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
  }

  async function writeBackupFile(name, content) {
    await fs.mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, name);
    await fs.writeFile(backupPath, content, 'utf8');
    return backupPath;
  }

  async function createBackup(reason = 'manual') {
    let raw;
    try {
      raw = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
    return writeBackupFile(`${backupStamp()}-${reason}.json`, raw);
  }

  async function ensureDailyBackup() {
    let raw;
    try {
      raw = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
    const date = new Date().toISOString().slice(0, 10);
    const markerPath = path.join(backupDir, `${date}-daily.json`);
    try {
      await fs.access(markerPath);
      return markerPath;
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    return writeBackupFile(`${date}-daily.json`, raw);
  }

  return {
    driver: 'json',
    async initialize() {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.mkdir(backupDir, { recursive: true });
    },
    async read() {
      return readFile();
    },
    async beginTransaction() {
      const release = await writeMutex.acquire();
      try {
        return { ...(await readFile()), release, closed: false };
      } catch (error) {
        release();
        throw error;
      }
    },
    async commit(context, db, options = {}) {
      if (context.closed) throw new Error('Cannot commit a closed JSON storage transaction.');
      try {
        if (context.dirty) {
          if (context.migrationBackup) await createBackup('before-migration');
          else if (!options.skipBackup) await ensureDailyBackup();
          await writeFile(db);
        }
      } finally {
        if (!context.closed) {
          context.closed = true;
          context.release();
        }
      }
    },
    async rollback(context) {
      if (context.closed) return;
      context.closed = true;
      context.release();
    },
    createBackup,
    ensureDailyBackup,
    async healthCheck() {},
    async close() {}
  };
}
