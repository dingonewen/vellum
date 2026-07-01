// ── Agent module ──────────────────────────────────────────────────
// Autonomous email agent: classify → generate → dispatch
//
// Entry point:
//   import { createAgent, createMemoryDraftStore } from './agent';
//   const agent = createAgent({ nylasClient, grantId, draftStore });
//   const result = await agent.process(incomingEmail);

export { createAgent, createMemoryDraftStore } from './orchestrator';
export type { Agent, AgentResult, AgentAction, AgentOptions, DraftStore } from './orchestrator';

export { createRuleClassifier } from './classifier';
export type { Classifier, Classification, EmailAction } from './classifier';

export { createRuleReplyGenerator } from './replyGenerator';
export type { ReplyGenerator, GeneratedReply } from './replyGenerator';

export { generateManagerDigest, buildDigestHtml } from './managerDigest';
export { createLlmClassifier } from './llmClassifier';
export { createLlmReplyGenerator } from './llmReplyGenerator';

export { checkSensitivity } from './sensitivity';
export type { SensitivityResult } from './sensitivity';
