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
  systemPrompt?: string,
  temperature?: number,
): ReplyGenerator {
  const client = new Anthropic({
    apiKey,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  });
  const temp = temperature ?? 0;

  return {
    async generate(
      email: EmailMessage,
      classification: Classification,
    ): Promise<GeneratedReply> {
      const subject = `Re: ${email.subject.replace(/^Re:\s*/i, '')}`;

      const isDraft = classification.action === 'draft_for_manager';
      const prefix = isDraft ? '[DRAFT — pending manager approval] ' : '';

      const rules = systemPrompt ?? `You are Tifa Lockhart, a procurement manager at Shinra Manufacturing. Write a professional email reply.

Business rules:
- If the sender mentions a PO, order, or shipment: reference the specific details (PO number, date, quantity, price). Confirm receipt.
- If the sender mentions an attachment but you don't see it in the email: ask them to resend it.
- If the sender asks a direct question: answer it specifically, don't just acknowledge.
- If the sender asks for a quote or price but gives no specs: ask for part numbers, quantities, and requirements. Don't send a price list or commit to anything.
- If the sender reports a problem: express concern, ask for specifics, suggest next steps.
- If the sender is introducing themselves or offering services: be polite but brief — 1-2 sentences. Don't commit to anything.
- Keep replies 1-4 sentences. Be concise. Match the sender's tone (formal vs casual).
- Sign the email as Tifa.`;

      const prompt = `${rules}

Original email:
Subject: ${email.subject}
From: ${email.sender.name || email.sender.email}
Body: ${email.snippet}
Classification: ${classification.action} (${classification.reason})

${isDraft ? 'This is a DRAFT for manager review. Be conservative.' : 'This is an auto-reply. Be professional and direct.'}

Return ONLY valid JSON — no markdown, no explanation:
{"subject":"Re: ${email.subject.replace(/^Re:\s*/i, '')}","body":"<p>${prefix}HTML reply here</p>"}`;

      let text = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await client.messages.create({
          model: model ?? 'deepseek-v4-flash',
          max_tokens: 1024,
          temperature: temp,
          messages: [{ role: 'user', content: prompt }],
        });
        const textBlock = response.content.find(b => b.type === 'text')
          ?? response.content.find(b => b.type === 'thinking')
          ?? response.content[0];
        text = (textBlock as { text: string }).text?.trim() ?? '';
        if (text.length > 0) break;
      }

      // Extract JSON from possible markdown/code fences
      let json = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
      // If the response starts with {, try to find the matching closing }
      if (json.startsWith('{')) {
        const lastBrace = json.lastIndexOf('}');
        if (lastBrace > 0) json = json.slice(0, lastBrace + 1);
      }

      try {
        return JSON.parse(json) as GeneratedReply;
      } catch {
        console.warn('  ⚠ LLM reply unparseable. Using safe fallback.');
        return {
          subject,
          body: '<p>Thank you for your message. I have received it and will follow up if needed.</p>',
          confidence: 'low',
        };
      }
    },
  };
}
