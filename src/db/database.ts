import BetterSqlite3 from "better-sqlite3";
import type { Database as BetterSQLite3Database } from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import {
  CREATE_USERS_TABLE,
  CREATE_SESSIONS_TABLE,
  CREATE_GRANTS_TABLE,
  CREATE_MESSAGES_IDX,
  CREATE_MESSAGES_TABLE,
  CREATE_PENDING_IDX,
  CREATE_PENDING_MESSAGES_TABLE,
  CREATE_SCHEDULES_IDX,
  CREATE_SCHEDULES_TABLE,
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
  db.exec(CREATE_MESSAGES_TABLE);
  db.exec(CREATE_MESSAGES_IDX);
  db.exec(CREATE_PENDING_MESSAGES_TABLE);
  db.exec(CREATE_PENDING_IDX);
  db.exec(CREATE_SCHEDULES_TABLE);
  db.exec(CREATE_SCHEDULES_IDX);

  return db;
}
