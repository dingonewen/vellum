import type { Db } from "../db";

export interface Schedule {
  id: number;
  grantId: string;
  destEmail: string;
  cronExpr: string;
  lastSummaryAt: number | null;
  nextFireAt: number;
}

export interface ScheduleStore {
  upsert(grantId: string, destEmail: string, cronExpr: string, nextFireAt: number): void;
  claimDue(): Schedule | null;
  complete(grantId: string, lastSummaryAt: number, nextFireAt: number): void;
  releaseClaim(grantId: string): void;
  findByGrant(grantId: string): Schedule | null;
}

export function createScheduleStore(db: Db): ScheduleStore {
  const claimDue = db.transaction((): Schedule | null => {
    const row = db
      .prepare(
        `SELECT id, grant_id AS grantId, dest_email AS destEmail,
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

    // Another process claimed this row between our SELECT and UPDATE
    return result.changes > 0 ? row : null;
  });

  return {
    upsert(grantId: string, destEmail: string, cronExpr: string, nextFireAt: number): void {
      db.prepare(
        `INSERT INTO schedules
           (grant_id, dest_email, cron_expr, next_fire_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (grant_id) DO UPDATE SET
           dest_email   = excluded.dest_email,
           cron_expr    = excluded.cron_expr,
           next_fire_at = excluded.next_fire_at,
           claimed_at   = NULL,
           updated_at   = excluded.updated_at`
      ).run(grantId, destEmail, cronExpr, nextFireAt, Date.now(), Date.now());
    },

    claimDue(): Schedule | null {
      return claimDue();
    },

    complete(grantId: string, lastSummaryAt: number, nextFireAt: number): void {
      db.prepare(
        `UPDATE schedules
         SET claimed_at = NULL, last_summary_at = ?, next_fire_at = ?, updated_at = ?
         WHERE grant_id = ?`
      ).run(lastSummaryAt, nextFireAt, Date.now(), grantId);
    },

    releaseClaim(grantId: string): void {
      db.prepare(
        `UPDATE schedules SET claimed_at = NULL, updated_at = ? WHERE grant_id = ?`
      ).run(Date.now(), grantId);
    },

    findByGrant(grantId: string): Schedule | null {
      return (
        (db
          .prepare(
            `SELECT id, grant_id AS grantId, dest_email AS destEmail,
                    cron_expr AS cronExpr, last_summary_at AS lastSummaryAt,
                    next_fire_at AS nextFireAt
             FROM schedules WHERE grant_id = ?`
          )
          .get(grantId) as Schedule | undefined) ?? null
      );
    },
  };
}
