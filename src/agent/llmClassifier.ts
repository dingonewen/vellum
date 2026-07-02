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
  personaContext?: string,
): Classifier {
  const client = new Anthropic({
    apiKey,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  });

  const inboxContext = personaContext || 'a procurement buyer at a manufacturing company monitoring her work inbox';

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

      const prompt = `You are an email classifier for an autonomous agent. The agent is ${inboxContext}.

Classify the email into EXACTLY ONE action:
- "auto_reply" — routine business that the agent can handle alone: PO updates, order confirmations, shipping notifications, status checks, production issues, scheduling, or business inquiries from known contacts. Also: vague inquiries where the agent should ask for specifics — auto-reply to ask what they need.
- "ignore" — no response needed: spam, newsletters, marketing, promotions, emails sent to the wrong person, internal company announcements, HR broadcasts, "all staff" messages, facility notices, FYI-only emails, or automated notifications.
- "draft" — requires human review: payments, invoices, contracts, legal issues, pricing commitments, refunds, negotiating terms, or anything you are genuinely unsure about.

Return ONLY valid JSON — no markdown, no explanation:
{"action":"<auto_reply|ignore|draft>","confidence":"<high|medium|low>","reason":"<one short sentence>"}

EMAIL:
Subject: ${subject}
Snippet: ${body}`;

      let text = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await client.messages.create({
          model: model ?? 'deepseek-v4-flash',
          max_tokens: 512,
          temperature: 0,
          messages: [{ role: 'user', content: prompt }],
        });
        const textBlock = response.content.find(b => b.type === 'text')
          ?? response.content.find(b => b.type === 'thinking')
          ?? response.content[0];
        text = (textBlock as { text: string }).text?.trim() ?? '';
        if (text.length > 0) break; // got a response, stop retrying
      }

      const json = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

      try {
        const parsed = JSON.parse(json) as {
          action: 'auto_reply' | 'ignore' | 'draft';
          confidence: 'high' | 'medium' | 'low';
          reason: string;
        };
        const act = parsed.action === 'draft' ? 'draft_for_manager' : parsed.action;
        return { action: act, confidence: parsed.confidence, reason: parsed.reason };
      } catch {
        console.warn(`  ⚠ LLM classifier unparseable: "${text.slice(0, 60)}" → draft`);
        return {
          action: 'draft_for_manager',
          confidence: 'low',
          reason: 'LLM response unparseable — conservative fallback',
        };
      }
    },
  };
}
