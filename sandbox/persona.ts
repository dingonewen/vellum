import BetterSqlite3 from 'better-sqlite3';
import * as path from 'path';
import type { Persona } from './types';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${key}. Add it to your .env file.`
    );
  }
  return value;
}

/**
 * Try to find a Nylas grant ID for the given email in vellum.db.
 * Returns the grant ID if found, or null.
 */
function lookupGrantId(email: string): string | null {
  try {
    const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/vellum.db');
    const db = new BetterSqlite3(dbPath, { readonly: true });
    const row = db.prepare('SELECT grant_id FROM grants WHERE email = ? ORDER BY created_at DESC LIMIT 1').get(email) as { grant_id: string } | undefined;
    db.close();
    return row?.grant_id ?? null;
  } catch {
    return null;
  }
}

function resolveGrantId(envKey: string, email: string): string {
  // Env var takes priority (backward compatible)
  const fromEnv = process.env[envKey];
  if (fromEnv) return fromEnv;

  // Auto-lookup from vellum.db (OAuth flow)
  const fromDb = lookupGrantId(email);
  if (fromDb) return fromDb;

  throw new Error(
    `Grant ID not found for ${email}. Either:\n` +
    `  1. Set ${envKey} in .env, or\n` +
    `  2. Connect the mailbox via http://localhost:3000/auth/connect first`
  );
}

const primaryEmail = requireEnv('SANDBOX_PRIMARY_EMAIL');
const cloudEmail = requireEnv('SANDBOX_CLOUD_EMAIL');
const primaryGrantId = resolveGrantId('SANDBOX_PRIMARY_GRANT_ID', primaryEmail);
const cloudGrantId = resolveGrantId('SANDBOX_CLOUD_GRANT_ID', cloudEmail);

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

export const PERSONAS: Record<string, Persona> = {
  primary: PRIMARY,
  cloud: CLOUD,
};
