import type { Scenario } from '../types';

export const scenario: Scenario = {
  id: 'buyer-inbox',
  name: "Buyer's Inbox — 20 diverse threads (10/20/70 mix)",
  description:
    'Initial emails only — agents handle all replies. ' +
    '10% PO acknowledge, 20% PO exception, 70% irrelevant (spam, HR, wrong person, etc.).',
  initialContext: {
    primary_name: 'Tifa',
    cloud_name: 'Cloud',
    primary_email: '',
    cloud_email: '',
  },
  steps: [
    // ── 10% — PO Acknowledge (2 emails) ──────────────────────
    {
      senderId: 'cloud',
      senderName: 'Nibelheim Parts',
      subjectTemplate: 'PO #1234 confirmed — ETA Friday',
      bodyTemplate: '<p>Hi Tifa,</p><p>PO #1234 for the 6205 bearings is confirmed. All 300 units are in stock and will ship Friday. Tracking to follow.</p><p>— Marco</p>',
      delaySeconds: 0,
    },
    {
      senderId: 'cloud',
      senderName: 'Midgar Supply Co.',
      subjectTemplate: 'Order #5678 received, shipping tomorrow',
      bodyTemplate: '<p>Tifa,</p><p>Just confirming Order #5678 for the hydraulic fittings. Packing now, FedEx pickup tomorrow morning. You should have it by Thursday.</p><p>— Sarah</p>',
      delaySeconds: 2,
    },

    // ── 20% — PO Exception (4 emails) ─────────────────────────
    {
      senderId: 'cloud',
      senderName: 'Nibelheim Parts',
      subjectTemplate: 'URGENT: shipment delayed — PO #8891',
      bodyTemplate: '<p>Tifa,</p><p>Bad news — the CNC machine went down yesterday and we lost two days of production on PO #8891. We\'re about 200 units short. Best case: partial shipment Friday, remainder Tuesday. I know your Midgar line depends on this — calling you now.</p><p>— Marco, Nibelheim</p>',
      delaySeconds: 3,
    },
    {
      senderId: 'cloud',
      senderName: 'Core Components Ltd',
      subjectTemplate: 'QC failed for batch #442 — rework needed',
      bodyTemplate: '<p>Hi Tifa,</p><p>QC flagged batch #442 (500 bearing housings) — surface finish is out of spec on about 30% of the units. We can either: (a) ship the good 350 now with the rest following in 5 days after rework, or (b) hold the whole batch and ship complete in 7 days. Which works better for your line schedule?</p><p>— Rudeus, QC Lead</p>',
      delaySeconds: 4,
    },
    {
      senderId: 'cloud',
      senderName: 'Accounts @ Midgar Supply',
      subjectTemplate: 'Pricing discrepancy on invoice #6672',
      bodyTemplate: '<p>Tifa,</p><p>I was going through invoice #6672 and noticed the unit price for the flange bearings is $12.40, but our contract from March shows $11.80. It\'s a $1,800 difference across the order. Can you pull up the agreement and confirm which is correct before I process payment?</p><p>— Rita, AP</p>',
      delaySeconds: 5,
    },
    {
      senderId: 'cloud',
      senderName: 'Nibelheim Parts',
      subjectTemplate: 'Wrong quantity received — ordered 500, got 300',
      bodyTemplate: '<p>Tifa,</p><p>PO #9901 just arrived. The packing slip says 500 units but we only counted 300 in the boxes. I checked the pallet — two boxes are definitely missing. Can you check with your shipping team and let me know if the other 200 are still in transit?</p><p>— Marco</p>',
      delaySeconds: 6,
    },

    // ── 70% — Irrelevant (14 emails) ──────────────────────────
    {
      senderId: 'cloud',
      senderName: 'Facilities Department',
      subjectTemplate: 'Office closed Friday for electrical maintenance',
      bodyTemplate: '<p>All staff — the Midgar facility will be closed this Friday 8 AM–2 PM for scheduled electrical maintenance. No building access during this window. Plan accordingly.</p><p>— Facilities</p>',
      delaySeconds: 7,
    },
    {
      senderId: 'cloud',
      senderName: 'BEST BEARINGS LTD',
      subjectTemplate: '🔥 50% OFF ALL BEARINGS — ONE DAY ONLY',
      bodyTemplate: '<div style="background:#ff0;padding:10px;"><h2 style="color:red;">MASSIVE BEARING BLOWOUT</h2><p>ALL industrial bearings <strong>50% OFF</strong>! <a href="#">CLICK HERE</a> to claim your discount!</p></div>',
      delaySeconds: 8,
    },
    {
      senderId: 'cloud',
      senderName: 'New Intern',
      subjectTemplate: 'Is this Accounting??',
      bodyTemplate: "<p>Hi, I'm the new intern from Floor 3. Is this the Accounting dept? I need to submit my expense report for the team lunch. The directory is down and I'm totally lost 😅</p>",
      delaySeconds: 9,
    },
    {
      senderId: 'cloud',
      senderName: 'Nova Components',
      subjectTemplate: 'New Q3 catalog — can we schedule a call?',
      bodyTemplate: '<p>Hello Tifa,</p><p>We just launched our Q3 precision components catalog and I\'d love to walk you through the new ceramic bearing line. Are you free for a 20-minute call next Tuesday or Wednesday?</p><p>— Marco, Nova Components</p>',
      delaySeconds: 10,
    },
    {
      senderId: 'cloud',
      senderName: 'Jim @ Acme Parts',
      subjectTemplate: 'Need a quote for some parts',
      bodyTemplate: '<p>Hi,</p><p>I heard you source industrial components. I need some parts for a project. Can you send me your price list?</p><p>— Jim</p>',
      delaySeconds: 11,
    },
    {
      senderId: 'cloud',
      senderName: 'HR Department',
      subjectTemplate: 'Benefits enrollment deadline — July 15',
      bodyTemplate: '<p>All employees — open enrollment for health and dental benefits closes July 15. Please log into the portal and confirm your elections before the deadline. No exceptions.</p><p>— Human Resources</p>',
      delaySeconds: 12,
    },
    {
      senderId: 'cloud',
      senderName: 'Amazon Shipping',
      subjectTemplate: 'Your Amazon order #114-6789012 has shipped',
      bodyTemplate: '<p>Your package is on the way! Estimated delivery: Thursday. Track your shipment <a href="#">here</a>.</p><p>— Amazon</p>',
      delaySeconds: 13,
    },
    {
      senderId: 'cloud',
      senderName: 'Supply Chain Today',
      subjectTemplate: 'Join our webinar: AI in Procurement (free CPE)',
      bodyTemplate: '<p>Dear Procurement Professional,</p><p>Join 2,000+ peers for a live webinar on AI-driven supply chain optimization. Thursday at 2 PM ET. <a href="#">Register here</a> — 1 CPE credit.</p><p>— Supply Chain Today</p>',
      delaySeconds: 14,
    },
    {
      senderId: 'cloud',
      senderName: 'Office Manager',
      subjectTemplate: 'Fwd: team lunch next Thursday at 12:30',
      bodyTemplate: '<p>Hey everyone — we\'re doing a team lunch at the Italian place on 4th next Thursday. Let me know if you can make it by Tuesday so I can reserve.</p><p>— Jen</p>',
      delaySeconds: 15,
    },
    {
      senderId: 'cloud',
      senderName: 'Charity Run Committee',
      subjectTemplate: 'Can you donate to our charity 5K run?',
      bodyTemplate: '<p>Hello!</p><p>We\'re raising money for the Midgar Children\'s Hospital with a charity 5K run on July 22. Any donation helps — even $10! <a href="#">Click here</a> to sponsor our team.</p><p>— Community Outreach</p>',
      delaySeconds: 16,
    },
    {
      senderId: 'cloud',
      senderName: 'HR Department',
      subjectTemplate: 'Reminder: performance reviews due Friday',
      bodyTemplate: '<p>Managers — annual performance reviews and self-evaluations are due this Friday by 5 PM. Please submit via the HR portal. Late submissions will delay compensation adjustments.</p><p>— HR</p>',
      delaySeconds: 17,
    },
    {
      senderId: 'cloud',
      senderName: 'Procurement Today',
      subjectTemplate: 'Exclusive offer for procurement managers',
      bodyTemplate: '<p>Dear Procurement Manager,</p><p>As a valued industry professional, you qualify for an <strong>exclusive</strong> subscription to Procurement Today magazine — normally $199/year, <strong>yours for $29.99</strong>. <a href="#">Activate now</a>!</p><p>— Procurement Today</p>',
      delaySeconds: 18,
    },
    {
      senderId: 'cloud',
      senderName: 'Supplier Diversity Program',
      subjectTemplate: 'Meeting request: supplier diversity initiative',
      bodyTemplate: '<p>Dear Ms. Lockhart,</p><p>I\'m reaching out from the National Supplier Diversity Council. We\'re launching an initiative to connect women-owned manufacturing businesses with procurement leaders. Would you be available for a 15-minute exploratory call?</p><p>— Dr. Anita Reyes</p>',
      delaySeconds: 19,
    },
    {
      senderId: 'cloud',
      senderName: 'Customer Service @ NPT',
      subjectTemplate: 'Lost package — tracking says delivered but nothing arrived',
      bodyTemplate: '<p>Hello,</p><p>Tracking number 1Z999AA10123456784 shows delivered to your dock on July 1 at 10:32 AM, but we have no record of receiving it. Can you check with your receiving team and confirm the delivery photo?</p><p>— NPT Customer Service</p>',
      delaySeconds: 20,
    },
  ],
};
