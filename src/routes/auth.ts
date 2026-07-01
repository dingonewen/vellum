import { Router } from "express";
import { randomUUID } from "crypto";
import { config } from "../config";
import { nylasClient } from "../nylas/instance";
import { db } from "../db";
import { createUserStore } from "../stores/userStore";
import { createSessionStore } from "../stores/sessionStore";
import { createGrantStore } from "../stores/grantStore";

export const authRouter = Router();

const userStore = createUserStore(db);
const sessionStore = createSessionStore(db);
const grantStore = createGrantStore(db);

const STATE_TTL_MS = 10 * 60 * 1000;
const pendingStates = new Map<string, number>();

export function consumeState(state: string): boolean {
  const issuedAt = pendingStates.get(state);
  if (issuedAt === undefined) return false;
  pendingStates.delete(state);
  return Date.now() - issuedAt < STATE_TTL_MS;
}

authRouter.get("/connect", (_req, res) => {
  const state = randomUUID();
  pendingStates.set(state, Date.now());

  const url = nylasClient.buildAuthUrl({
    redirectUri: config.CALLBACK_URL,
    state,
  });

  res.redirect(url);
});

authRouter.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error !== undefined) {
    res.status(400).send("Mailbox connection was denied or cancelled. Please try again.");
    return;
  }

  if (typeof state !== "string" || !consumeState(state)) {
    res.status(400).send("Invalid or expired state parameter. Please start the connection flow again.");
    return;
  }

  if (typeof code !== "string") {
    res.status(400).send("Missing authorization code.");
    return;
  }

  try {
    const { grantId, email } = await nylasClient.exchangeCode(code);

    // Reuse existing user from session, or create a new one
    const sessionId = req.cookies?.session_id as string | undefined;
    let userId: string;

    if (sessionId) {
      const session = sessionStore.find(sessionId);
      userId = session?.userId ?? randomUUID();
      if (!session) userStore.create(userId);
    } else {
      userId = randomUUID();
      userStore.create(userId);
    }

    grantStore.upsert(userId, grantId, email);
    console.log(`Grant connected: ${email} → user ${userId}`);

    // Issue a fresh session cookie
    const newSessionId = randomUUID();
    sessionStore.create(newSessionId, userId);
    const isProduction = config.APP_BASE_URL.startsWith("https");
    res.cookie("session_id", newSessionId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`/?connected=true&email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error("Code exchange failed:", err instanceof Error ? err.message : String(err));
    res.status(502).send("Failed to complete mailbox connection. Please try again.");
  }
});

// Returns all mailboxes for the current session user
authRouter.get("/grants", (req, res) => {
  const sessionId = req.cookies?.session_id as string | undefined;
  if (!sessionId) {
    res.json({ grants: [] });
    return;
  }
  const session = sessionStore.find(sessionId);
  if (!session) {
    res.json({ grants: [] });
    return;
  }
  const grants = grantStore.findByUserId(session.userId);
  res.json({ grants: grants.map((g) => ({ email: g.email, grantId: g.grantId })) });
});

// Delete a connected mailbox
authRouter.delete("/grants/:grantId", (req, res) => {
  const sessionId = req.cookies?.session_id as string | undefined;
  if (!sessionId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const session = sessionStore.find(sessionId);
  if (!session) { res.status(401).json({ error: "Session expired" }); return; }

  grantStore.deleteByGrantId(req.params.grantId);
  res.json({ ok: true });
});
