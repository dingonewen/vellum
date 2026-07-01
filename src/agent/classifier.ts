import type { EmailMessage } from '../nylas/types';
import { checkSensitivity } from './sensitivity';

/** Classification result for one incoming email. */
export type EmailAction =
  | 'ignore'              // spam, newsletter, wrong person — no action
  | 'auto_reply'          // routine — agent can reply autonomously
  | 'draft_for_manager';  // sensitive — draft a reply, queue for human approval

export interface Classification {
  action: EmailAction;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Rule-based classifier.
 *
 * Heuristics:
 *   - No actionable content + no personal salutation → probably spam → ignore
 *   - Contains known spam signals (all caps, excessive punctuation, "click here") → ignore
 *   - References a PO number or "PO #" → routine business → auto_reply
 *   - Contains sensitive keywords (wire transfer, invoice, contract, etc.) → draft_for_manager
 *   - Unclear intent + not obviously spam → draft_for_manager (low confidence — human decides)
 *
 * This is the zero-dependency fallback. An LLM classifier can be plugged in
 * via the same Classifier interface for higher accuracy.
 */
export interface Classifier {
  classify(email: EmailMessage): Promise<Classification>;
}

export function createRuleClassifier(): Classifier {
  return {
    async classify(email: EmailMessage): Promise<Classification> {
      const subject = email.subject;
      const body = email.snippet; // snippet is the first ~200 chars of body
      const combined = `${subject} ${body}`;

      // 1. Sensitivity check first — overrides everything
      const sensResult = checkSensitivity(subject, body);
      if (sensResult.sensitive) {
        return {
          action: 'draft_for_manager',
          confidence: 'high',
          reason: `Sensitive content detected: ${sensResult.reasons.join(', ')}`,
        };
      }

      // 2. Obvious spam signals
      const spamSignals = [
        /\b(click\s*here|limited\s*time|act\s*now|exclusive\s*offer)\b/i,
        /[A-Z]{4,}/,                          // ALL CAPS SHOUTING
        /[!?]{3,}/,                            // Excessive punctuation
        /\b(?:unsubscribe|opt[- ]out)\b/i,    // Newsletter signals
      ];
      const spamScore = spamSignals.filter(p => p.test(combined)).length;
      if (spamScore >= 2) {
        return {
          action: 'ignore',
          confidence: 'high',
          reason: `Spam signals: score=${spamScore}`,
        };
      }

      // 3. Routine business signals → auto-reply
      const businessSignals = [
        /\bPO[\s#-]*\d{3,}\b/i,              // PO #1124, PO 1124, PO#1124
        /\b(purchase order|order)\s*(update|confirmed|received|shipped)\b/i,
        /\bETA\b|\btracking\s*(number|#)\b/i,
        /\bon\s*(track|schedule)\b/i,
      ];
      if (businessSignals.some(p => p.test(combined))) {
        return {
          action: 'auto_reply',
          confidence: 'high',
          reason: 'Routine business update with PO reference',
        };
      }

      // 4. Looks like a real person asking something — but we're not sure what
      const personalSignals = [
        /\b(hi|hello|dear|hey)\s+\w+/i,        // "Hi Tifa"
        /\b(thanks|thank you|best regards)\b/i,
        /\b(question|inquiry|wondering|checking)\b/i,
      ];
      if (personalSignals.some(p => p.test(combined))) {
        return {
          action: 'auto_reply',
          confidence: 'low',
          reason: 'Personal salutation but unclear business context — safe to acknowledge',
        };
      }

      // 5. Catch-all — unclear, let manager decide
      return {
        action: 'draft_for_manager',
        confidence: 'low',
        reason: 'Unclear intent — not obviously spam, not obviously business',
      };
    },
  };
}
