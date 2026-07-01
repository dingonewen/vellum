import BetterSqlite3 from 'better-sqlite3';
import * as path from 'path';
import type { Persona } from './types';

/** Open the Vellum DB (read-only) and resolve a persona by mailbox_type. */
function resolvePersona(
  id: string,
  name: string,
  mailboxType: string,
  envEmailKey: string,
): Persona {
  const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/vellum.db');
  const db = new BetterSqlite3(dbPath, { readonly: true });

  const row = db.prepare(
    'SELECT email, grant_id FROM grants WHERE mailbox_type = ? ORDER BY created_at ASC LIMIT 1'
  ).get(mailboxType) as { email: string; grant_id: string } | undefined;
  db.close();

  if (row) {
    return { id, name, email: row.email, grantId: row.grant_id };
  }

  // Fallback: try env var
  const email = process.env[envEmailKey];
  if (!email) {
    throw new Error(
      `No mailbox configured as "${mailboxType}". Either:\n` +
      `  1. Visit http://localhost:3000, connect a mailbox, and set its type to "${mailboxType}", or\n` +
      `  2. Set ${envEmailKey} in .env`
    );
  }

  throw new Error(
    `Mailbox ${email} not found in DB. Run OAuth first: http://localhost:3000/auth/connect`
  );
}

export const PRIMARY: Persona = resolvePersona('primary', 'Tifa Lockhart', 'buyer_inbox', 'SANDBOX_PRIMARY_EMAIL');

export const CLOUD: Persona = resolvePersona('cloud', 'Cloud Strife', 'other', 'SANDBOX_CLOUD_EMAIL');

export const PERSONAS: Record<string, Persona> = {
  primary: PRIMARY,
  cloud: CLOUD,
};
