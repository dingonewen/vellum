import type { Scenario } from '../types';

const poNum = `PO-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
const trackingNum = `1Z${Math.random().toString(36).slice(2, 18).toUpperCase()}`;

export const scenario: Scenario = {
  id: 'clean-po',
  name: 'Clean PO — Supplier Acknowledgement (3 steps)',
  description:
    'Cloud (supplier) acknowledges Tifa\'s PO, provides ETA, and confirms shipment. ' +
    'Tifa (buyer) replies with brief confirmations. No exceptions, no friction — ' +
    'a clean, ideal transaction thread.',
  initialContext: {
    primary_name: 'Tifa',
    cloud_name: 'Cloud',
    primary_email: '',
    cloud_email: '',
    po_number: poNum,
    original_subject: `Purchase Order ${poNum} — Precision Bearings ABEC-7 Grade`,
    product_desc: 'Precision Ball Bearings — ABEC-7 Grade, 6205-2RS',
    quantity: '300',
    unit_price: '$22.00',
    total_amount: '$6,600.00',
    delivery_days: '5 business days',
    eta_date: 'July 10, 2026',
    tracking_number: trackingNum,
  },
  steps: [
    // ── Step 0: Cloud sends PO acknowledgement (new thread) ─────
    {
      senderId: 'cloud',
      subjectTemplate: 'Purchase Order ${po_number} — Confirmed, ETA ${eta_date}',
      bodyTemplate:
        '<p>Dear ${primary_name},</p>\n' +
        '<p>Purchase Order <strong>${po_number}</strong> received — everything looks good.</p>\n' +
        '<p>Order summary:</p>\n' +
        '<ul>\n' +
        '  <li><strong>${quantity} units</strong> of ${product_desc}</li>\n' +
        '  <li>Unit price: ${unit_price}</li>\n' +
        '  <li>Total: ${total_amount}</li>\n' +
        '  <li>Delivery: ${delivery_days} — ETA <strong>${eta_date}</strong></li>\n' +
        '</ul>\n' +
        '<p>We have stock on hand, so no production lead time needed. I\'ll send tracking once the shipment goes out.</p>\n' +
        '<p>Let me know if you need anything else before then.</p>\n' +
        '<p>Best,<br/><strong>${cloud_name}</strong><br/>Nibelheim Precision Parts</p>',
      delaySeconds: 0,
    },

    // ── Step 1: Tifa acknowledges ──────────────────────────────
    {
      senderId: 'primary',
      replyToStepIndex: 0,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>${cloud_name},</p>\n' +
        '<p>Great, thanks for the quick confirmation. ${eta_date} works for our production schedule.</p>\n' +
        '<p>Please send tracking when available.</p>\n' +
        '<p>${primary_name}</p>',
      delaySeconds: { min: 30, max: 60 },
    },

    // ── Step 2: Cloud ships ────────────────────────────────────
    {
      senderId: 'cloud',
      replyToStepIndex: 1,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>Dear ${primary_name},</p>\n' +
        '<p>Your order shipped this morning.</p>\n' +
        '<p>\n' +
        '  <strong>Tracking:</strong> <a href="https://www.fedex.com/fedextrack/?trknbr=${tracking_number}">${tracking_number}</a><br/>\n' +
        '  <strong>ETA:</strong> ${eta_date}\n' +
        '</p>\n' +
        '<p>All ${quantity} units passed final QC. Let me know when they arrive safely.</p>\n' +
        '<p>Best,<br/><strong>${cloud_name}</strong></p>',
      delaySeconds: { min: 120, max: 240 },
    },
  ],
};
