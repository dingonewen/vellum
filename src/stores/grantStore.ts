import type { Db } from "../db";

export interface Grant {
  grantId: string;
  userId: string;
  email: string;
  mailboxType: 'buyer_inbox' | 'manager_inbox' | 'other';
  createdAt: number;
}

export interface GrantStore {
  upsert(userId: string, grantId: string, email: string): void;
  findByUserId(userId: string): Grant[];
  findByEmail(email: string): Grant | null;
  setMailboxType(grantId: string, mailboxType: string): void;
  deleteByGrantId(grantId: string): void;
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
          `SELECT grant_id AS grantId, user_id AS userId, email,
                  mailbox_type AS mailboxType, created_at AS createdAt
           FROM grants WHERE user_id = ? ORDER BY created_at ASC`
        )
        .all(userId) as Grant[];
    },

    findByEmail(email: string): Grant | null {
      return (
        (db
          .prepare(
            `SELECT grant_id AS grantId, user_id AS userId, email,
                    mailbox_type AS mailboxType, created_at AS createdAt
             FROM grants WHERE email = ?`
          )
          .get(email) as Grant | undefined) ?? null
      );
    },

    setMailboxType(grantId: string, mailboxType: string): void {
      db.prepare(
        `UPDATE grants SET mailbox_type = ? WHERE grant_id = ?`
      ).run(mailboxType, grantId);
    },

    deleteByGrantId(grantId: string): void {
      db.prepare(`DELETE FROM grants WHERE grant_id = ?`).run(grantId);
    },
  };
}
