import { Router } from "express";
import { randomUUID } from "crypto";
import { config } from "../config";
import { nylasClient } from "../nylas/instance";

export const authRouter = Router();

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
