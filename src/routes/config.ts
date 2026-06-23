import { Router } from "express";
import { z } from "zod";
import { parseExpression } from "cron-parser";
import { db } from "../db";
import { createUserStore } from "../stores/userStore";
import { createGrantStore } from "../stores/grantStore";
import { createScheduleStore } from "../stores/scheduleStore";
import { createSessionStore } from "../stores/sessionStore";
import { requireAuth } from "../middleware/requireAuth";
import { getNextFireAt } from "../scheduler/scheduler";

export const configRouter = Router();

const sessionStore = createSessionStore(db);
const userStore = createUserStore(db);
const grantStore = createGrantStore(db);
const scheduleStore = createScheduleStore(db);

const configSchema = z.object({
  destEmail: z.string().email(),
  cronExpr: z.string().min(1),
  llmProvider: z.enum(["anthropic", "gemini", "openai"]),
  llmApiKey: z.string().min(1),
});

configRouter.post("/", requireAuth(sessionStore), (req, res) => {
  const result = configSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ errors: result.error.flatten().fieldErrors });
    return;
  }

  const { destEmail, cronExpr, llmProvider, llmApiKey } = result.data;
  const userId = req.userId!;

  try {
    parseExpression(cronExpr);
  } catch {
    res.status(400).json({ error: "Invalid cron expression" });
    return;
  }

  const grants = grantStore.findByUserId(userId);
  if (grants.length === 0) {
    res.status(404).json({ error: "No connected mailboxes. Visit /auth/connect first." });
    return;
  }

  userStore.setLlmConfig(userId, llmProvider, llmApiKey);

  const nextFireAt = getNextFireAt(cronExpr);
  scheduleStore.upsert(userId, destEmail, cronExpr, nextFireAt);

  res.json({
    message: "Schedule configured",
    destEmail,
    cronExpr,
    llmProvider,
    nextFireAt: new Date(nextFireAt).toISOString(),
    mailboxes: grants.map((g) => g.email),
  });
});
