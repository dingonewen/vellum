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

const DRY_RUN = process.env.DRY_RUN === '1';
const BASE_POLL_SECONDS = parseInt(process.env.AGENT_POLL_SECONDS || '20', 10);
let currentPollSeconds = BASE_POLL_SECONDS;
const MAX_POLL_SECONDS = 60;
const processedIds = new Set<string>();
let autoCount = 0, ignoreCount = 0, draftCount = 0;

console.log(`🤖 ${persona.name} daemon — ${persona.email} base=${BASE_POLL_SECONDS}s  temp=${persona.temp}  ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

// Dry-run: skip actual sending but still classify + generate
const agent = createAgent({
  nylasClient: DRY_RUN ? undefined : nylas,
  grantId: DRY_RUN ? undefined : persona.grantId,
  classifier: createLlmClassifier(apiKey, baseUrl, model),
  replyGenerator: createLlmReplyGenerator(apiKey, baseUrl, model, persona.prompt, persona.temp),
  draftStore,
  autoReplyAll: true,
});

async function tick() {
  try {
    const since = Math.floor(Date.now() / 1000) - currentPollSeconds * 3;
    const page = await nylas.listMessages(persona!.grantId, { sinceTimestamp: since, limit: 1 });

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

    // Success — gradually speed back up
    if (currentPollSeconds > BASE_POLL_SECONDS) {
      currentPollSeconds = Math.max(BASE_POLL_SECONDS, currentPollSeconds - 5);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/429|rate limit|activity limit|too many|throttl/i.test(msg)) {
      currentPollSeconds = Math.min(MAX_POLL_SECONDS, currentPollSeconds + 10);
      console.warn(`  ⏳ Rate limited — slowing to ${currentPollSeconds}s`);
    } else if (!msg.includes('timeout')) {
      console.error('  ⚠', msg);
    }
  }
  // Re-schedule with updated interval
  clearTimeout(timer);
  timer = setTimeout(tick, currentPollSeconds * 1000);
}

let timer = setTimeout(tick, 1000); // start in 1s

// ── Proactive mode (Cloud → Tifa random initiating emails) ──────────

const PROACTIVE_INTERVAL = parseInt(process.env.PROACTIVE_INTERVAL || '0', 10); // seconds, 0=off

const PROACTIVE_MAX = parseInt(process.env.PROACTIVE_MAX || '0', 10); // max threads, 0=unlimited

if (PROACTIVE_INTERVAL > 0 && personaId === 'cloud') {
  const buyerInfo = grants.find(g => g.mailbox_type === 'buyer_inbox');
  let proactiveSent = 0;
  if (!buyerInfo) {
    console.error('PROACTIVE mode requires a buyer_inbox grant. Skipping.');
  } else {
    // Weighted topics — 2:3:5 clean:exception:irrelevant for realistic inbox
    const topics: Array<{ subject: string; weight: number }> = [
      // Clean (20%) — PO accepted, no issues, smooth transaction
      { subject: 'PO #${po} — Confirmed, ETA ${eta}', weight: 10 },
      { subject: 'Re: PO #${po} — Shipment on Schedule', weight: 10 },
      // Exception (30%) — supplier can't fulfill, delays, back-and-forth
      { subject: 'URGENT: PO #${po} — Material Shortage, Revised ETA ${eta}', weight: 8 },
      { subject: 'Re: PO #${po} — Unable to Fulfill at Quoted Price', weight: 8 },
      { subject: 'PO #${po} — Partial Shipment Due to QC Hold', weight: 7 },
      { subject: 'Re: PO #${po} — Delay Notice, Supplier Backlog', weight: 7 },
      // Irrelevant (50%) — spam, wrong person, marketing, HR, garbage
      { subject: '🔥 ONE-TIME OFFER — 50% Off Industrial Parts!!!', weight: 4 },
      { subject: 'Reminder: Annual HR Compliance Training Due', weight: 4 },
      { subject: 'Is this the Accounting Department?', weight: 4 },
      { subject: 'New Product Line — Spring 2026 Catalog Now Available', weight: 4 },
      { subject: 'Re: Your LinkedIn Profile Was Viewed 12 Times This Week', weight: 4 },
      { subject: 'Fwd: Need Volunteers for the Company Picnic', weight: 4 },
      { subject: 'Office Supplies Order — Please Approve Stationery Request', weight: 4 },
      { subject: 'IMPORTANT: Building Fire Drill This Thursday', weight: 4 },
      { subject: 'YOU WON! Claim Your Free Industrial Tools Bundle', weight: 4 },
      { subject: 'Quick Question — Does Anyone Have Ray\'s New Email?', weight: 4 },
      { subject: 'Newsletter: Q3 Manufacturing Trends & Insights', weight: 4 },
      { subject: 'Invoice #${inv} — Payment Confirmation (Auto-Generated)', weight: 4 },
    ];
    const totalWeight = topics.reduce((s, t) => s + t.weight, 0);

    const suppliers = [
      { name: 'Sarah', company: 'Acme Industrial Supply', personality: 'efficient and friendly' },
      { name: 'Cloud Strife', company: 'Nibelheim Precision Parts', personality: 'detail-oriented and formal' },
      { name: 'Marco', company: 'Zenith Parts Co.', personality: 'casual and salesy' },
      { name: 'Ray', company: 'Midgar Component Supply', personality: 'terse and technical' },
      { name: 'Judy', company: 'Corellia Precision Ltd', personality: 'warm and relationship-focused' },
      { name: 'Biggs', company: 'Avalanche Industrial', personality: 'blunt and no-nonsense' },
    ];

    let proactiveTimer: ReturnType<typeof setInterval>;
    function r(n: number) { return Math.floor(Math.random() * n); }
    function weightedPick<T extends { weight: number }>(arr: T[]): T {
      let n = r(totalWeight);
      for (const item of arr) { n -= item.weight; if (n < 0) return item; }
      return arr[0];
    }

    async function proactiveSend() {
      if (PROACTIVE_MAX > 0 && proactiveSent >= PROACTIVE_MAX) {
        clearInterval(proactiveTimer);
        return;
      }
      proactiveSent++;
      const topic = weightedPick(topics);
      const sup = suppliers[r(suppliers.length)];
      const po = `PO-2026-${String(r(9000) + 1000)}`;
      const inv = `INV-${String(r(9000) + 1000)}`;
      const eta = new Date(Date.now() + (r(14)+1)*86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const qty = [50, 100, 200, 300, 500, 750, 1000][r(7)];
      const products = ['Precision Bearings ABEC-7', '6205-2RS Ball Bearings', 'Ceramic Hybrid Bearings', 'Tapered Roller Bearings', 'Stainless Steel Bearings'];
      const product = products[r(products.length)];
      const issues = ['raceway roundness out of ABEC-7 spec on ~20% of batch', 'bearing noise level exceeding 32dB threshold', 'inner ring hardness testing below spec', 'surface finish roughness on outer diameter', 'cage misalignment in assembly'];

      // Fill template vars
      const vars: Record<string,string> = { po, inv, eta, qty: String(qty), product, supplier: sup.name, company: sup.company, issue: issues[r(issues.length)] };
      const subject = topic.subject.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '');

      // Use LLM to generate email body matching the topic type
      const isIrrelevant = /OFF|Training|Accounting|Catalog|LinkedIn|Picnic|Office Supplies|Fire Drill|WON|Ray's|Newsletter|Auto-Generated/i.test(topic.subject);
      const bodyPrompt = isIrrelevant
        ? `Write a ONE-SENTENCE email. Subject: "${topic.subject}"

Make it sound real — like an actual marketing email, HR announcement, misdirected question, or newsletter. Include realistic details (dates, names, links). Don't address Tifa by name — this is a broadcast or misdirected email. Return ONLY the body text.`
        : `You are ${sup.name} at ${sup.company}. You are ${sup.personality}.

Write a ONE-SENTENCE email to Tifa Lockhart (buyer at Shinra Manufacturing). Subject: "${topic.subject}"

Context: ${topic.subject.includes('URGENT') || topic.subject.includes('Delay') || topic.subject.includes('Shortage') || topic.subject.includes('Unable') || topic.subject.includes('Partial') ? 'This is an EXCEPTION — something went wrong. Explain the problem honestly. Vary the severity per email — some are minor hiccups, others are serious issues.' : 'This is a CLEAN transaction — everything is on track. Be brief and positive.'}

Rules:
- Vary greeting (sometimes "Hi Tifa", "Tifa —", "Dear Tifa", or just jump in).
- Vary closing (sometimes "-${sup.name}", "Thanks, ${sup.name}", "Best, ${sup.name}", just your name).
- Personality: ${sup.personality}.
- Sound like a real person, not a template. Return ONLY the body text.`;

      let body: string;
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const c = new Anthropic({ apiKey, baseURL: baseUrl });
        const resp = await c.messages.create({
          model, max_tokens: 200, temperature: 0.9,
          messages: [{ role: 'user', content: bodyPrompt }],
        });
        const tb = resp.content.find((b: any) => b.type === 'text') ?? resp.content[0];
        body = (tb as any).text?.trim() || `${sup.name} @ ${sup.company}: ${topic.subject}`;
      } catch {
        body = `${sup.name} at ${sup.company} — ${subject}`;
      }
      if (DRY_RUN) {
        console.log(`📤 [DRY RUN] ${sup.name} → "${subject.slice(0, 50)}"`);
      } else {
        try {
          const r = await nylas.sendMessage(persona.grantId, buyerInfo!.email, subject, body);
          console.log(`📤 [proactive] ${sup.name} → ${subject.slice(0, 50)} (msgId: ${r.messageId.slice(0, 12)}...)`);
        } catch (e: any) {
          const em = e?.message || String(e);
          if (/429|rate limit|activity limit|too many|throttl/i.test(em)) {
            console.warn('  ⏳ Proactive rate limited — backing off...');
          } else {
            console.error('  ⚠ proactive:', em);
          }
        }
      }
    }

    const maxLabel = PROACTIVE_MAX > 0 ? ` (max ${PROACTIVE_MAX} threads)` : '';
    console.log(`📤 Proactive mode: Cloud → Tifa every ${PROACTIVE_INTERVAL}s${maxLabel}\n`);
    proactiveSend();
    proactiveTimer = setInterval(proactiveSend, PROACTIVE_INTERVAL * 1000);
  }
}
