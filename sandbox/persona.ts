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

export const BUYER: Persona = {
  id: 'buyer',
  name: 'Alice Chen',
  email: buyerEmail,
  grantId: buyerGrantId,
};

export const SELLER: Persona = {
  id: 'seller',
  name: "Bob's Vintage Audio",
  email: sellerEmail,
  grantId: sellerGrantId,
};

export const PERSONAS: Record<string, Persona> = {
  buyer: BUYER,
  seller: SELLER,
};
