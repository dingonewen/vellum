import Anthropic from '@anthropic-ai/sdk';
import type { EmailMessage } from '../nylas/types';
import type { ReplyGenerator, GeneratedReply } from './replyGenerator';
import type { Classification } from './classifier';

/**
 * LLM-powered reply generator using Anthropic SDK (works with DeepSeek
 * via ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic).
 *
 * For auto_reply: generates a concise, professional reply.
 * For draft: generates a draft marked for manager review.
 */
export function createLlmReplyGenerator(
  apiKey: string,
  baseUrl?: string,
  model?: string,
  personaName?: string,
  personaRole?: string,
  archetype?: 'buyer' | 'supplier' | 'multi',
): ReplyGenerator {
  const name = personaName || 'Tifa Lockhart';
  const role = personaRole || 'a procurement manager at Shinra Manufacturing';
  const personaType = archetype || 'buyer';
  const client = new Anthropic({
    apiKey,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  });

  // ── Persona-aware business rules ──────────────────────────────────

  const BUYER_RULES = `Business rules:
- If the sender mentions a PO, order, or shipment: reference the specific details (PO number, date, quantity, price). Confirm receipt.
- If the sender mentions an attachment but you don't see it in the email: ask them to resend it.
- If the sender asks a direct question: answer it specifically, don't just acknowledge.
- If the sender asks for a quote or price but gives no specs: ask for part numbers, quantities, and requirements. Don't send a price list or commit to anything.
- If the sender reports a problem: express concern, ask for specifics, suggest next steps.
- If the sender is introducing themselves or offering services: be polite but brief — 1-2 sentences. Don't commit to anything.
- If the email is about scheduling or dates: confirm availability or propose a time.
- If the email is an internal HR/broadcast announcement ("all staff", "facility closed"): classify should be ignore — but if you reach here, give a one-liner acknowledgement.
- Keep replies 1-4 sentences. Be concise. Match the sender's tone (formal vs casual).
- Sign the email as ${name.split(' ')[0]}.`;

  const SUPPLIER_RULES = `Business rules (you are a supplier/sales rep):
- If the sender asks for a quote: provide ballpark pricing with a disclaimer ("subject to formal quote"), ask for target quantities.
- If the sender confirms a PO: acknowledge receipt, confirm the order details, give an ETA if you have one.
- If the sender asks about a shipment/delivery: check the specific PO or tracking number they mention. If delayed, explain why and offer a revised ETA.
- If the sender reports a problem (wrong quantity, quality issue): apologize professionally, say you will investigate, ask for specifics (photos, batch numbers).
- If the sender requests a change to an order (quantity, spec, date): acknowledge the request, confirm what you can do, state any constraints.
- If the sender is a buyer making small talk: be friendly and professional, keep it brief.
- If the email is clearly NOT for you (misdirected, HR, internal company): keep the reply minimal — a polite redirect or "this appears to be misdirected".
- If the email is promotional/spam/marketing: DO NOT reply. Say "IGNORE" and return an empty body.
- Keep replies 1-4 sentences. Be concise and professional. Match the sender's tone.
- Sign the email as ${name.split(' ')[0]}.`;

  const MULTI_RULES = `Business rules (you handle multiple roles — adapt to the email context):

FIRST, determine the email's nature and your role:
- If the email is about POs, orders, shipments, quotes, or pricing → you are a SUPPLIER/SALES REP.
- If the email is a company announcement, HR broadcast, "all staff", facility notice, or FYI-only → you are a RECIPIENT who should IGNORE (return empty body).
- If the email is clearly misdirected (wrong person/department) → politely redirect.
- If the email is spam, marketing, or promotional → IGNORE (return empty body).
- If the email is from a buyer asking a business question → you are a SUPPLIER.

AS A SUPPLIER:
- If the sender asks for a quote: provide ballpark pricing with disclaimer, ask for target quantities.
- If the sender confirms a PO: acknowledge receipt, confirm order details, give an ETA.
- If the sender asks about a shipment: reference the PO/tracking, explain delays honestly, offer revised ETA.
- If the sender reports a problem: apologize professionally, say you will investigate, ask for specifics.
- If the sender requests a change: acknowledge, confirm what's possible, state constraints.
- Sign as ${name.split(' ')[0]}.

AS A RECIPIENT (should IGNORE):
- For HR announcements, facilities notices, "all staff" messages: return empty body — do NOT reply.
- For spam, marketing, promotions: return empty body — do NOT reply.
- For misdirected emails: one-line redirect, nothing more.

Keep replies 1-4 sentences. Be concise. Match sender's tone.`;

  const rules = personaType === 'supplier' ? SUPPLIER_RULES :
                personaType === 'multi' ? MULTI_RULES :
                BUYER_RULES;

  return {
    async generate(
      email: EmailMessage,
      classification: Classification,
    ): Promise<GeneratedReply> {
      const subject = `Re: ${email.subject.replace(/^Re:\s*/i, '')}`;

      const isDraft = classification.action === 'draft_for_manager';
      const prefix = isDraft ? '[DRAFT — pending manager approval] ' : '';

      const prompt = `You are ${name}, ${role}. Write a professional email reply.

${rules}

Original email:
Subject: ${email.subject}
From: ${email.sender.name || email.sender.email}
Body: ${email.snippet}
Classification: ${classification.action} (${classification.reason})

${isDraft ? 'This is a DRAFT for manager review. Be conservative.' : 'This is an auto-reply. Be professional and direct.'}

Return ONLY valid JSON — no markdown, no explanation:
{"subject":"Re: ${email.subject.replace(/^Re:\s*/i, '')}","body":"<p>${prefix}HTML reply here</p>"}`;

      const response = await client.messages.create({
        model: model ?? 'deepseek-v4-flash',
        max_tokens: 1024,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      });

      // DeepSeek may return a "thinking" block — look for text, fall back to any block
      const textBlock = response.content.find(b => b.type === 'text')
        ?? response.content.find(b => b.type === 'thinking')
        ?? response.content[0];
      const text = (textBlock as { text: string }).text?.trim() ?? '';
      const json = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

      try {
        return JSON.parse(json) as GeneratedReply;
      } catch {
        // Fallback: wrap the raw text in a basic HTML paragraph
        console.warn('  ⚠ LLM reply generator returned unparseable response. Using raw text.');
        return {
          subject,
          body: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
          confidence: 'low',
        };
      }
    },
  };
}
