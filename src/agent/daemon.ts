import 'dotenv/config';
import BetterSqlite3 from 'better-sqlite3';
import * as path from 'path';
import { createNylasClient } from '../nylas/nylasClient';
import { createAgent, createMemoryDraftStore, createLlmClassifier, createLlmReplyGenerator } from './index';

// ── Persona prompts ────────────────────────────────────────────────

const BUYER_PROMPT = `You are Tifa Lockhart, a procurement manager at Shinra Manufacturing. Write a professional email reply that sounds like a real busy human — not a bot.

Business rules:
- If the sender mentions a PO, order, or shipment WITHOUT including specific details (quantity, price, delivery date, tracking, or PDF attachment): ask for the missing information. Don't just say "thanks."
- If the sender includes sufficient details: confirm receipt and reference the specifics.
- If the sender reports a problem (delay, QC failure, missing shipment): express concern, ask for specifics, request an ETA. Match their urgency level.
- If the sender asks for a quote without specs: ask for part numbers, quantities, requirements.
- If the sender is introducing themselves or offering services: be polite but brief — 1-2 sentences. Don't commit.
- VARY your style: some replies are one-line ("Got it. Ship Friday."), others are 2-4 sentences with follow-up questions. Don't always say "thank you" or "best regards."
- NEVER echo back what the sender just told you. Add something new or keep it to one word.
- Match the sender's tone — casual emails get casual replies.
- Sign as Tifa.`;

const SUPPLIER_PROMPT = `You are a supplier responding to Tifa Lockhart, a buyer at Shinra Manufacturing. Determine your identity from the email thread context.

Adapt your reply like a real busy professional — not a bot:
- If Tifa asks about a PO or shipment: provide a status update with specific details. Some replies terse ("On track. Ships Friday."), others detailed.
- If Tifa is upset: apologize, explain the reason (material shortage, QC failure, logistics), offer a concrete solution. Vary severity.
- If Tifa asks for specifics: provide them. If you don't know, say you'll check — don't invent.
- Vary closings: sometimes sign with name and company, sometimes just your name, sometimes no closing.
- Match Tifa's rhythm: if she's terse, be terse. If she's formal, be formal.
- NEVER echo back what Tifa just said. Add new information or ask a question.
- NEVER repeat phrases across threads. Vary sentence structure, greetings, and detail.`;

// ── CLI ──────────────────────────────────────────────────────────

const personaId = process.argv[2] || 'buyer';
const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/vellum.db');
const db = new BetterSqlite3(dbPath, { readonly: true });
const grants = db.prepare('SELECT grant_id, email, mailbox_type FROM grants').all() as Array<{ grant_id: string; email: string; mailbox_type: string }>;
db.close();

let persona: { grantId: string; email: string; name: string; prompt: string; temp: number };
const buyer = grants.find(g => g.mailbox_type === 'buyer_inbox');
const supplier = grants.find(g => g.mailbox_type === 'other');

if (personaId === 'buyer' && buyer) {
  persona = { grantId: buyer.grant_id, email: buyer.email, name: 'Tifa Lockhart', prompt: BUYER_PROMPT, temp: 0.5 };
} else if (personaId === 'cloud' && supplier) {
  persona = { grantId: supplier.grant_id, email: supplier.email, name: 'Cloud Strife (Supplier)', prompt: SUPPLIER_PROMPT, temp: 0.7 };
} else {
  console.error(`Unknown or unconfigured persona: "${personaId}".`);
  process.exit(1);
}

// ── Agent setup ──────────────────────────────────────────────────

const apiKey = process.env.ANTHROPIC_API_KEY || '';
const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
const model = 'deepseek-v4-flash';
const DRY_RUN = process.env.DRY_RUN === '1';
const BASE_POLL_SECONDS = parseInt(process.env.AGENT_POLL_SECONDS || '20', 10);
let currentPollSeconds = BASE_POLL_SECONDS;
const MAX_POLL_SECONDS = 60;
const processedIds = new Set<string>();
let autoCount = 0, ignoreCount = 0, draftCount = 0;

const nylas = createNylasClient();
const draftStore = createMemoryDraftStore();
const agent = createAgent({
  nylasClient: DRY_RUN ? undefined : nylas,
  grantId: DRY_RUN ? undefined : persona.grantId,
  classifier: createLlmClassifier(apiKey, baseUrl, model),
  replyGenerator: createLlmReplyGenerator(apiKey, baseUrl, model, persona.prompt, persona.temp),
  draftStore,
  autoReplyAll: true,
});

