import type { NylasClient } from "../nylas/client";
import type { MessageStore, PendingMessage } from "../stores/messageStore";

const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 10;

async function processPending(
  pending: PendingMessage,
  messageStore: MessageStore,
  nylasClient: NylasClient
): Promise<void> {
  try {
    const message = await nylasClient.getMessage(pending.grantId, pending.messageId);
    messageStore.upsertMessage(message, pending.grantId);
    messageStore.deletePending(pending.id);
  } catch (err) {
    console.error(
      `Failed to process message ${pending.messageId}:`,
      err instanceof Error ? err.message : String(err)
    );
    // Leave claimed_at set; stale-claim recovery in claimBatch will release after 1h for retry
  }
}

export function startWebhookProcessor(
  messageStore: MessageStore,
  nylasClient: NylasClient
): void {
  setInterval(() => {
    const batch = messageStore.claimBatch(BATCH_SIZE);
    for (const pending of batch) {
      processPending(pending, messageStore, nylasClient).catch((err) => {
        console.error("Processor loop error:", err instanceof Error ? err.message : String(err));
      });
    }
  }, POLL_INTERVAL_MS);
}
