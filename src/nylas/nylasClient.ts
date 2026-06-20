import Nylas from "nylas";
import { config } from "../config";
import type { NylasClient } from "./client";
import type { AuthUrlParams } from "./types";

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
  };
}
