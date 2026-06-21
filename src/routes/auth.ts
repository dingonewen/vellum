import { Router } from "express";
import { randomUUID } from "crypto";
import { config } from "../config";
import { nylasClient } from "../nylas/instance";
import { db } from "../db";
import { createGrantStore } from "../stores/grantStore";

export const authRouter = Router();

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
    grantStore.upsert(grantId, email);
    console.log(`Grant connected: ${email}`);
    res.redirect(`/?connected=true&email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error("Code exchange failed:", err instanceof Error ? err.message : String(err));
    res.status(502).send("Failed to complete mailbox connection. Please try again.");
  }
});
