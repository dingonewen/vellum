import type { NylasClient } from "../nylas/client";
import type { EmailMessage } from "../nylas/types";

const PAGE_SIZE = 50;
const MAX_MESSAGES = 200;

export interface InboxReader {
  fetchSince(grantId: string, sinceTimestamp: number): Promise<EmailMessage[]>;
}

export function createInboxReader(client: NylasClient): InboxReader {
  return {
    async fetchSince(grantId: string, sinceTimestamp: number): Promise<EmailMessage[]> {
      const all: EmailMessage[] = [];
      let pageToken: string | undefined;

      do {
        const page = await client.listMessages(grantId, {
          sinceTimestamp,
          limit: PAGE_SIZE,
          pageToken,
        });

        all.push(...page.messages);
        pageToken = page.nextCursor;
      } while (pageToken !== undefined && all.length < MAX_MESSAGES);

      return all;
    },
  };
}
