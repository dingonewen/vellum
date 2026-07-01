import 'dotenv/config';
import { createNylasClient } from '../nylas/nylasClient';
import {
  createAgent,
  createMemoryDraftStore,
  createLlmClassifier,
  createLlmReplyGenerator,
  buildDigestHtml,
  shouldSendDigest,
} from './index';
import type { DigestFrequency } from './managerDigest';
import { resolveGrant } from './db';
import type { PersonaConfig } from './personas';

export interface DaemonOptions {
  persona: PersonaConfig;
  pollSeconds?: number;
  digestFrequency?: DigestFrequency;
}

export interface DaemonHandle {
  /** Human-readable label for this daemon instance. */
  label: string;
  /** The setInterval handle — call clearInterval() to stop. */
  timer: ReturnType<typeof setInterval>;
  /** Run one tick immediately (used for initial fetch before polling starts). */
  tick: () => Promise<void>;
}

/**
 * Start a polling daemon for a single persona.
 *
 * Returns a handle so the caller can manage lifecycle (stop, restart, etc.).
 * The daemon polls the persona's Nylas inbox every `pollSeconds`, classifies
 * each unread message via LLM, auto-replies or drafts, and sends manager
 * digests when drafts are queued.
 */
export function startDaemon(options: DaemonOptions): DaemonHandle {
  const { persona, pollSeconds = 5, digestFrequency = 'on_sensitive' } = options;

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
  const model = 'deepseek-v4-flash';

  const nylas = createNylasClient();
  const draftStore = createMemoryDraftStore();

  // Resolve grants
  const agentGrant = resolveGrant(persona.grantType);
  if (!agentGrant) {
    console.error(`No "${persona.grantType}" grant configured for ${persona.name}. Set one via http://localhost:3000`);
    process.exit(1);
  }

  const manager = persona.managerGrantType
    ? resolveGrant(persona.managerGrantType)
    : undefined;
  const managerEmail = manager?.email ?? agentGrant.email;
  const managerGrantId = manager?.grant_id ?? agentGrant.grant_id;

  const agent = createAgent({
    nylasClient: nylas,
    grantId: agentGrant.grant_id,
    classifier: createLlmClassifier(apiKey, baseUrl, model),
    replyGenerator: createLlmReplyGenerator(apiKey, baseUrl, model, persona.name, persona.role),
    draftStore,
  });

  const sendDigest = process.env.AGENT_SEND_DIGEST !== 'false';
  const processedIds = new Set<string>();
  let autoCount = 0;
  let ignoreCount = 0;
  let draftCount = 0;
  let lastDigestSent: number | null = null;

  console.log(`${persona.emoji} ${persona.name} daemon started — watching ${agentGrant.email} every ${pollSeconds}s`);
  console.log(`   Manager digest: ${sendDigest ? `${managerEmail} (${digestFrequency})` : 'DISABLED'}`);
  console.log(`   Model: ${model} @ ${baseUrl}\n`);

  let isFirstTick = true;

  async function tick() {
    try {
      // First tick looks back 2 min to catch seed emails; subsequent ticks
      // use a tight rolling window to avoid re-processing old mail.
      const lookback = isFirstTick ? 120 : pollSeconds * 2;
      const since = Math.floor(Date.now() / 1000) - lookback;
      if (isFirstTick) isFirstTick = false;
      const page = await nylas.listMessages(agentGrant!.grant_id, {
        sinceTimestamp: since,
        limit: 5,
        unreadOnly: true,
      });

      for (const email of page.messages) {
        if (processedIds.has(email.id)) continue;
        if (email.sender.email === agentGrant!.email) continue; // skip own mail
        if (email.subject.toLowerCase().includes('delivery status')) continue;
        processedIds.add(email.id);

        const result = await agent.process(email);
        const t = result.action.type;
        if (t === 'auto_replied' || t === 'not_sent') autoCount++;
        else if (t === 'ignored') ignoreCount++;
        else draftCount++;

        const icon = t === 'auto_replied' ? '✅' : t === 'ignored' ? '🗑️' : '📝';
        console.log(`${icon} [${t}] ${email.subject.slice(0, 70)}`);

        // Send manager digest if a draft was queued (unless disabled)
        if (sendDigest && t === 'drafted' && shouldSendDigest(digestFrequency, lastDigestSent, true)) {
          const drafts = draftStore.list();
          const html = buildDigestHtml(drafts, autoCount, ignoreCount);
          try {
            await nylas.sendMessage(
              managerGrantId!,
              managerEmail,
              `📋 ${persona.label} Digest — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
              html,
            );
            lastDigestSent = Date.now();
            console.log(`  📬 Digest sent to ${managerEmail} (${drafts.length} draft(s))`);
          } catch (e) {
            console.error('  ⚠ Failed to send digest:', (e as Error).message);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('429') && !msg.includes('timeout')) {
        console.error('  ⚠', msg);
      }
    }
  }

  // First run immediately, then poll
  tick();

  const timer = setInterval(tick, pollSeconds * 1000);

  return {
    label: `${persona.emoji} ${persona.name}`,
    timer,
    tick,
  };
}
