import { Router } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { config } from "../config";
import { db } from "../db";
import { createMessageStore } from "../stores/messageStore";

export const webhookRouter = Router();

const messageStore = createMessageStore(db);

const notificationSchema = z.object({
  type: z.string(),
  data: z.object({
    grant_id: z.string(),
    object: z.object({ id: z.string() }),
  }),
});

function verifySignature(rawBody: Buffer, signature: string): boolean {
  const expected = createHmac("sha256", config.NYLAS_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

webhookRouter.get("/nylas", (req, res) => {
  const { challenge } = req.query;

  if (typeof challenge !== "string" || challenge.length === 0) {
    res.status(400).send("Missing challenge parameter.");
    return;
  }

  res.type("text/plain").send(challenge);
});

webhookRouter.post("/nylas", (req, res) => {
  if (!config.NYLAS_WEBHOOK_SECRET) {
    console.error("NYLAS_WEBHOOK_SECRET is not set — rejecting webhook");
    res.status(500).end();
    return;
  }

  const signature = req.headers["x-nylas-signature"];
  if (typeof signature !== "string") {
    res.status(401).end();
    return;
  }

  const rawBody = req.body as Buffer;
  if (!verifySignature(rawBody, signature)) {
    res.status(401).end();
    return;
  }

  // Acknowledge immediately — heavy work happens in the processor
  res.status(200).end();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString("utf8"));
  } catch {
    console.error("Webhook body is not valid JSON");
    return;
  }

  const result = notificationSchema.safeParse(parsed);
  if (!result.success) {
    console.error("Unexpected webhook payload shape:", result.error.flatten());
    return;
  }

  const { grant_id: grantId, object: { id: messageId } } = result.data.data;
  messageStore.enqueue(messageId, grantId);
});
