import Anthropic from '@anthropic-ai/sdk';
import type { EmailMessage } from '../nylas/types';
import type { Classifier, Classification } from './classifier';
import { checkSensitivity } from './sensitivity';

/**
 * LLM-powered classifier using Anthropic SDK (works with DeepSeek
 * via ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic).
 *
 * The prompt asks the model to classify incoming emails into one of
 * three categories and explain its reasoning.
 */
export function createLlmClassifier(
  apiKey: string,
  baseUrl?: string,
  model?: string,
): Classifier {
  const client = new Anthropic({
    apiKey,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  });

  return {
    async classify(email: EmailMessage): Promise<Classification> {
      const subject = email.subject;
      const body = email.snippet;

      // Quick pre-check: skip LLM call for obvious sensitivity
      const sens = checkSensitivity(subject, body);
      if (sens.sensitive) {
        return {
          action: 'draft_for_manager',
          confidence: 'high',
          reason: `Sensitive: ${sens.reasons.join(', ')}`,
        };
      }

      const prompt = `You are an email classifier for an autonomous agent that processes a buyer's inbox.

Given an email subject and snippet, classify it into EXACTLY ONE of:
- "auto_reply" — routine business (PO updates, shipping notifications, status checks, scheduling). Safe to auto-reply.
- "ignore" — spam, newsletters, marketing, promotions, or email sent to the wrong person. Do NOT reply.
- "draft" — anything sensitive (payments, invoices, contracts, legal, pricing), or anything where you're unsure. A human manager will review.

Return ONLY a JSON object with this exact format — no other text:
{"action":"<auto_reply|ignore|draft>","confidence":"<high|medium|low>","reason":"<one short sentence explaining why>"}

EMAIL:
Subject: ${subject}
Snippet: ${body}`;

      const response = await client.messages.create({
        model: model ?? 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      });

      // DeepSeek may return a "thinking" block — look for text, fall back to any block
      const textBlock = response.content.find(b => b.type === 'text')
        ?? response.content.find(b => b.type === 'thinking')
        ?? response.content[0];
      const text = (textBlock as { text: string }).text?.trim() ?? '';
      // Strip markdown code fences if present
      const json = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

      try {
        const parsed = JSON.parse(json) as {
          action: 'auto_reply' | 'ignore' | 'draft';
          confidence: 'high' | 'medium' | 'low';
          reason: string;
        };

        // Normalize "draft" → "draft_for_manager"
        const action = parsed.action === 'draft' ? 'draft_for_manager' : parsed.action;

        return {
          action,
          confidence: parsed.confidence,
          reason: parsed.reason,
        };
      } catch {
        // If JSON parse fails, fall back to draft for safety
        console.warn(`  ⚠ LLM classifier returned unparseable response: "${text.slice(0, 100)}". Falling back to draft.`);
        return {
          action: 'draft_for_manager',
          confidence: 'low',
          reason: 'LLM response unparseable — conservative fallback',
        };
      }
    },
  };
}
