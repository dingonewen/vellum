import type { AuthUrlParams } from "./types";

export interface NylasClient {
  buildAuthUrl(params: AuthUrlParams): string;
}
