import type { AuthUrlParams, CodeExchangeResult, ListMessagesParams, MessagePage } from "./types";

export interface NylasClient {
  buildAuthUrl(params: AuthUrlParams): string;
  exchangeCode(code: string): Promise<CodeExchangeResult>;
  listMessages(grantId: string, params: ListMessagesParams): Promise<MessagePage>;
}
