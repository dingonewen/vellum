import type { Db } from "../db";

export type DigestFrequency = 'on_sensitive' | 'every_6h' | 'daily_4pm';

export interface ManagerSettings {
  id: number;
  userId: string;
  digestFrequency: DigestFrequency;
  updatedAt: number;
}

export interface ManagerStore {
  upsert(userId: string, digestFrequency: string): void;
  findByUserId(userId: string): ManagerSettings | null;
}

export function createManagerStore(db: Db): ManagerStore {
  return {
    upsert(userId: string, digestFrequency: string): void {
      db.prepare(
        `INSERT INTO manager_settings (user_id, digest_frequency, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET
           digest_frequency = excluded.digest_frequency,
           updated_at = excluded.updated_at`
      ).run(userId, digestFrequency, Date.now());
    },

    findByUserId(userId: string): ManagerSettings | null {
      return (
        (db
          .prepare(
            `SELECT id, user_id AS userId,
                    digest_frequency AS digestFrequency,
                    updated_at AS updatedAt
             FROM manager_settings WHERE user_id = ?`
          )
          .get(userId) as ManagerSettings | undefined) ?? null
      );
    },
  };
}
