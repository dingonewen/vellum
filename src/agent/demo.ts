/**
 * Dual-agent demo — Tifa + Cloud daemons exchange email autonomously.
 *
 * The demo directly seeds Tifa's inbox with ~20 initial emails from diverse
 * personas (suppliers, spam, HR, wrong-person, etc.), then the two daemons
 * process and reply to each other, creating multi-turn threaded conversations.
 *
 * No sandbox scripts — pure agent-to-agent email exchange through Nylas.
 *
 * Usage:
 *   npm run demo
 *   npx tsx src/agent/demo.ts
 */

import { createNylasClient } from '../nylas/nylasClient';
import { PERSONAS } from './personas';
import { startDaemon } from './daemon-runner';
import { resolveGrant } from './db';

const POLL_SECONDS = 3;

// ── Diverse initial emails (sent FROM Cloud's grant TO Tifa's inbox) ──

interface SeedEmail {
  senderName: string;
  subject: string;
  body: string;
}

const SEED_EMAILS: SeedEmail[] = [
  // ── 6 PO / business emails (→ auto_reply) ─────────────────────────
  {
    senderName: 'Nibelheim Parts',
    subject: 'PO #1234 confirmed — ETA Friday',
    body: '<p>Hi Tifa,</p><p>PO #1234 for the 6205 bearings is confirmed. All 300 units in stock, shipping Friday. Tracking to follow.</p><p>— Marco</p>',
  },
  {
    senderName: 'Midgar Supply Co.',
    subject: 'Order #5678 received, shipping tomorrow',
    body: '<p>Tifa,</p><p>Confirming Order #5678 for the hydraulic fittings. Packing now, FedEx pickup tomorrow morning. ETA Thursday.</p><p>— Sarah</p>',
  },
  {
    senderName: 'Core Components Ltd',
    subject: 'QC failed for batch #442 — rework needed',
    body: '<p>Hi Tifa,</p><p>QC flagged batch #442 (500 bearing housings) — surface finish out of spec on ~30%. Options: (a) ship the good 350 now, rest in 5 days, or (b) hold and ship complete in 7 days. Which works for your line?</p><p>— Rudeus, QC Lead</p>',
  },
  {
    senderName: 'Accounts @ Midgar Supply',
    subject: 'Pricing discrepancy on invoice #6672',
    body: '<p>Tifa,</p><p>Invoice #6672 shows unit price $12.40, but our March contract has $11.80. That\'s a $1,800 difference. Can you confirm which is correct before I process payment?</p><p>— Rita, AP</p>',
  },
  {
    senderName: 'Nibelheim Parts',
    subject: 'Wrong quantity received — ordered 500, got 300',
    body: '<p>Tifa,</p><p>PO #9901 arrived. Packing slip says 500 but we only counted 300. Two boxes missing. Can you check with your shipping team?</p><p>— Marco</p>',
  },
  {
    senderName: 'Nova Components',
    subject: 'New Q3 catalog — can we schedule a call?',
    body: '<p>Hello Tifa,</p><p>We just launched our Q3 precision components catalog and I\'d love to walk you through the new ceramic bearing line. Free for a 20-min call next Tuesday or Wednesday?</p><p>— Marco, Nova Components</p>',
  },

  // ── 4 urgent / exception emails (→ auto_reply, multi-turn) ────────
  {
    senderName: 'Nibelheim Parts',
    subject: 'URGENT: shipment delayed — PO #8891',
    body: '<p>Tifa,</p><p>Bad news — our CNC machine went down and we lost two days on PO #8891. About 200 units short. Best case: partial shipment Friday, remainder Tuesday. Your Midgar line depends on this — I\'m calling you now.</p><p>— Marco, Nibelheim</p>',
  },
  {
    senderName: 'Core Components Ltd',
    subject: 'Material shortage — can we substitute grade?',
    body: '<p>Tifa,</p><p>The ABEC-7 steel we ordered for your batch is backordered 4 weeks. We can substitute ABEC-5 (in stock, same dimensions, slightly wider tolerance) and ship in 3 days, or wait for ABEC-7. Your call — I need an answer today to hold the production slot.</p><p>— Rudeus</p>',
  },
  {
    senderName: 'Customer Service @ NPT',
    subject: 'Lost package — tracking says delivered but nothing arrived',
    body: '<p>Hello,</p><p>Tracking 1Z999AA10123456784 shows delivered to your dock July 1 at 10:32 AM, but we have no record of receiving it. Can you check with receiving and confirm the delivery photo?</p><p>— NPT Customer Service</p>',
  },
  {
    senderName: 'Midgar Supply Co.',
    subject: 'Contract renewal — prices going up Q3',
    body: '<p>Tifa,</p><p>Our raw material costs are up 12% this quarter. For the Q3 contract renewal, we\'re looking at about an 8% price adjustment on the bearing line. I want to give you a heads-up before the formal quote goes out. Can we discuss next week?</p><p>— Sarah</p>',
  },

  // ── 6 irrelevant / noise emails (→ ignore or draft) ───────────────
  {
    senderName: 'Facilities Department',
    subject: 'Office closed Friday for electrical maintenance',
    body: '<p>All staff — the Midgar facility will be closed this Friday 8 AM–2 PM for scheduled electrical maintenance. No building access during this window.</p><p>— Facilities</p>',
  },
  {
    senderName: 'BEST BEARINGS LTD',
    subject: '🔥 50% OFF ALL BEARINGS — ONE DAY ONLY',
    body: '<div style="background:#ff0;padding:10px;"><h2 style="color:red;">MASSIVE BEARING BLOWOUT</h2><p>ALL industrial bearings <strong>50% OFF</strong>! <a href="#">CLICK HERE</a>!</p></div>',
  },
  {
    senderName: 'New Intern',
    subject: 'Is this Accounting??',
    body: '<p>Hi, I\'m the new intern from Floor 3. Is this the Accounting dept? I need to submit my expense report. The directory is down and I\'m totally lost 😅</p>',
  },
  {
    senderName: 'HR Department',
    subject: 'Benefits enrollment deadline — July 15',
    body: '<p>All employees — open enrollment for health and dental benefits closes July 15. Please log into the portal and confirm your elections. No exceptions.</p><p>— Human Resources</p>',
  },
  {
    senderName: 'Supply Chain Today',
    subject: 'Join our webinar: AI in Procurement (free CPE)',
    body: '<p>Dear Procurement Professional,</p><p>Join 2,000+ peers for a live webinar on AI-driven supply chain optimization. Thursday at 2 PM ET. <a href="#">Register here</a> — 1 CPE credit.</p>',
  },
  {
    senderName: 'Jim @ Acme Parts',
    subject: 'Need a quote for some parts',
    body: '<p>Hi,</p><p>I heard you source industrial components. I need some parts for a project. Can you send me your price list?</p><p>— Jim</p>',
  },

  // ── 4 edge-case emails (→ draft_for_manager or redirect) ──────────
  {
    senderName: 'Supplier Diversity Program',
    subject: 'Meeting request: supplier diversity initiative',
    body: '<p>Dear Ms. Lockhart,</p><p>I\'m reaching out from the National Supplier Diversity Council. We\'re launching an initiative to connect women-owned manufacturing businesses with procurement leaders. Would you be available for a 15-minute exploratory call?</p><p>— Dr. Anita Reyes</p>',
  },
  {
    senderName: 'Legal Department',
    subject: 'Contract review: Nibelheim Parts Q3 agreement',
    body: '<p>Tifa,</p><p>Please review the attached Nibelheim Parts Q3 supply agreement. Section 4.3 has new liability language that needs your sign-off before we execute. The indemnification clause is broader than our standard terms — I\'d like your procurement perspective before we push back.</p><p>— Legal</p>',
  },
  {
    senderName: 'HR Department',
    subject: 'Reminder: performance reviews due Friday',
    body: '<p>Managers — annual performance reviews and self-evaluations are due this Friday by 5 PM. Please submit via the HR portal. Late submissions will delay compensation adjustments.</p><p>— HR</p>',
  },
  {
    senderName: 'Charity Run Committee',
    subject: 'Can you donate to our charity 5K run?',
    body: '<p>Hello!</p><p>We\'re raising money for the Midgar Children\'s Hospital with a charity 5K run on July 22. Any donation helps — even $10! <a href="#">Click here</a> to sponsor our team.</p><p>— Community Outreach</p>',
  },
];

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  // Resolve grants
  const tifaGrant = resolveGrant('buyer_inbox');
  const cloudGrant = resolveGrant('other');

  if (!tifaGrant) {
    console.error('No buyer_inbox configured. Set one via http://localhost:3000');
    process.exit(1);
  }
  if (!cloudGrant) {
    console.error('No "other" (Cloud) grant configured. Set one via http://localhost:3000');
    process.exit(1);
  }

  const nylas = createNylasClient();

  console.log('🚀 Starting dual-agent demo\n');
  console.log(`   Tifa:  ${tifaGrant.email} (watched by Tifa daemon)`);
  console.log(`   Cloud: ${cloudGrant.email} (watched by Cloud daemon)\n`);

  // ── Seed Tifa's inbox with initial emails ─────────────────────────

  console.log(`📧 Seeding ${SEED_EMAILS.length} initial emails into Tifa's inbox...\n`);

  for (let i = 0; i < SEED_EMAILS.length; i++) {
    const { senderName, subject, body } = SEED_EMAILS[i];
    const label = `[${i + 1}/${SEED_EMAILS.length}]`;
    try {
      await nylas.sendMessage(
        cloudGrant.grant_id,
        tifaGrant.email,
        subject,
        body,
      );
      console.log(`${label} SENT: "${subject}" (${senderName})`);
    } catch (err) {
      console.error(`${label} FAIL: "${subject}" — ${(err as Error).message}`);
    }
    // Small gap between sends to avoid rate limiting
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n✅ ${SEED_EMAILS.length} emails seeded.\n`);

  // ── Start daemons — they process what's in the inbox ──────────────

  console.log('🤖 Starting agent daemons...\n');

  startDaemon({ persona: PERSONAS.tifa, pollSeconds: POLL_SECONDS });
  startDaemon({ persona: PERSONAS.cloud, pollSeconds: POLL_SECONDS });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Agents are now processing emails.');
  console.log('  Watch for ✅ auto-reply, 🗑️ ignore, 📝 draft in the log above.');
  console.log('  Tifa ↔ Cloud multi-turn threads will emerge as they reply.');
  console.log('  Ctrl+C to stop.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ── Graceful shutdown ─────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

main().catch((err) => {
  console.error('Demo failed:', err.message);
  process.exit(1);
});
