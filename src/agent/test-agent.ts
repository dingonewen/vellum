import 'dotenv/config';
import { createNylasClient } from '../nylas/nylasClient';
import { createAgent, createMemoryDraftStore, createLlmClassifier, createLlmReplyGenerator } from './index';

import BetterSqlite3 from 'better-sqlite3';
import * as path from 'path';

const apiKey = process.env.ANTHROPIC_API_KEY || '';
const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
const model = 'deepseek-v4-flash';

// Resolve Tifa's grant from DB
const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/vellum.db');
const db = new BetterSqlite3(dbPath, { readonly: true });
const buyer = db.prepare("SELECT grant_id FROM grants WHERE mailbox_type = 'buyer_inbox' LIMIT 1").get() as { grant_id: string } | undefined;
db.close();
if (!buyer) { console.error('No buyer_inbox configured in DB. Set one via http://localhost:3000'); process.exit(1); }
const grantId = buyer.grant_id;

const nylas = createNylasClient();
const draftStore = createMemoryDraftStore();

const BUYER_PROMPT = `You are Tifa Lockhart, a procurement manager at Shinra Manufacturing. Write a professional email reply.

Business rules:
- If the sender mentions a PO, order, or shipment: reference the specific details (PO number, date, quantity). Confirm receipt.
- If the sender mentions an attachment but you don't see it: ask them to resend.
- If the sender asks a direct question: answer it specifically.
- If the sender reports a problem (delay, QC failure, missing shipment): express concern, ask for specifics, request an ETA.
- If the sender asks for a quote without specs: ask for part numbers, quantities, requirements.
- If the sender is introducing themselves or offering services: be polite but brief — 1-2 sentences. Don't commit.
- Keep replies 1-4 sentences. Match the sender's tone. Sign as Tifa.`;

const agent = createAgent({
  nylasClient: nylas,
  grantId,
  classifier: createLlmClassifier(apiKey, baseUrl, model),
  replyGenerator: createLlmReplyGenerator(apiKey, baseUrl, model, BUYER_PROMPT, 0.3),
  draftStore,
  autoReplyAll: true,
});

async function main() {
  console.log(`🤖 Tifa reply — one-shot inbox scan\n`);

  // Scan unread from last 24 hours, batch process everything
  const since = Math.floor(Date.now() / 1000) - 86400;
  const page = await nylas.listMessages(grantId, { sinceTimestamp: since, limit: 50, unreadOnly: true });

  if (page.messages.length === 0) {
    console.log('No messages found in Tifa\'s inbox. Run sandbox first:');
    console.log('  npx tsx sandbox/scripts/run-scenario.ts mixed-inbox --fast');
    return;
  }

  console.log(`Found ${page.messages.length} message(s) in inbox\n`);
  console.log('─'.repeat(65));

  let autoCount = 0, ignoreCount = 0, draftCount = 0;

  for (const email of page.messages) {
    const from = email.sender.name ?? email.sender.email;

    // Skip own sent mail and bounce notifications
    if (email.sender.email === 'tifalockhartwell@gmail.com') continue;
    if (email.subject.toLowerCase().includes('delivery status')) continue;

    console.log(`\n📩 ${email.subject}`);
    console.log(`   From: ${from} <${email.sender.email}>`);

    const result = await agent.process(email);

    const idx = result.action.type;
    if (idx === 'auto_replied') {
      console.log(`   → ✅ Auto-replied (msgId: ${result.action.sentMessageId.slice(0, 16)}...)`);
      console.log(`   → "${result.action.reply.body.replace(/<[^>]+>/g, '').trim().slice(0, 140)}..."`);
      autoCount++;
    } else if (idx === 'ignored') {
      console.log(`   → 🗑️  Ignored — ${result.action.reason}`);
      ignoreCount++;
    } else if (idx === 'drafted') {
      console.log(`   → 📝 Drafted — ${result.action.reason}`);
      console.log(`   → "${result.action.draft.body.replace(/<[^>]+>/g, '').trim().slice(0, 140)}..."`);
      draftCount++;
    } else if (idx === 'not_sent') {
      console.log(`   → ⏸️  Would auto-reply (no Nylas configured)`);
      autoCount++;
    }
  }

  const drafts = draftStore.list();
  console.log('\n' + '─'.repeat(65));
  console.log(`Summary: ✅ ${autoCount} auto-replied  🗑️ ${ignoreCount} ignored  📝 ${draftCount} drafted`);
  if (drafts.length > 0) {
    console.log(`Manager digest: ${drafts.length} pending approval(s)`);
    for (const d of drafts) {
      console.log(`  — ${d.email.subject}`);
    }
  }
}

main().catch(e => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
