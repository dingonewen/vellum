import BetterSqlite3 from 'better-sqlite3';
import * as path from 'path';

/** Resolve the database path from env, with a default fallback. */
export function resolveDbPath(): string {
  return path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/vellum.db');
}

/** Look up a grant by mailbox_type. */
export function resolveGrant(type: string): { grant_id: string; email: string } | undefined {
  const dbPath = resolveDbPath();
  const db = new BetterSqlite3(dbPath, { readonly: true });
  const row = db.prepare('SELECT grant_id, email FROM grants WHERE mailbox_type = ? LIMIT 1').get(type) as { grant_id: string; email: string } | undefined;
  db.close();
  return row;
}
