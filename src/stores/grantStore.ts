import type { Db } from "../db";

export interface Grant {
  grantId: string;
  email: string;
  createdAt: number;
}

export interface GrantStore {
  upsert(grantId: string, email: string): void;
  findAll(): Grant[];
  findByEmail(email: string): Grant | null;
}

export function createGrantStore(db: Db): GrantStore {
  return {
    upsert(grantId: string, email: string): void {
      db.prepare(`
        INSERT INTO grants (grant_id, email, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT (grant_id) DO UPDATE SET email = excluded.email
      `).run(grantId, email, Date.now());
    },

    findAll(): Grant[] {
      return db
        .prepare(
          `SELECT grant_id AS grantId, email, created_at AS createdAt
           FROM grants`
        )
        .all() as Grant[];
    },

    findByEmail(email: string): Grant | null {
      return (
        (db
          .prepare(
            `SELECT grant_id AS grantId, email, created_at AS createdAt
             FROM grants WHERE email = ?`
          )
          .get(email) as Grant | undefined) ?? null
      );
    },
  };
}
