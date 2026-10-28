import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStorage } from '../server/storage/index.js';
import { migrateDb } from '../server/db-schema.js';

dotenv.config();

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');

function parseArgs(args) {
  const options = { file: path.join(rootDir, 'data', 'db.json'), replace: false };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--file') {
      const file = args[index + 1];
      if (!file) throw new Error('--file 后需要提供 JSON 文件路径。');
      options.file = path.resolve(file);
      index += 1;
    } else if (args[index] === '--replace') {
      options.replace = true;
    } else if (args[index] === '--help') {
      options.help = true;
    } else {
      throw new Error(`未知参数：${args[index]}`);
    }
  }
  return options;
}

function hasUserData(db) {
  return ['leads', 'leadActivities', 'students', 'studentSessions', 'chats', 'materials', 'courses', 'courseSchedules', 'certificates', 'followUps', 'aiAnalysis', 'knowledgeSuggestions', 'operationLogs', 'adminUsers', 'adminSessions']
    .some((key) => Array.isArray(db[key]) && db[key].length > 0) ||
    Boolean(db.knowledge) || db.adminUsers.length > 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: npm run migrate:postgres -- [--file path/to/db.json] [--replace]');
    return;
  }
  if ((process.env.STORAGE_DRIVER || '').toLowerCase() !== 'postgres' || !process.env.DATABASE_URL) {
    throw new Error('请在环境变量中设置 STORAGE_DRIVER=postgres 和 DATABASE_URL。');
  }

  const raw = JSON.parse(await fs.readFile(options.file, 'utf8'));
  const source = raw?.service === 'open-sales-assistant' && raw.data ? raw.data : raw;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('源文件必须是 Open Sales Assistant 的 JSON 数据或导出文件。');
  }
  const { db } = migrateDb(source);
  db.adminSessions = [];
  db.operationLogs.unshift({
    id: `oplog_migration_${Date.now()}`,
    actorId: '', actorName: 'System', action: 'data.migrate',
    targetType: 'data', targetId: 'postgres', targetLabel: path.basename(options.file),
    summary: 'Imported JSON data into PostgreSQL; administrator sessions were cleared.',
    createdAt: new Date().toISOString()
  });
  db.operationLogs = db.operationLogs.slice(0, 200);

  const backupDir = process.env.DATA_BACKUP_DIR
    ? path.resolve(process.env.DATA_BACKUP_DIR)
    : path.join(rootDir, 'data', 'backups');
  const storage = await createStorage({
    driver: 'postgres',
    dataFile: path.join(rootDir, 'data', 'db.json'),
    backupDir,
    databaseUrl: process.env.DATABASE_URL,
    migrateDb
  });
  try {
    await storage.transaction(async () => {
      const current = await storage.readDb();
      if (hasUserData(current) && !options.replace) {
        throw new Error('目标数据库已有数据。追加 --replace 才会用 JSON 文件替换目标数据。');
      }
      if (hasUserData(current)) await storage.createBackup('before-json-import');
      await storage.writeDb(db, { skipBackup: true });
    });
  } finally {
    await storage.close();
  }

  console.log(`Imported ${db.leads.length} leads, ${db.leadActivities.length} activities and ${db.adminUsers.length} admin users from ${options.file}.`);
  console.log('Administrator sessions were cleared. Sign in again after switching the application to PostgreSQL.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
