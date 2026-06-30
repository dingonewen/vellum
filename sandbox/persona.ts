import type { Persona } from './types';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${key}. ` +
      `Add it to your .env file with the Nylas-authenticated account details.`
    );
  }
  return value;
}

/**
 * Persona layout:
 *   PRIMARY  account = Tifa Lockhart — the buyer whose inbox is the product.
 *                      Receives PO acknowledgements, updates, exceptions, and spam.
 *                      Gmail, no throttling — fast demo friendly.
 *   CLOUD    account = Cloud Strife — supplier #1 (Outlook). Sends on tight
 *                      PO, then delays, QC failures, and eventual resolution.
 *
 * Additional suppliers (for mixed-inbox scenarios) are loaded as needed.
 */
const primaryEmail = requireEnv('SANDBOX_PRIMARY_EMAIL');
const primaryGrantId = requireEnv('SANDBOX_PRIMARY_GRANT_ID');
const cloudEmail = requireEnv('SANDBOX_CLOUD_EMAIL');
const cloudGrantId = requireEnv('SANDBOX_CLOUD_GRANT_ID');

export const PRIMARY: Persona = {
  id: 'primary',
  name: 'Tifa Lockhart',
  email: primaryEmail,
  grantId: primaryGrantId,
};

export const CLOUD: Persona = {
  id: 'cloud',
  name: 'Cloud Strife',
  email: cloudEmail,
  grantId: cloudGrantId,
};

/** Map persona id → Persona for quick senderId lookup. */
export const PERSONAS: Record<string, Persona> = {
  primary: PRIMARY,
  cloud: CLOUD,
};
