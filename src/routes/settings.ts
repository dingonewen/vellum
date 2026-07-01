import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { createSessionStore } from "../stores/sessionStore";
import { createGrantStore } from "../stores/grantStore";
import { createManagerStore } from "../stores/managerStore";
import { requireAuth } from "../middleware/requireAuth";

export const settingsRouter = Router();

const sessionStore = createSessionStore(db);
const grantStore = createGrantStore(db);
const managerStore = createManagerStore(db);

const mailboxSchema = z.object({
  grantId: z.string().min(1),
  mailboxType: z.enum(["buyer_inbox", "manager_inbox", "other"]),
});

const managerSchema = z.object({
  digestFrequency: z.enum(["on_sensitive", "every_6h", "daily_4pm"]),
});

// GET /settings — return all grants with types + manager prefs
settingsRouter.get("/", requireAuth(sessionStore), (req, res) => {
  const userId = req.userId!;
  const grants = grantStore.findByUserId(userId);
  const manager = managerStore.findByUserId(userId);

  res.json({
    grants: grants.map((g) => ({
      grantId: g.grantId,
      email: g.email,
      mailboxType: g.mailboxType,
    })),
    manager: manager
      ? { digestFrequency: manager.digestFrequency }
      : { digestFrequency: "on_sensitive" },
  });
});

// POST /settings/mailbox — set a grant's mailbox type
settingsRouter.post("/mailbox", requireAuth(sessionStore), (req, res) => {
  const result = mailboxSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ errors: result.error.flatten().fieldErrors });
    return;
  }

  const { grantId, mailboxType } = result.data;
  grantStore.setMailboxType(grantId, mailboxType);
  res.json({ ok: true, grantId, mailboxType });
});

// POST /settings/manager — set manager digest frequency
settingsRouter.post("/manager", requireAuth(sessionStore), (req, res) => {
  const result = managerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ errors: result.error.flatten().fieldErrors });
    return;
  }

  const userId = req.userId!;
  managerStore.upsert(userId, result.data.digestFrequency);
  res.json({ ok: true, digestFrequency: result.data.digestFrequency });
});
