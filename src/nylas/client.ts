import type { AuthUrlParams, CodeExchangeResult, EmailMessage, ListMessagesParams, MessagePage } from "./types";

export interface NylasClient {
  buildAuthUrl(params: AuthUrlParams): string;
  exchangeCode(code: string): Promise<CodeExchangeResult>;
  listMessages(grantId: string, params: ListMessagesParams): Promise<MessagePage>;
  getMessage(grantId: string, messageId: string): Promise<EmailMessage>;
  sendMessage(grantId: string, to: string, subject: string, htmlBody: string): Promise<void>;
}
