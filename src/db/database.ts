import BetterSqlite3 from "better-sqlite3";
import type { Database as BetterSQLite3Database } from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import {
  CREATE_USERS_TABLE,
  CREATE_SESSIONS_TABLE,
  CREATE_GRANTS_TABLE,
  MIGRATE_GRANTS_MAILBOX_TYPE,
  CREATE_MANAGER_SETTINGS_TABLE,
} from "./schema";

export type Db = BetterSQLite3Database;

export function initDb(dbPath: string): Db {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }

  const db = new BetterSqlite3(dbPath);

  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");

  db.exec(CREATE_USERS_TABLE);
  db.exec(CREATE_SESSIONS_TABLE);
  db.exec(CREATE_GRANTS_TABLE);

  // Migrations (safe to re-run — errors are caught for idempotent columns)
  try { db.exec(MIGRATE_GRANTS_MAILBOX_TYPE); } catch { /* column already exists */ }
  db.exec(CREATE_MANAGER_SETTINGS_TABLE);

  return db;
}
