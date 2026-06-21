import cron from "node-cron";
import { parseExpression } from "cron-parser";
import type { ScheduleStore } from "../stores/scheduleStore";

export type JobRunner = (
  grantId: string,
  destEmail: string,
  lastSummaryAt: number | null
) => Promise<void>;

export function getNextFireAt(cronExpr: string, from: Date = new Date()): number {
  const interval = parseExpression(cronExpr, { currentDate: from });
  return interval.next().toDate().getTime();
}

export function startScheduler(store: ScheduleStore, runJob: JobRunner): void {
  cron.schedule("* * * * *", async () => {
    const schedule = store.claimDue();
    if (!schedule) return;

    try {
      await runJob(schedule.grantId, schedule.destEmail, schedule.lastSummaryAt);
      const nextFireAt = getNextFireAt(schedule.cronExpr);
      store.complete(schedule.grantId, Date.now(), nextFireAt);
    } catch (err) {
      console.error(
        `Scheduler job failed for grant ${schedule.grantId}:`,
        err instanceof Error ? err.message : String(err)
      );
      store.releaseClaim(schedule.grantId);
    }
  });
}