console.log(`🤖 ${persona.name} daemon — ${persona.email} poll=${BASE_POLL_SECONDS}s temp=${persona.temp} ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

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
      console.log(`${icon} [${t}] ${(email.sender.name||email.sender.email).slice(0,20)} → "${email.subject.slice(0,60)}"`);
    }
    if (currentPollSeconds > BASE_POLL_SECONDS) currentPollSeconds = Math.max(BASE_POLL_SECONDS, currentPollSeconds - 5);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/429|rate limit|activity limit|too many|throttl/i.test(msg)) {
      currentPollSeconds = Math.min(MAX_POLL_SECONDS, currentPollSeconds + 10);
      console.warn(`  ⏳ Rate limited — slowing to ${currentPollSeconds}s`);
    } else if (!msg.includes('timeout')) {
      console.error('  ⚠', msg);
    }
  }
  clearTimeout(timer);
  timer = setTimeout(tick, currentPollSeconds * 1000);
}

let timer = setTimeout(tick, 1000);

// ── Proactive mode ────────────────────────────────────────────────
// Tifa(buyer) → Cloud: PO emails + PDF attachments
// Cloud(supplier) → Tifa: irrelevant emails (spam, wrong person, marketing)

const PROACTIVE_INTERVAL = parseInt(process.env.PROACTIVE_INTERVAL || '0', 10);
const PROACTIVE_MAX = parseInt(process.env.PROACTIVE_MAX || '0', 10);

if (PROACTIVE_INTERVAL > 0) {
  const isBuyer = personaId === 'buyer';
  const targetInfo = isBuyer
    ? grants.find(g => g.mailbox_type === 'other')      // Tifa sends to Cloud
    : grants.find(g => g.mailbox_type === 'buyer_inbox');  // Cloud sends to Tifa

  if (!targetInfo) {
    console.error('PROACTIVE: no target grant found.');
  } else {
    const topics: Array<{ subject: string; weight: number }> = isBuyer ? [
      { subject: 'Purchase Order ${po} — ${product}', weight: 20 },
      { subject: 'URGENT: Missing Shipment — PO ${po}', weight: 10 },
      { subject: 'Re: PO ${po} — Delivery Delay, Need Revised ETA', weight: 10 },
    ] : [
      { subject: '🔥 ONE-TIME OFFER — 50% Off Industrial Parts!!!', weight: 10 },
      { subject: 'Reminder: Annual HR Compliance Training Due', weight: 10 },
      { subject: 'Is this the Accounting Department?', weight: 10 },
      { subject: 'New Product Line — Spring 2026 Catalog Now Available', weight: 10 },
      { subject: 'Re: Your LinkedIn Profile Was Viewed 12 Times This Week', weight: 10 },
      { subject: 'Fwd: Need Volunteers for the Company Picnic', weight: 10 },
      { subject: 'Office Supplies Order — Please Approve Stationery Request', weight: 10 },
      { subject: 'YOU WON! Claim Your Free Industrial Tools Bundle', weight: 10 },
    ];

    const totalWeight = topics.reduce((s, t) => s + t.weight, 0);
    const suppliers = [
      { name: 'Sarah', company: 'Acme Industrial Supply', personality: 'efficient and friendly' },
      { name: 'Cloud Strife', company: 'Nibelheim Precision Parts', personality: 'detail-oriented and formal' },
      { name: 'Marco', company: 'Zenith Parts Co.', personality: 'casual and salesy' },
      { name: 'Ray', company: 'Midgar Component Supply', personality: 'terse and technical' },
    ];

    let proactiveTimer: ReturnType<typeof setInterval>;
    let proactiveSent = 0;
    function r(n: number) { return Math.floor(Math.random() * n); }

    async function proactiveSend() {
      if (PROACTIVE_MAX > 0 && proactiveSent >= PROACTIVE_MAX) { clearInterval(proactiveTimer); return; }
      proactiveSent++;
      const topic = topics[r(topics.length)]; // uniform random pick
      const sup = suppliers[r(suppliers.length)];
      const po = `PO-2026-${String(r(9000)+1000)}`;
      const eta = new Date(Date.now()+(r(14)+1)*86400000).toLocaleDateString('en-US',{month:'short',day:'numeric'});
      const qty = [100,200,300,500,750][r(5)];
      const products = ['Precision Bearings ABEC-7','6205-2RS Ball Bearings','Ceramic Hybrid Bearings','Tapered Roller Bearings'];
      const product = products[r(products.length)];
      const vars: Record<string,string> = { po, eta, qty: String(qty), product };
      const subject = topic.subject.replace(/\$\{(\w+)\}/g, (_,k) => vars[k]??'');

      // Buyer PO emails get PDF attachments
      let attachments: Array<{filename:string;contentType:string;content:Buffer}> = [];
      if (isBuyer && !DRY_RUN) {
        const pdfText = `PURCHASE ORDER\nPO: ${po}\nProduct: ${product}\nQty: ${qty} units\nETA: ${eta}`;
        attachments = [{filename:`${po}.pdf`,contentType:'application/pdf',content:Buffer.from(pdfText,'utf-8')}];
      }

      const bodyPrompt = isBuyer
        ? `You are Tifa Lockhart, procurement manager at Shinra Manufacturing. Send a PO email to ${sup.name} at ${sup.company}. Subject: "${subject}". Reference PO number, quantity, product. Mention a PDF is attached. Be professional. Return ONLY the body text.`
        : `Write a ONE-SENTENCE email. Subject: "${subject}". Make it sound real — like a marketing email, HR announcement, or misdirected question. Don't address Tifa by name. Return ONLY the body text.`;

      let body: string;
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const c = new Anthropic({ apiKey, baseURL: baseUrl });
        const resp = await c.messages.create({model,max_tokens:200,temperature:0.9,messages:[{role:'user',content:bodyPrompt}]});
        const tb = resp.content.find((b:any)=>b.type==='text')??resp.content[0];
        body = (tb as any).text?.trim() || subject;
      } catch { body = subject; }

      if (DRY_RUN) {
        console.log(`📤 [DRY RUN] ${persona.name} → "${subject.slice(0,50)}"${attachments.length?' +PDF':''}`);
      } else {
        try {
          const r = await nylas.sendMessage(persona.grantId, targetInfo!.email, subject, body, attachments);
          console.log(`📤 [pro] ${persona.name} → ${subject.slice(0,50)} (${r.messageId.slice(0,12)}...)`);
        } catch(e:any){
          if(/429|rate limit|activity limit|too many|throttl/i.test(e?.message||'')) console.warn('  ⏳ Proactive rate limited');
          else console.error('  ⚠ proactive:',e?.message);
        }
      }
    }

    console.log(`📤 Proactive: ${persona.name} → ${targetInfo.email} every ${PROACTIVE_INTERVAL}s (max ${PROACTIVE_MAX})\n`);
    proactiveSend();
    proactiveTimer = setInterval(proactiveSend, PROACTIVE_INTERVAL * 1000);
  }
}
