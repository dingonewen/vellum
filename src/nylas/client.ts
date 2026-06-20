import type { AuthUrlParams, CodeExchangeResult } from "./types";

export interface NylasClient {
  buildAuthUrl(params: AuthUrlParams): string;
  exchangeCode(code: string): Promise<CodeExchangeResult>;
}
