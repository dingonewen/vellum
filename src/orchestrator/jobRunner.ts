import type { InboxReader } from "../inbox/inboxReader";
import type { Summarizer } from "../summarizer/summarizer";
import type { EmailSender } from "../email/emailSender";
import type { JobRunner } from "../scheduler/scheduler";

const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export function createJobRunner(
  inboxReader: InboxReader,
  summarizer: Summarizer,
  emailSender: EmailSender
): JobRunner {
  return async (
    grantId: string,
    destEmail: string,
    lastSummaryAt: number | null
  ): Promise<void> => {
    const sinceMs = lastSummaryAt ?? Date.now() - DEFAULT_LOOKBACK_MS;
    const sinceSeconds = Math.floor(sinceMs / 1000);

    const messages = await inboxReader.fetchSince(grantId, sinceSeconds);

    if (messages.length === 0) {
      console.log(`No new messages since last summary — skipping digest for ${destEmail}`);
      return;
    }

    const summary = await summarizer.summarize(messages);
    await emailSender.send(grantId, destEmail, summary);

    console.log(`Digest sent to ${destEmail} (${messages.length} messages)`);
  };
}
