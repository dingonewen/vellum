import Nylas from "nylas";
import { config } from "../config";
import type { NylasClient } from "./client";
import type {
  AuthUrlParams,
  CodeExchangeResult,
  EmailMessage,
  ListMessagesParams,
  MessagePage,
} from "./types";

export function createNylasClient(): NylasClient {
  const nylas = new Nylas({
    apiKey: config.NYLAS_API_KEY,
    apiUri: config.NYLAS_API_URI,
  });

  return {
    buildAuthUrl({ redirectUri, state, loginHint }: AuthUrlParams): string {
      return nylas.auth.urlForOAuth2({
        clientId: config.NYLAS_CLIENT_ID,
        redirectUri,
        state,
        loginHint,
      });
    },

    async exchangeCode(code: string): Promise<CodeExchangeResult> {
      const response = await nylas.auth.exchangeCodeForToken({
        clientId: config.NYLAS_CLIENT_ID,
        clientSecret: config.NYLAS_API_KEY,
        redirectUri: config.CALLBACK_URL,
        code,
      });
      return { grantId: response.grantId, email: response.email };
    },

    async listMessages(
      grantId: string,
      { sinceTimestamp, limit, pageToken }: ListMessagesParams
    ): Promise<MessagePage> {
      const response = await nylas.messages.list({
        identifier: grantId,
        queryParams: {
          receivedAfter: sinceTimestamp,
          limit,
          ...(pageToken !== undefined ? { pageToken } : {}),
        },
      });

      const messages: EmailMessage[] = response.data.map((msg) => {
        const from = msg.from?.[0];
        return {
          id: msg.id,
          subject: msg.subject ?? "(no subject)",
          sender: { name: from?.name, email: from?.email ?? "" },
          snippet: msg.snippet ?? "",
          receivedAt: msg.date,
          isRead: !(msg.unread ?? true),
        };
      });

      return { messages, nextCursor: response.nextCursor ?? undefined };
    },

    async getMessage(grantId: string, messageId: string): Promise<EmailMessage> {
      const response = await nylas.messages.find({
        identifier: grantId,
        messageId,
      });
      const msg = response.data;
      const from = msg.from?.[0];
      return {
        id: msg.id,
        subject: msg.subject ?? "(no subject)",
        sender: { name: from?.name, email: from?.email ?? "" },
        snippet: msg.snippet ?? "",
        receivedAt: msg.date,
        isRead: !(msg.unread ?? true),
      };
    },

    async sendMessage(
      grantId: string,
      to: string,
      subject: string,
      htmlBody: string,
      attachments = []
    ): Promise<void> {
      await nylas.messages.send({
        identifier: grantId,
        requestBody: {
          to: [{ email: to }],
          subject,
          body: htmlBody,
          ...(attachments.length > 0 ? { attachments } : {}),
        },
      });
    },
  };
}
