export interface AuthUrlParams {
  redirectUri: string;
  state: string;
  loginHint?: string;
}

export interface CodeExchangeResult {
  grantId: string;
  email: string;
}

export interface EmailSender {
  name?: string;
  email: string;
}

export interface EmailMessage {
  id: string;
  subject: string;
  sender: EmailSender;
  snippet: string;
  receivedAt: number;
  isRead: boolean;
}

export interface ListMessagesParams {
  sinceTimestamp: number;
  limit: number;
  pageToken?: string;
  unreadOnly?: boolean;
}

export interface MessagePage {
  messages: EmailMessage[];
  nextCursor: string | undefined;
}
