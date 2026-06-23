import type { Db } from "../db";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface Session {
  id: string;
  userId: string;
  expiresAt: number;
}

export interface SessionStore {
  create(id: string, userId: string): void;
  find(id: string): Session | null;
  delete(id: string): void;
}

export function createSessionStore(db: Db): SessionStore {
  return {
    create(id: string, userId: string): void {
      db.prepare(
        `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
      ).run(id, userId, Date.now() + SESSION_TTL_MS, Date.now());
    },

    find(id: string): Session | null {
      const row = db
        .prepare(
          `SELECT id, user_id AS userId, expires_at AS expiresAt
           FROM sessions WHERE id = ? AND expires_at > ?`
        )
        .get(id, Date.now()) as Session | undefined;
      return row ?? null;
    },

    delete(id: string): void {
      db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
    },
  };
}
