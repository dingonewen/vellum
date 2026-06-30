import type { Scenario } from '../types';

export const scenario: Scenario = {
  id: 'mixed-inbox',
  name: 'Mixed Inbox — Clean, Spam & Wrong-Person (6 steps, 4 threads)',
  description:
    'Simulates a realistic buyer inbox with four independent threads: ' +
    '(A) a clean PO update from a real supplier, replied to; ' +
    '(B) spam — ignored; ' +
    '(C) wrong person — ignored; ' +
    '(D) semi-relevant sourcing inquiry — politely redirected. ' +
    'All incoming mail is sent from Cloud\'s Outlook account with different ' +
    'body signatures and subjects to help an AI agent learn content-based classification.',
  initialContext: {
    primary_name: 'Tifa',
    cloud_name: 'Cloud',
    primary_email: '',
    cloud_email: '',
    supplier_a: 'Acme Industrial Supply',
    supplier_b: 'Zenith Parts Co.',
    spammer: 'BEST BEARINGS LTD',
    stranger: 'Marketing Intern',
  },
  steps: [
    // ── Thread A: Clean PO update ── (Steps 0–1)
    {
      senderId: 'cloud',
      senderName: '${supplier_a}',
      subjectTemplate: 'PO #1124 Update — On Schedule for Friday',
      bodyTemplate:
        '<p>Hi ${primary_name},</p>\n' +
        '<p>Quick update — PO #1124 is on track. We\'ll ship Friday as promised.</p>\n' +
        '<p>Let me know if you need anything changed before then.</p>\n' +
        '<p>Thanks,<br/>Sarah<br/><em>${supplier_a}</em></p>',
      delaySeconds: 0,
    },
    {
      senderId: 'primary',
      replyToStepIndex: 0,
      senderName: '${primary_name}',
      subjectTemplate: 'Re: PO #1124 Update — On Schedule for Friday',
      bodyTemplate:
        '<p>Sarah,</p>\n' +
        '<p>Great, thanks for the update. Friday works.</p>\n' +
        '<p>${primary_name}</p>',
      delaySeconds: { min: 30, max: 60 },
    },

    // ── Thread B: Spam ── (Step 2, no reply)
    {
      senderId: 'cloud',
      senderName: '${spammer}',
      subjectTemplate: '🔥 50% OFF ALL BEARINGS — ONE DAY ONLY!!!',
      bodyTemplate:
        '<div style="background:#ff6; padding:10px;">\n' +
        '  <h2 style="color:red;">MASSIVE BEARING BLOWOUT</h2>\n' +
        '  <p>Dear Valued Customer,</p>\n' +
        '  <p>For ONE DAY ONLY, all industrial bearings are <strong>50% OFF</strong>!</p>\n' +
        '  <p><a href="http://totally-legit-bearings.example">CLICK HERE</a> to claim your discount!</p>\n' +
        '  <p style="font-size:10px;">You are receiving this because you once bought a bolt.</p>\n' +
        '</div>\n' +
        '<p><em>— ${spammer}</em></p>',
      delaySeconds: { min: 60, max: 120 },
    },

    // ── Thread C: Wrong person ── (Step 3, no reply)
    {
      senderId: 'cloud',
      senderName: '${stranger}',
      subjectTemplate: 'Is this Accounting??',
      bodyTemplate:
        '<p>Hi,</p>\n' +
        '<p>I\'m the new intern from Floor 3. Is this the Accounting department? ' +
        'I need to submit my expense report for the team lunch.</p>\n' +
        '<p>Sorry if this is the wrong inbox — the directory is down!</p>\n' +
        '<p>— ${stranger}</p>',
      delaySeconds: { min: 30, max: 60 },
    },

    // ── Thread D: Sourcing inquiry ── (Steps 4–5)
    {
      senderId: 'cloud',
      senderName: '${supplier_b}',
      subjectTemplate: 'Can you source 500 units of XJ-7 connectors?',
      bodyTemplate:
        '<p>Dear ${primary_name},</p>\n' +
        '<p>We\'re expanding our connector line and heard you might need XJ-7-compatible parts. ' +
        'We can supply <strong>up to 500 units/month</strong> at competitive rates.</p>\n' +
        '<p>Would you be open to a call next week to discuss?</p>\n' +
        '<p>Best regards,<br/>Marco<br/><em>${supplier_b}</em></p>',
      delaySeconds: { min: 60, max: 120 },
    },
    {
      senderId: 'primary',
      replyToStepIndex: 4,
      senderName: '${primary_name}',
      subjectTemplate: 'Re: Can you source 500 units of XJ-7 connectors?',
      bodyTemplate:
        '<p>Marco,</p>\n' +
        '<p>Not my department — but I\'m forwarding this to Ray in our components team. ' +
        'He handles XJ-7 sourcing. Expect an email from him by Tuesday.</p>\n' +
        '<p>Thanks for reaching out.</p>\n' +
        '<p>${primary_name}</p>',
      delaySeconds: { min: 60, max: 120 },
    },
  ],
};
