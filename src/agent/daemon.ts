import 'dotenv/config';
import { createNylasClient } from '../nylas/nylasClient';
import { createAgent, createMemoryDraftStore, createLlmClassifier, createLlmReplyGenerator, buildDigestHtml, shouldSendDigest } from './index';
import type { DigestFrequency } from './managerDigest';

const apiKey = process.env.ANTHROPIC_API_KEY || '';
const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
const model = 'deepseek-v4-flash';

const nylas = createNylasClient();
const draftStore = createMemoryDraftStore();

// Resolve personas from DB by mailbox_type
import BetterSqlite3 from 'better-sqlite3';
import * as path from 'path';
const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/vellum.db');

function resolveGrant(type: string) {
  const db = new BetterSqlite3(dbPath, { readonly: true });
  const row = db.prepare('SELECT grant_id, email FROM grants WHERE mailbox_type = ? LIMIT 1').get(type) as { grant_id: string; email: string } | undefined;
  db.close();
  return row;
}

const buyer = resolveGrant('buyer_inbox');
const manager = resolveGrant('manager_inbox');

if (!buyer) {
  console.error('No buyer_inbox configured. Set one via http://localhost:3000');
  process.exit(1);
}

const managerEmail = manager?.email ?? buyer.email;
const managerGrantId = manager?.grant_id ?? buyer.grant_id; // fallback: send to self

const agent = createAgent({
  nylasClient: nylas,
  grantId: buyer.grant_id,
  classifier: createLlmClassifier(apiKey, baseUrl, model),
  replyGenerator: createLlmReplyGenerator(apiKey, baseUrl, model),
  draftStore,
});

const POLL_SECONDS = parseInt(process.env.AGENT_POLL_SECONDS || '5', 10);
const processedIds = new Set<string>();
let autoCount = 0, ignoreCount = 0, draftCount = 0;
let lastDigestSent: number | null = null;

const digestFrequency: DigestFrequency = (process.env.MANAGER_DIGEST_FREQUENCY as DigestFrequency) || 'on_sensitive';

console.log(`🤖 Agent daemon started — watching ${buyer.email} every ${POLL_SECONDS}s`);
console.log(`   Manager digest: ${managerEmail} (${digestFrequency})`);
console.log(`   Model: ${model} @ ${baseUrl}\n`);

async function tick() {
  try {
    const since = Math.floor(Date.now() / 1000) - POLL_SECONDS * 2;
    const page = await nylas.listMessages(buyer!.grant_id, { sinceTimestamp: since, limit: 5, unreadOnly: true });

    for (const email of page.messages) {
      if (processedIds.has(email.id)) continue;
      if (email.sender.email === buyer!.email) continue; // skip own mail
      if (email.subject.toLowerCase().includes('delivery status')) continue;
      processedIds.add(email.id);

      const result = await agent.process(email);
      const t = result.action.type;
      if (t === 'auto_replied' || t === 'not_sent') autoCount++;
      else if (t === 'ignored') ignoreCount++;
      else draftCount++;

      const icon = t === 'auto_replied' ? '✅' : t === 'ignored' ? '🗑️' : '📝';
      console.log(`${icon} [${t}] ${email.subject.slice(0, 70)}`);

      // Send manager digest if a draft was queued and frequency says now
      if (t === 'drafted' && shouldSendDigest(digestFrequency, lastDigestSent, true)) {
        const drafts = draftStore.list();
        const html = buildDigestHtml(drafts, autoCount, ignoreCount);
        try {
          await nylas.sendMessage(
            managerGrantId!,
            managerEmail,
            `📋 Agent Digest — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            html,
          );
          lastDigestSent = Date.now();
          console.log(`  📬 Digest sent to ${managerEmail} (${drafts.length} draft(s))`);
        } catch (e) {
          console.error('  ⚠ Failed to send digest:', (e as Error).message);
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('429') && !msg.includes('timeout')) {
      console.error('  ⚠', msg);
    }
  }
}

// First run, then poll
tick();
setInterval(tick, POLL_SECONDS * 1000);
