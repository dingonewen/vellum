import type { NylasClient } from '../nylas/client';
import type { EmailMessage } from '../nylas/types';
import { createRuleClassifier, type Classifier, type Classification } from './classifier';
import { createRuleReplyGenerator, type ReplyGenerator, type GeneratedReply } from './replyGenerator';

export type AgentAction =
  | { type: 'ignored'; reason: string }
  | { type: 'auto_replied'; reply: GeneratedReply; sentMessageId: string }
  | { type: 'not_sent'; reply: GeneratedReply; reason: string }   // auto_reply but no NylasClient
  | { type: 'drafted'; draft: GeneratedReply; reason: string };

export interface AgentResult {
  email: EmailMessage;
  classification: Classification;
  action: AgentAction;
}

/** Simple in-memory draft store (replace with DB table for production). */
export interface DraftStore {
  save(email: EmailMessage, classification: Classification, draft: GeneratedReply): void;
  list(): Array<{ email: EmailMessage; classification: Classification; draft: GeneratedReply; savedAt: number }>;
}

export function createMemoryDraftStore(): DraftStore {
  const drafts: Array<{
    email: EmailMessage;
    classification: Classification;
    draft: GeneratedReply;
    savedAt: number;
  }> = [];
  return {
    save(email, classification, draft) {
      drafts.push({ email, classification, draft, savedAt: Date.now() });
    },
    list() { return drafts; },
  };
}

/** Options for the agent orchestrator. */
export interface AgentOptions {
  /** Nylas client for sending auto-replies. Required if auto_reply is enabled. */
  nylasClient?: NylasClient;
  /** Grant ID for the agent's mailbox (needed for sending replies). */
  grantId?: string;
  /** Draft store for pending human-review items. */
  draftStore: DraftStore;
  /** Classifier (defaults to rule-based). */
  classifier?: Classifier;
  /** Reply generator (defaults to rule-based). */
  replyGenerator?: ReplyGenerator;
}

/**
 * Agent orchestrator — ties classification, reply generation, and action
 * dispatch into a single pipeline.
 *
 * Usage:
 *   const agent = createAgent({ nylasClient, grantId, draftStore });
 *   const result = await agent.process(email);
 *   // result.action.type === 'auto_replied' | 'drafted' | 'ignored'
 */
export interface Agent {
  process(email: EmailMessage): Promise<AgentResult>;
  getDrafts(): Array<{ email: EmailMessage; classification: Classification; draft: GeneratedReply; savedAt: number }>;
}

export function createAgent(options: AgentOptions): Agent {
  const classifier = options.classifier ?? createRuleClassifier();
  const replyGenerator = options.replyGenerator ?? createRuleReplyGenerator();

  return {
    async process(email: EmailMessage): Promise<AgentResult> {
      const classification = await classifier.classify(email);

      // Ignore: spam, newsletters, wrong person
      if (classification.action === 'ignore') {
        console.log(`  [AGENT] Ignored: "${email.subject}" — ${classification.reason}`);
        return {
          email,
          classification,
          action: { type: 'ignored', reason: classification.reason },
        };
      }

      // Generate a reply regardless (used for both auto-send and draft)
      const draft = await replyGenerator.generate(email, classification);

      // Draft for manager: store, don't send
      if (classification.action === 'draft_for_manager') {
        options.draftStore.save(email, classification, draft);
        console.log(`  [AGENT] Drafted: "${email.subject}" — ${classification.reason}`);
        return {
          email,
          classification,
          action: { type: 'drafted', draft, reason: classification.reason },
        };
      }

      // Auto-reply: generate + send immediately
      if (!options.nylasClient || !options.grantId) {
        console.warn(`  [AGENT] Would auto-reply to "${email.subject}" but no NylasClient/grantId configured. Skipping send.`);
        return {
          email,
          classification,
          action: { type: 'not_sent', reply: draft, reason: 'NylasClient not configured — reply not sent' },
        };
      }

      const senderEmail = email.sender.email;
      const result = await options.nylasClient.sendMessage(
        options.grantId,
        senderEmail,
        draft.subject,
        draft.body,
        undefined,             // no attachments
        email.id,              // replyToMessageId — keeps replies in the same thread
      );
      console.log(`  [AGENT] Auto-replied: "${email.subject}" → ${senderEmail} (msgId: ${result.messageId})`);
      return {
        email,
        classification,
        action: { type: 'auto_replied', reply: draft, sentMessageId: result.messageId },
      };
    },

    getDrafts() {
      return options.draftStore.list();
    },
  };
}
