import type { Db } from "../db";

export interface Schedule {
  id: number;
  userId: string;
  destEmail: string;
  cronExpr: string;
  lastSummaryAt: number | null;
  nextFireAt: number;
}

export interface ScheduleStore {
  upsert(userId: string, destEmail: string, cronExpr: string, nextFireAt: number): void;
  claimDue(): Schedule | null;
  complete(userId: string, lastSummaryAt: number, nextFireAt: number): void;
  releaseClaim(userId: string): void;
  findByUser(userId: string): Schedule | null;
}

export function createScheduleStore(db: Db): ScheduleStore {
  const claimDue = db.transaction((): Schedule | null => {
    const row = db
      .prepare(
        `SELECT id, user_id AS userId, dest_email AS destEmail,
                cron_expr AS cronExpr, last_summary_at AS lastSummaryAt,
                next_fire_at AS nextFireAt
         FROM schedules
         WHERE claimed_at IS NULL AND next_fire_at <= ?
         LIMIT 1`
      )
      .get(Date.now()) as Schedule | undefined;

    if (!row) return null;

    const result = db
      .prepare(
        `UPDATE schedules SET claimed_at = ? WHERE id = ? AND claimed_at IS NULL`
      )
      .run(Date.now(), row.id);

    return result.changes > 0 ? row : null;
  });

  return {
    upsert(userId: string, destEmail: string, cronExpr: string, nextFireAt: number): void {
      db.prepare(
        `INSERT INTO schedules
           (user_id, dest_email, cron_expr, next_fire_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET
           dest_email   = excluded.dest_email,
           cron_expr    = excluded.cron_expr,
           next_fire_at = excluded.next_fire_at,
           claimed_at   = NULL,
           updated_at   = excluded.updated_at`
      ).run(userId, destEmail, cronExpr, nextFireAt, Date.now(), Date.now());
    },

    claimDue(): Schedule | null {
      return claimDue();
    },

    complete(userId: string, lastSummaryAt: number, nextFireAt: number): void {
      db.prepare(
        `UPDATE schedules
         SET claimed_at = NULL, last_summary_at = ?, next_fire_at = ?, updated_at = ?
         WHERE user_id = ?`
      ).run(lastSummaryAt, nextFireAt, Date.now(), userId);
    },

    releaseClaim(userId: string): void {
      db.prepare(
        `UPDATE schedules SET claimed_at = NULL, updated_at = ? WHERE user_id = ?`
      ).run(Date.now(), userId);
    },

    findByUser(userId: string): Schedule | null {
      return (
        (db
          .prepare(
            `SELECT id, user_id AS userId, dest_email AS destEmail,
                    cron_expr AS cronExpr, last_summary_at AS lastSummaryAt,
                    next_fire_at AS nextFireAt
             FROM schedules WHERE user_id = ?`
          )
          .get(userId) as Schedule | undefined) ?? null
      );
    },
  };
}
