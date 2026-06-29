import type { Scenario } from '../types';

const poNum = `PO-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
const trackingNum = `1Z${Math.random().toString(36).slice(2, 18).toUpperCase()}`;

export const scenario: Scenario = {
  id: 'po-processing',
  name: 'PO Processing — Urgent Bearing Order (14 steps)',
  description:
    'Tifa (procurement manager) sends a PO for precision bearings to Cloud (supplier). ' +
    'Production delays, QC failures, and escalating urgency drive a 14-email thread across two weeks.',
  initialContext: {
    buyer_name: 'Tifa',
    seller_name: 'Cloud',
    buyer_email: '',
    seller_email: '',
    po_number: poNum,
    original_subject: `Purchase Order ${poNum} — Precision Ball Bearings — ABEC-7 Grade, 6205-2RS`,
    product_desc: 'Precision Ball Bearings — ABEC-7 Grade, 6205-2RS',
    quantity: '500',
    unit_price: '$18.50',
    total_amount: '$9,250.00',
    delivery_days: '10 business days',
    deadline_date: 'July 14, 2026',
    new_deadline: 'July 17, 2026',
    tracking_number: trackingNum,
    discount_offer: '5%',
  },
  steps: [
    // ── Step 0: Tifa sends PO with PDF attachment ─────────────────
    {
      senderId: 'seller',
      subjectTemplate: 'Purchase Order ${po_number} — ${product_desc}',
      bodyTemplate:
        '<p>Dear ${seller_name},</p>\n' +
        '<p>Please find attached Purchase Order <strong>${po_number}</strong> for the following:</p>\n' +
        '<table style="width:100%;max-width:500px;border-collapse:collapse;">\n' +
        '  <tr style="background:#f5f5f5;">\n' +
        '    <td style="padding:8px;border:1px solid #ddd;"><strong>Item</strong></td>\n' +
        '    <td style="padding:8px;border:1px solid #ddd;"><strong>Qty</strong></td>\n' +
        '    <td style="padding:8px;border:1px solid #ddd;"><strong>Unit Price</strong></td>\n' +
        '    <td style="padding:8px;border:1px solid #ddd;"><strong>Total</strong></td>\n' +
        '  </tr>\n' +
        '  <tr>\n' +
        '    <td style="padding:8px;border:1px solid #ddd;">${product_desc}</td>\n' +
        '    <td style="padding:8px;border:1px solid #ddd;">${quantity} units</td>\n' +
        '    <td style="padding:8px;border:1px solid #ddd;">${unit_price}</td>\n' +
        '    <td style="padding:8px;border:1px solid #ddd;">${total_amount}</td>\n' +
        '  </tr>\n' +
        '</table>\n' +
        '<p><strong>Delivery required within ${delivery_days}.</strong> Our production line at the Midgar facility depends on these bearings arriving by <strong>${deadline_date}</strong>. Any delay will cause a line stoppage — we cannot hold inventory beyond that date.</p>\n' +
        '<p>Please confirm receipt and acknowledge the delivery timeline. A signed copy of the PO is attached as a PDF for your records.</p>\n' +
        '<p>Regards,<br/><strong>${buyer_name}</strong><br/>Procurement Manager<br/>Shinra Manufacturing</p>',
      delaySeconds: 0,
      variables: { buyer_name: 'Tifa', seller_name: 'Cloud' },
      attachments: [
        {
          filename: '${po_number}.pdf',
          contentType: 'application/pdf',
          bodyTemplate:
            'PURCHASE ORDER\n' +
            '═══════════════════════════════════════\n' +
            '\n' +
            'PO Number:    ${po_number}\n' +
            'Date:         July 1, 2026\n' +
            'Vendor:       Nibelheim Precision Parts\n' +
            'Buyer:        Shinra Manufacturing\n' +
            '\n' +
            '───────────────────────────────────────\n' +
            'LINE ITEMS\n' +
            '───────────────────────────────────────\n' +
            '\n' +
            'Item:         ${product_desc}\n' +
            'Quantity:     ${quantity} units\n' +
            'Unit Price:   ${unit_price}\n' +
            'Total:        ${total_amount}\n' +
            '\n' +
            '───────────────────────────────────────\n' +
            'TERMS\n' +
            '───────────────────────────────────────\n' +
            '\n' +
            'Delivery:     ${delivery_days}\n' +
            'Deadline:     ${deadline_date}\n' +
            'Payment:      Net 30\n' +
            'Incoterms:    FOB Destination\n' +
            '\n' +
            '═══════════════════════════════════════\n' +
            'Authorized by: Tifa Lockhart\n' +
            '               Procurement Manager\n' +
            '               Shinra Manufacturing\n',
        },
      ],
    },

    // ── Step 1: Cloud confirms ──────────────────────────────────
    {
      senderId: 'buyer',
      replyToStepIndex: 0,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>Dear ${buyer_name},</p>\n' +
        '<p>Thank you for the order! Purchase Order <strong>${po_number}</strong> has been received and entered into our system.</p>\n' +
        '<p>I\'ve reviewed the specs and confirmed availability with our production team. <strong>${quantity} units of ${product_desc}</strong> will be ready to ship by <strong>${deadline_date}</strong>. We have the raw material on hand and can begin production immediately.</p>\n' +
        '<p>A quick note — our standard QC protocol for ABEC-7 bearings includes individual runout testing, which adds about two days to the production cycle. This is already factored into the ${delivery_days} timeline I\'m confirming.</p>\n' +
        '<p>I\'ll send you a production schedule once we break ground. If anything changes on your end (specs, quantities, shipping address), please let me know right away.</p>\n' +
        '<p>Best regards,<br/><strong>${seller_name}</strong><br/>Sales Representative<br/>Nibelheim Precision Parts</p>',
      delaySeconds: { min: 300, max: 600 },
    },

    // ── Step 2: Tifa requests production update ────────────────
    {
      senderId: 'seller',
      replyToStepIndex: 1,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>${seller_name},</p>\n' +
        '<p>Glad to hear everything is on track. Please send the production schedule when you have it — I need to update our MRP system with firm dates.</p>\n' +
        '<p>Also, please flag any QC findings during production rather than waiting until final inspection. Last time we had an issue with a batch from another vendor, we only found out on the ship date, which gave us zero time to adjust our line schedule. I\'d rather know about problems early.</p>\n' +
        '<p>${buyer_name}</p>',
      delaySeconds: { min: 30, max: 60 },
    },

    // ── Step 3: Cloud sends production schedule ─────────────────
    {
      senderId: 'buyer',
      replyToStepIndex: 2,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>${buyer_name},</p>\n' +
        '<p>Here\'s the production timeline for ${po_number}:</p>\n' +
        '<ul>\n' +
        '  <li><strong>July 1–3:</strong> Material prep &amp; forging</li>\n' +
        '  <li><strong>July 4–7:</strong> Grinding &amp; honing (raceways &amp; balls)</li>\n' +
        '  <li><strong>July 8–9:</strong> Assembly &amp; initial QC</li>\n' +
        '  <li><strong>July 10–11:</strong> ABEC-7 runout testing (individual)</li>\n' +
        '  <li><strong>July 12–13:</strong> Final inspection, packaging, label prep</li>\n' +
        '  <li><strong>July 14:</strong> Ship via FedEx Priority</li>\n' +
        '</ul>\n' +
        '<p>I\'ve flagged your account for early QC notification as you requested. If any batch fails runout testing, I\'ll let you know immediately — not at the end of the line.</p>\n' +
        '<p>So far everything is proceeding normally. Our grinding department has been running ABEC-7 tolerance work all month, so they\'re well dialed in.</p>\n' +
        '<p>Best,<br/>${seller_name}</p>',
      delaySeconds: { min: 300, max: 600 },
    },

    // ── Step 4: Tifa mid-point check-in (5 days later) ──────────
    {
      senderId: 'seller',
      replyToStepIndex: 3,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>${seller_name},</p>\n' +
        '<p>Checking in at the mid-point. Our production planning meeting is tomorrow and I need to confirm that the ${deadline_date} ship date is still firm.</p>\n' +
        '<p>Any issues so far? Grinding department still on track?</p>\n' +
        '<p>${buyer_name}</p>',
      delaySeconds: 0,
    },

    // ── Step 5: Cloud reassures — everything fine ───────────────
    {
      senderId: 'buyer',
      replyToStepIndex: 4,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>${buyer_name},</p>\n' +
        '<p>All good here. Grinding and honing are complete — the raceways are measuring within 0.5 micron tolerance, which is well within ABEC-7 spec. Assembly starts tomorrow as scheduled.</p>\n' +
        '<p>Your order has been a smooth run so far. I see no reason we won\'t hit the ${deadline_date} ship date.</p>\n' +
        '<p>I\'ll update you after the first round of runout testing on the 10th.</p>\n' +
        '<p>Best,<br/>${seller_name}</p>',
      delaySeconds: { min: 300, max: 600 },
    },

    // ── Step 6: Deadline day — Tifa wants tracking ─────────────
    {
      senderId: 'seller',
      replyToStepIndex: 5,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>${seller_name},</p>\n' +
        '<p>Today is <strong>${deadline_date}</strong> — the agreed ship date. I don\'t see a tracking number in our system yet.</p>\n' +
        '<p>Our Midgar line starts the changeover tomorrow morning. If those bearings aren\'t on a truck today, we have a <strong>14-hour production gap</strong> starting tomorrow at 8 AM. That\'s roughly <strong>$3,200 per hour</strong> in idle labor and overhead.</p>\n' +
        '<p>I need a tracking number in the next four hours, or I need to know what\'s going on so I can brief my plant manager before he walks into a crisis tomorrow morning.</p>\n' +
        '<p>${buyer_name}</p>',
      delaySeconds: 0,
    },

    // ── Step 7: Cloud — QC failure, delay ───────────────────────
    {
      senderId: 'buyer',
      replyToStepIndex: 6,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>${buyer_name},</p>\n' +
        '<p>I\'m going to be straight with you — we hit a problem.</p>\n' +
        '<p>Final runout testing flagged <strong>about 100 units</strong> from the last grinding batch. The raceway roundness was measuring at ABEC-5 tolerance, not ABEC-7. I made the call to reject the batch rather than ship sub-spec product and have you discover it on your receiving dock.</p>\n' +
        '<p>Here\'s where we are:</p>\n' +
        '<ul>\n' +
        '  <li><strong>400 units:</strong> Passed QC, boxed, and ready to go</li>\n' +
        '  <li><strong>100 units:</strong> Re-grinding in process — our best operator is on it</li>\n' +
        '</ul>\n' +
        '<p>I know this is the last thing you want to hear on ship day. I can offer:</p>\n' +
        '<ol>\n' +
        '  <li><strong>Partial shipment today:</strong> 400 units via FedEx overnight. You\'d have them tomorrow by 10:30 AM — enough to keep your line running while the remaining 100 finish.</li>\n' +
        '  <li><strong>Remaining 100:</strong> Ship in <strong>3 days</strong> (${new_deadline}). I\'ll personally cover the air freight for this shipment — overnight delivery at my cost.</li>\n' +
        '  <li><strong>Discount:</strong> ${discount_offer} off your next order for the trouble.</li>\n' +
        '</ol>\n' +
        '<p>I should have caught this trend during in-process inspection rather than waiting for final QC. That\'s on me, and I\'m sorry.</p>\n' +
        '<p>Please let me know if the partial shipment works for you. I can have it on a truck in two hours.</p>\n' +
        '<p>${seller_name}</p>',
      delaySeconds: { min: 300, max: 600 },
    },

    // ── Step 8: Tifa — angry, escalating ───────────────────────
    {
      senderId: 'seller',
      replyToStepIndex: 7,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>${seller_name},</p>\n' +
        '<p>I appreciate the honesty, but this should have been flagged during in-process inspection like I specifically asked for in my July 2 email. We\'re now reacting instead of planning.</p>\n' +
        '<p><strong>Send the 400 units today. Immediately.</strong> I\'ll get our receiving team ready for tomorrow morning.</p>\n' +
        '<p>For the remaining 100 — ${new_deadline} is your absolute last date. If they\'re not on a truck by end of day on the 17th, I will have to escalate this to our VP of Supply Chain and explore alternative suppliers for the next quarter. That\'s not a threat — it\'s our reality with the production schedule we\'re carrying.</p>\n' +
        '<p>I need daily updates on the re-grinding progress starting tomorrow. Not every other day — <strong>every day</strong>.</p>\n' +
        '<p>${buyer_name}</p>',
      delaySeconds: { min: 30, max: 60 },
    },

    // ── Step 9: Cloud — QC passed, shipping tomorrow ───────────
    {
      senderId: 'buyer',
      replyToStepIndex: 8,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>${buyer_name},</p>\n' +
        '<p>Good news — all 100 remaining units passed final runout testing this morning. Roundness measurements are back within ABEC-7 tolerance across the board. Full QC report is attached.</p>\n' +
        '<p>Summary of where we stand:</p>\n' +
        '<ul>\n' +
        '  <li>✅ <strong>400 units:</strong> Delivered via FedEx overnight (tracking sent separately)</li>\n' +
        '  <li>✅ <strong>100 units:</strong> Packaged, labeled, shipping tomorrow (${new_deadline})</li>\n' +
        '</ul>\n' +
        '<p>The re-grinding was done by our senior operator — he\'s been doing bearing work for 18 years and I pulled him off another job to make sure this got done right. Each of the 100 reworked units was individually tested, not batch sampled.</p>\n' +
        '<p>The air freight for the 100-unit shipment is on us — I\'ll send the tracking number as soon as the FedEx pickup scan registers tomorrow morning.</p>\n' +
        '<p>I understand this put you in a tough spot with your plant manager, and I don\'t take that lightly. The ${discount_offer} discount on your next order stands — I\'ve already noted it on your account.</p>\n' +
        '<p>Regards,<br/>${seller_name}</p>',
      delaySeconds: { min: 300, max: 600 },
      attachments: [
        {
          filename: 'QC_Report_${po_number}.pdf',
          contentType: 'application/pdf',
          bodyTemplate:
            'QUALITY CONTROL REPORT\n' +
            '═══════════════════════════════════════\n' +
            '\n' +
            'PO Number:      ${po_number}\n' +
            'Product:        ${product_desc}\n' +
            'Lot Number:     LOT-2026-07-1142-B\n' +
            'Test Date:      ${new_deadline}\n' +
            '\n' +
            '───────────────────────────────────────\n' +
            'TEST RESULTS\n' +
            '───────────────────────────────────────\n' +
            '\n' +
            'Test Standard:  ABEC-7 (ISO 492)\n' +
            'Sample Size:    100 units (100%)\n' +
            '\n' +
            'Bore Tolerance:     PASS  (≤ 8 µm)\n' +
            'Radial Runout:      PASS  (≤ 9 µm)\n' +
            'Raceway Roundness:  PASS  (≤ 1.0 µm)\n' +
            'Noise Level:        PASS  (≤ 32 dB)\n' +
            '\n' +
            '───────────────────────────────────────\n' +
            'DISPOSITION:   ACCEPT — Ship Complete\n' +
            'Inspector:     R. Tuesti, Sr. QC\n' +
            '═══════════════════════════════════════\n',
        },
      ],
    },

    // ── Step 10: Tifa — confirmed, send tracking ────────────────
    {
      senderId: 'seller',
      replyToStepIndex: 9,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>${seller_name},</p>\n' +
        '<p>QC report received and reviewed — thank you for the 100% inspection on the reworked units. That\'s the right call for tolerance-critical parts.</p>\n' +
        '<p>The 400 units arrived this morning and are already on the line. Our receiving inspector spot-checked 20 pieces and all measured within spec, so those are good.</p>\n' +
        '<p>Send the tracking number for the remaining 100 as soon as you have it tomorrow. I\'ll have receiving standing by.</p>\n' +
        '<p>${buyer_name}</p>',
      delaySeconds: { min: 30, max: 90 },
    },

    // ── Step 11: Cloud — shipped with tracking ─────────────────
    {
      senderId: 'buyer',
      replyToStepIndex: 10,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>${buyer_name},</p>\n' +
        '<p>The remaining 100 units are on their way. FedEx picked up 20 minutes ago.</p>\n' +
        '<p>\n' +
        '  <strong>Tracking:</strong> <a href="https://www.fedex.com/fedextrack/?trknbr=${tracking_number}">${tracking_number}</a><br/>\n' +
        '  <strong>Service:</strong> FedEx Priority Overnight (air freight, Nibelheim\'s account)<br/>\n' +
        '  <strong>ETA:</strong> Tomorrow by 10:30 AM\n' +
        '</p>\n' +
        '<p>Final delivery summary for ${po_number}:</p>\n' +
        '<ul>\n' +
        '  <li>Shipment 1: 400 units — Delivered July 15 ✅</li>\n' +
        '  <li>Shipment 2: 100 units — In transit, ETA July 18 by 10:30 AM</li>\n' +
        '</ul>\n' +
        '<p>Total order fulfilled: <strong>500 units of ${product_desc}</strong></p>\n' +
        '<p>${buyer_name}, I know this didn\'t go as smoothly as either of us wanted. I\'ve done a full review with our production manager to improve in-process QC flagging — your feedback about early notification was completely fair and we\'re making changes so this doesn\'t repeat.</p>\n' +
        '<p>If anything looks off when the second shipment arrives, call me directly. I\'ll make it right same-day.</p>\n' +
        '<p>Best,<br/>${seller_name}</p>',
      delaySeconds: { min: 300, max: 600 },
    },

    // ── Step 12: Tifa confirms receipt ─────────────────────────
    {
      senderId: 'seller',
      replyToStepIndex: 11,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>${seller_name},</p>\n' +
        '<p>Both shipments have arrived and passed receiving inspection. The full 500 units are now in inventory and feeding the production line.</p>\n' +
        '<p>Final assessment: the product quality is good — our inspector noted the reworked units actually measured cleaner than the first batch. Your senior operator did solid work. The delay was painful, but the quality wasn\'t compromised, and I respect that you chose to rework rather than ship borderline product.</p>\n' +
        '<p>I\'ll be honest — the communication gap at the QC stage is a concern for future orders. If we\'re going to keep Nibelheim as our ABEC-7 bearing supplier, I need a commitment that in-process QC flags reach me <strong>before</strong> they become shipment-day surprises.</p>\n' +
        '<p>Let\'s schedule a call next week to discuss our Q3 forecast. If we can agree on an early-warning protocol for QC issues, there\'s more business here.</p>\n' +
        '<p>${buyer_name}</p>',
      delaySeconds: { min: 300, max: 600 },
    },

    // ── Step 13: Cloud — closing, relationship repair ──────────
    {
      senderId: 'buyer',
      replyToStepIndex: 12,
      subjectTemplate: 'Re: ${original_subject}',
      bodyTemplate:
        '<p>${buyer_name},</p>\n' +
        '<p>Thank you for the candid feedback — and for the opportunity to make this right. I don\'t take your business for granted.</p>\n' +
        '<p>On the QC communication issue: you\'re right. I\'ve already put a new process in place:</p>\n' +
        '<ul>\n' +
        '  <li>Any in-process measurement trending toward the tolerance boundary gets flagged to the customer <strong>immediately</strong> — not at final inspection</li>\n' +
        '  <li>For your account specifically, I\'ll send a <strong>daily status email</strong> during the last 3 days before ship date on all future orders</li>\n' +
        '  <li>My direct line is below — if you ever need an answer faster than email, call or text</li>\n' +
        '</ul>\n' +
        '<p>I\'d welcome a call about Q3. We\'re expanding our ABEC-7 capability next quarter with a new CNC grinding center, which will cut lead times by about 30%. I think it\'d be a good fit for the volumes you mentioned.</p>\n' +
        '<p>And — the ${discount_offer} discount on your next order is already applied to your account. No expiration.</p>\n' +
        '<p>Phone: (555) 019-4821<br/>\n' +
        'Email: ${seller_email}</p>\n' +
        '<p>Best regards,<br/><strong>${seller_name}</strong><br/>Sales Representative<br/>Nibelheim Precision Parts</p>',
      delaySeconds: { min: 300, max: 600 },
    },
  ],
};
