export interface AuthUrlParams {
  redirectUri: string;
  state: string;
  loginHint?: string;
}

export interface CodeExchangeResult {
  grantId: string;
  email: string;
}
