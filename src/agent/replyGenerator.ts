import type { EmailMessage } from '../nylas/types';
import type { Classification } from './classifier';

export interface GeneratedReply {
  subject: string;       // e.g. "Re: PO #1124 Update"
  body: string;          // HTML body
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Reply generator interface.
 *
 * Rule-based implementation gives safe, template-driven replies.
 * An LLM implementation can be plugged in via the same interface
 * to generate more natural, context-aware responses.
 */
export interface ReplyGenerator {
  generate(
    email: EmailMessage,
    classification: Classification,
  ): Promise<GeneratedReply>;
}

/**
 * Rule-based reply generator.
 *
 * Uses simple templates keyed on the classification reason.
 * Deliberately conservative — these replies acknowledge receipt
 * and defer deep decisions to a human. Perfectly safe for auto-send.
 */
export function createRuleReplyGenerator(): ReplyGenerator {
  return {
    async generate(email, classification): Promise<GeneratedReply> {
      const subject = `Re: ${email.subject.replace(/^Re:\s*/i, '')}`;

      // Pick template based on classification reason
      if (classification.reason.includes('PO reference') || classification.reason.includes('business update')) {
        return {
          subject,
          body: '<p>Thanks for the update — noted.</p>' +
            '<p>Keep me posted if anything changes.</p>',
          confidence: 'high',
        };
      }

      if (classification.confidence === 'low' && classification.action === 'auto_reply') {
        return {
          subject,
          body: '<p>Thanks for reaching out.</p>' +
            '<p>I\'ve received your message and will get back to you shortly if this needs my attention.</p>',
          confidence: 'low',
        };
      }

      // draft_for_manager: generate a starter draft, human edits before sending
      if (classification.action === 'draft_for_manager') {
        return {
          subject,
          body: '<p><em>[DRAFT — pending manager approval]</em></p>' +
            '<p>Thank you for your message regarding this matter.</p>' +
            '<p>I will review and respond with the appropriate next steps shortly.</p>',
          confidence: 'low',
        };
      }

      // Fallback (shouldn't normally reach here for 'ignore' actions)
      return {
        subject,
        body: '<p>Message received.</p>',
        confidence: 'low',
      };
    },
  };
}
