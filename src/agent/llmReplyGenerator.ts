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
): ReplyGenerator {
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

      const actionHint = classification.action === 'draft_for_manager'
        ? 'Generate a draft for MANAGER REVIEW. Prefix the body with "[DRAFT — pending manager approval]" and write a conservative, professional response.'
        : 'Generate a concise, professional auto-reply. Keep it short (2-3 sentences max). Acknowledge receipt and indicate next steps if needed.';

      const prompt = `You are an assistant that writes professional email replies for a procurement manager named Tifa at Shinra Manufacturing.

${actionHint}

Original email subject: ${email.subject}
Original email snippet: ${email.snippet}
Classification: ${classification.action} (confidence: ${classification.confidence})
Reason: ${classification.reason}

Return ONLY a JSON object — no other text:
{"subject":"${subject}","body":"<p>HTML reply here</p>","confidence":"${classification.confidence}"}`;

      const response = await client.messages.create({
        model: model ?? 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      });

      // DeepSeek may return a "thinking" block before the text block
      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock) {
        throw new Error('No text block in response');
      }

      const text = textBlock.text.trim();
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
