import type { GrantStore } from "../stores/grantStore";
import type { UserStore } from "../stores/userStore";
import type { InboxReader } from "../inbox/inboxReader";
import type { Summarizer } from "../summarizer/summarizer";
import type { EmailSender } from "../email/emailSender";
import type { JobRunner } from "../scheduler/scheduler";
import { createAnthropicSummarizer } from "../summarizer/anthropicSummarizer";

const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export function createJobRunner(
  grantStore: GrantStore,
  userStore: UserStore,
  inboxReader: InboxReader,
  emailSender: EmailSender
): JobRunner {
  return async (
    userId: string,
    destEmail: string,
    lastSummaryAt: number | null
  ): Promise<void> => {
    const grants = grantStore.findByUserId(userId);
    if (grants.length === 0) {
      console.log(`No connected mailboxes for user ${userId} — skipping`);
      return;
    }

    const sinceMs = lastSummaryAt ?? Date.now() - DEFAULT_LOOKBACK_MS;
    const sinceSeconds = Math.floor(sinceMs / 1000);

    const allMessages = (
      await Promise.all(
        grants.map((grant) => inboxReader.fetchSince(grant.grantId, sinceSeconds))
      )
    )
      .flat()
      .sort((a, b) => a.receivedAt - b.receivedAt);

    if (allMessages.length === 0) {
      console.log(`No new messages since last summary — skipping digest for ${destEmail}`);
      return;
    }

    const user = userStore.findById(userId);
    if (!user?.anthropicApiKey) {
      console.error(`No Anthropic API key configured for user ${userId} — skipping digest`);
      return;
    }
    const summarizer: Summarizer = createAnthropicSummarizer(user.anthropicApiKey);

    const summary = await summarizer.summarize(allMessages);
    await emailSender.send(grants[0].grantId, destEmail, summary);

    console.log(
      `Digest sent to ${destEmail} (${allMessages.length} messages across ${grants.length} mailbox${grants.length !== 1 ? "es" : ""})`
    );
  };
}
