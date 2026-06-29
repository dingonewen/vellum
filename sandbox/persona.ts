import type { Persona } from './types';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${key}. ` +
      `Add it to your .env file with the Nylas-authenticated Gmail account details.`
    );
  }
  return value;
}

const buyerEmail = requireEnv('SANDBOX_BUYER_EMAIL');
const buyerGrantId = requireEnv('SANDBOX_BUYER_GRANT_ID');
const sellerEmail = requireEnv('SANDBOX_SELLER_EMAIL');
const sellerGrantId = requireEnv('SANDBOX_SELLER_GRANT_ID');

/**
 * Persona mapping:
 *   BUYER  account (SANDBOX_BUYER_*)  = Cloud   — supplier / sales rep
 *   SELLER account (SANDBOX_SELLER_*) = Tifa    — procurement manager
 *
 * In PO scenarios Tifa (SELLER) initiates by sending the purchase order;
 * Claude (BUYER) responds with confirmations, delay notices, and delivery updates.
 */
export const BUYER: Persona = {
  id: 'buyer',
  name: 'Cloud Strife',
  email: buyerEmail,
  grantId: buyerGrantId,
};

export const SELLER: Persona = {
  id: 'seller',
  name: 'Tifa Lockhart',
  email: sellerEmail,
  grantId: sellerGrantId,
};

export const PERSONAS: Record<string, Persona> = {
  buyer: BUYER,
  seller: SELLER,
};
