import 'dotenv/config';
import { createNylasClient } from '../nylas/nylasClient';
import { createAgent, createMemoryDraftStore, createLlmClassifier, createLlmReplyGenerator, buildDigestHtml, shouldSendDigest } from './index';
import type { DigestFrequency } from './managerDigest';

const apiKey = process.env.ANTHROPIC_API_KEY || '';
const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
const model = 'deepseek-v4-flash';

const nylas = createNylasClient();
const draftStore = createMemoryDraftStore();

import BetterSqlite3 from 'better-sqlite3';
import * as path from 'path';
const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/vellum.db');

function resolveGrant(type: string) {
  const db = new BetterSqlite3(dbPath, { readonly: true });
  const row = db.prepare('SELECT grant_id, email FROM grants WHERE mailbox_type = ? LIMIT 1').get(type) as { grant_id: string; email: string } | undefined;
  db.close();
  return row;
}

const cloud = resolveGrant('other'); // Cloud = supplier
const buyer = resolveGrant('buyer_inbox');

if (!cloud) {
  console.error('No "other" grant configured for Cloud. Set one via http://localhost:3000');
  process.exit(1);
}

const managerEmail = buyer?.email ?? cloud.email;
const managerGrantId = buyer?.grant_id ?? cloud.grant_id;

const agent = createAgent({
  nylasClient: nylas,
  grantId: cloud.grant_id,
  classifier: createLlmClassifier(apiKey, baseUrl, model),
  replyGenerator: createLlmReplyGenerator(apiKey, baseUrl, model),
  draftStore,
});

const POLL_SECONDS = parseInt(process.env.AGENT_POLL_SECONDS || '5', 10);
const processedIds = new Set<string>();
let autoCount = 0, ignoreCount = 0, draftCount = 0;
let lastDigestSent: number | null = null;

const digestFrequency: DigestFrequency = (process.env.MANAGER_DIGEST_FREQUENCY as DigestFrequency) || 'on_sensitive';

console.log(`☁️  Cloud agent started — watching ${cloud.email} every ${POLL_SECONDS}s`);
console.log(`   Manager digest: ${managerEmail} (${digestFrequency})`);
console.log(`   Model: ${model} @ ${baseUrl}\n`);

async function tick() {
  try {
    const since = Math.floor(Date.now() / 1000) - POLL_SECONDS * 2;
    const page = await nylas.listMessages(cloud!.grant_id, { sinceTimestamp: since, limit: 5, unreadOnly: true });

    for (const email of page.messages) {
      if (processedIds.has(email.id)) continue;
      if (email.sender.email === cloud!.email) continue;
      if (email.subject.toLowerCase().includes('delivery status')) continue;
      processedIds.add(email.id);

      const result = await agent.process(email);
      const t = result.action.type;
      if (t === 'auto_replied' || t === 'not_sent') autoCount++;
      else if (t === 'ignored') ignoreCount++;
      else draftCount++;

      const icon = t === 'auto_replied' ? '✅' : t === 'ignored' ? '🗑️' : '📝';
      console.log(`${icon} [${t}] ${email.subject.slice(0, 70)}`);

      if (t === 'drafted' && shouldSendDigest(digestFrequency, lastDigestSent, true)) {
        const drafts = draftStore.list();
        const html = buildDigestHtml(drafts, autoCount, ignoreCount);
        try {
          await nylas.sendMessage(
            managerGrantId!,
            managerEmail,
            `📋 Cloud Agent Digest — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
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

tick();
setInterval(tick, POLL_SECONDS * 1000);
