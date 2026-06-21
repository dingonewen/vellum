import { Router } from "express";
import { z } from "zod";
import { parseExpression } from "cron-parser";
import { db } from "../db";
import { createGrantStore } from "../stores/grantStore";
import { createScheduleStore } from "../stores/scheduleStore";
import { getNextFireAt } from "../scheduler/scheduler";

export const configRouter = Router();

const grantStore = createGrantStore(db);
const scheduleStore = createScheduleStore(db);

const configSchema = z.object({
  email: z.string().email(),
  destEmail: z.string().email(),
  cronExpr: z.string().min(1),
});

configRouter.post("/", (req, res) => {
  const result = configSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ errors: result.error.flatten().fieldErrors });
    return;
  }

  const { email, destEmail, cronExpr } = result.data;

  try {
    parseExpression(cronExpr);
  } catch {
    res.status(400).json({ error: "Invalid cron expression" });
    return;
  }

  const grant = grantStore.findByEmail(email);
  if (!grant) {
    res.status(404).json({
      error: "No connected mailbox found for that email. Visit /auth/connect first.",
    });
    return;
  }

  const nextFireAt = getNextFireAt(cronExpr);
  scheduleStore.upsert(grant.grantId, destEmail, cronExpr, nextFireAt);

  res.json({
    message: "Schedule configured",
    destEmail,
    cronExpr,
    nextFireAt: new Date(nextFireAt).toISOString(),
  });
});
