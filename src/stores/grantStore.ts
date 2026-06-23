import type { Db } from "../db";

export interface Grant {
  grantId: string;
  userId: string;
  email: string;
  createdAt: number;
}

export interface GrantStore {
  upsert(userId: string, grantId: string, email: string): void;
  findByUserId(userId: string): Grant[];
  findByEmail(email: string): Grant | null;
}

export function createGrantStore(db: Db): GrantStore {
  return {
    upsert(userId: string, grantId: string, email: string): void {
      db.prepare(
        `INSERT INTO grants (user_id, grant_id, email, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (grant_id) DO UPDATE SET email = excluded.email`
      ).run(userId, grantId, email, Date.now());
    },

    findByUserId(userId: string): Grant[] {
      return db
        .prepare(
          `SELECT grant_id AS grantId, user_id AS userId, email, created_at AS createdAt
           FROM grants WHERE user_id = ? ORDER BY created_at ASC`
        )
        .all(userId) as Grant[];
    },

    findByEmail(email: string): Grant | null {
      return (
        (db
          .prepare(
            `SELECT grant_id AS grantId, user_id AS userId, email, created_at AS createdAt
             FROM grants WHERE email = ?`
          )
          .get(email) as Grant | undefined) ?? null
      );
    },
  };
}
