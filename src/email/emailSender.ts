import type { NylasClient } from "../nylas/client";
import type { SummaryResult } from "../summarizer/types";

export interface EmailSender {
  send(grantId: string, destEmail: string, summary: SummaryResult): Promise<void>;
}

export function createEmailSender(client: NylasClient): EmailSender {
  return {
    async send(grantId: string, destEmail: string, summary: SummaryResult): Promise<void> {
      await client.sendMessage(grantId, destEmail, summary.subject, summary.htmlBody);
    },
  };
}
