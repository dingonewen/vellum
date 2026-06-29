#!/usr/bin/env npx tsx
/**
 * Check recent messages in a persona's Nylas inbox.
 * Useful for verifying that sent sandbox emails actually arrived.
 *
 * Usage:
 *   npx tsx sandbox/scripts/check-inbox.ts <buyer|seller> [limit]
 *
 * Examples:
 *   npx tsx sandbox/scripts/check-inbox.ts seller    — Tifa's inbox, last 5 messages
 *   npx tsx sandbox/scripts/check-inbox.ts buyer 10   — Cloud's inbox, last 10 messages
 */

import 'dotenv/config';
import { createNylasClient } from '../../src/nylas/nylasClient';
import { PERSONAS } from '../persona';

const role = process.argv[2]?.toLowerCase();
if (!role || !['buyer', 'seller'].includes(role)) {
  console.error('Usage: npx tsx sandbox/scripts/check-inbox.ts <buyer|seller> [limit]');
  console.error('  buyer  = Cloud (supplier)');
  console.error('  seller = Tifa (procurement manager)');
  process.exit(1);
}

const limit = parseInt(process.argv[3] ?? '5', 10);
const persona = PERSONAS[role];
const nylas = createNylasClient();

const sinceSeconds = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60; // last 7 days

async function main() {
  console.log(`\n📬 ${persona.name} (${persona.email}) — last ${limit} messages:\n`);

  const page = await nylas.listMessages(persona.grantId, {
    sinceTimestamp: sinceSeconds,
    limit,
  });

  for (const msg of page.messages) {
    const date = new Date(msg.receivedAt * 1000).toLocaleString();
    const from = msg.sender.name
      ? `${msg.sender.name} <${msg.sender.email}>`
      : msg.sender.email;
    console.log(`┌─ ${msg.subject}`);
    console.log(`│  From: ${from}`);
    console.log(`│  Date: ${date}`);
    console.log(`│  Snippet: ${msg.snippet.slice(0, 120)}...`);
    console.log(`└─ ${msg.id}\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
