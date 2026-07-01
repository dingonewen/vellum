import 'dotenv/config';
import BetterSqlite3 from 'better-sqlite3';
import * as path from 'path';
import { createNylasClient } from '../nylas/nylasClient';
import { createAgent, createMemoryDraftStore, createLlmClassifier, createLlmReplyGenerator } from './index';

// ── Persona registry ─────────────────────────────────────────────────

const BUYER_PROMPT = `You are Tifa Lockhart, a procurement manager at Shinra Manufacturing. Write a professional email reply.

Business rules:
- If the sender mentions a PO, order, or shipment: reference the specific details (PO number, date, quantity). Confirm receipt.
- If the sender mentions an attachment but you don't see it: ask them to resend.
- If the sender asks a direct question: answer it specifically.
- If the sender reports a problem (delay, QC failure, missing shipment): express concern, ask for specifics, request an ETA.
- If the sender asks for a quote without specs: ask for part numbers, quantities, requirements.
- If the sender is introducing themselves or offering services: be polite but brief — 1-2 sentences. Don't commit.
- Keep replies 1-4 sentences. Match the sender's tone. Sign as Tifa.`;

const SUPPLIER_PROMPT = `You are a supplier responding to Tifa Lockhart, a buyer at Shinra Manufacturing. Determine your identity from the email thread context (which company you represent, what you're supplying).

Adapt your reply to the context:
- If Tifa is asking about a PO or shipment: provide a status update with specific details. Reference PO numbers, dates, quantities from the conversation. Vary detail level per reply.
- If Tifa is upset about a delay: apologize professionally, give a plausible business reason (supplier delay, QC check, logistics), offer concrete resolution (revised date, partial shipment, discount).
- If Tifa asks for tracking or confirmation: provide it specifically with realistic tracking numbers, dates, ETAs.
- If Tifa asks something you can't answer: say you'll check and get back. Don't invent unverifiable specifics.
- Vary your reply style: some replies short and direct, others more detailed with explanations. Use natural business English. Sign with your company name and role.
- If this is a clean, resolved thread: wrap up professionally with a thank-you and mention of future orders.
- NEVER repeat the same phrases across different threads. Vary sentence structure, greetings, and closings.`;

// ── CLI ──────────────────────────────────────────────────────────────

const personaId = process.argv[2] || 'buyer';

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/vellum.db');
const db = new BetterSqlite3(dbPath, { readonly: true });
const grants = db.prepare('SELECT grant_id, email, mailbox_type FROM grants').all() as Array<{ grant_id: string; email: string; mailbox_type: string }>;
db.close();

let persona: { grantId: string; email: string; name: string; prompt: string; temp: number };

const buyer = grants.find(g => g.mailbox_type === 'buyer_inbox');
const supplier = grants.find(g => g.mailbox_type === 'other');

if (personaId === 'buyer' && buyer) {
  persona = { grantId: buyer.grant_id, email: buyer.email, name: 'Tifa Lockhart', prompt: BUYER_PROMPT, temp: 0.3 };
} else if (personaId === 'cloud' && supplier) {
  persona = { grantId: supplier.grant_id, email: supplier.email, name: 'Cloud Strife (Supplier)', prompt: SUPPLIER_PROMPT, temp: 0.6 };
} else {
  console.error(`Unknown or unconfigured persona: "${personaId}".`);
  console.error('Available: buyer (buyer_inbox), cloud (other). Configure types via http://localhost:3000');
  process.exit(1);
}

// ── Agent setup ──────────────────────────────────────────────────────

const apiKey = process.env.ANTHROPIC_API_KEY || '';
const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
const model = 'deepseek-v4-flash';

const nylas = createNylasClient();
const draftStore = createMemoryDraftStore();

const agent = createAgent({
  nylasClient: nylas,
  grantId: persona.grantId,
  classifier: createLlmClassifier(apiKey, baseUrl, model),
  replyGenerator: createLlmReplyGenerator(apiKey, baseUrl, model, persona.prompt, persona.temp),
  draftStore,
});

const POLL_SECONDS = parseInt(process.env.AGENT_POLL_SECONDS || '5', 10);
const processedIds = new Set<string>();
let autoCount = 0, ignoreCount = 0, draftCount = 0;

console.log(`🤖 ${persona.name} daemon — ${persona.email} every ${POLL_SECONDS}s  temp=${persona.temp}\n`);

async function tick() {
  try {
    const since = Math.floor(Date.now() / 1000) - POLL_SECONDS * 2;
    const page = await nylas.listMessages(persona!.grantId, { sinceTimestamp: since, limit: 5, unreadOnly: true });

    for (const email of page.messages) {
      if (processedIds.has(email.id)) continue;
      if (email.sender.email === persona!.email) continue;
      if (email.subject.toLowerCase().includes('delivery status')) continue;
      processedIds.add(email.id);

      const result = await agent.process(email);
      const t = result.action.type;
      if (t === 'auto_replied' || t === 'not_sent') autoCount++;
      else if (t === 'ignored') ignoreCount++;
      else draftCount++;

      const icon = t === 'auto_replied' ? '✅' : t === 'ignored' ? '🗑️' : '📝';
      const from = email.sender.name || email.sender.email;
      console.log(`${icon} [${t}] ${from.slice(0, 20)} → "${email.subject.slice(0, 60)}"`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('429') && !msg.includes('timeout')) console.error('  ⚠', msg);
  }
}

tick();
setInterval(tick, POLL_SECONDS * 1000);
