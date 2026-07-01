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
): ReplyGenerator {
  const name = personaName || 'Tifa Lockhart';
  const role = personaRole || 'a procurement manager at Shinra Manufacturing';
  const client = new Anthropic({
    apiKey,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  });

  return {
    async generate(
      email: EmailMessage,
      classification: Classification,
    ): Promise<GeneratedReply> {
      const subject = `Re: ${email.subject.replace(/^Re:\s*/i, '')}`;

      const isDraft = classification.action === 'draft_for_manager';
      const prefix = isDraft ? '[DRAFT — pending manager approval] ' : '';

      const prompt = `You are ${name}, ${role}. Write a professional email reply.

Business rules:
- If the sender mentions a PO, order, or shipment: reference the specific details (PO number, date, quantity, price). Confirm receipt.
- If the sender mentions an attachment but you don't see it in the email: ask them to resend it.
- If the sender asks a direct question: answer it specifically, don't just acknowledge.
- If the sender asks for a quote or price but gives no specs: ask for part numbers, quantities, and requirements. Don't send a price list or commit to anything.
- If the sender reports a problem: express concern, ask for specifics, suggest next steps.
- If the sender is introducing themselves or offering services: be polite but brief — 1-2 sentences. Don't commit to anything.
- If the email is about scheduling or dates: confirm availability or propose a time.
- If the email is an internal HR/broadcast announcement ("all staff", "facility closed"): classify should be ignore — but if you reach here, give a one-liner acknowledgement.
- Keep replies 1-4 sentences. Be concise. Match the sender's tone (formal vs casual).
- Sign the email as ${name.split(' ')[0]}.

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
