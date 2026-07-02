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

const agent = createAgent({
  nylasClient: nylas,
  grantId,
  classifier: createLlmClassifier(apiKey, baseUrl, model),
  replyGenerator: createLlmReplyGenerator(apiKey, baseUrl, model),
  draftStore,
});

async function main() {
  console.log(`Agent live test — ${model} @ ${baseUrl}`);
  console.log(`Reading Tifa's inbox (grant: ${grantId.slice(0, 8)}...)\n`);

  // Fetch recent emails from Tifa's inbox (last 10)
  const since = Math.floor(Date.now() / 1000) - 3600; // last hour
  const page = await nylas.listMessages(grantId, { sinceTimestamp: since, limit: 10, unreadOnly: true });

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
