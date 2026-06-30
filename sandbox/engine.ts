import { createNylasClient } from '../src/nylas/nylasClient';
import type { EmailAttachment } from '../src/nylas/client';
import { BUYER, SELLER } from './persona';
import { insertThreadRecord, getLatestStep, getStepRecord, resetState } from './db';
import type { Scenario, ScenarioContext, RunOptions, DelaySpec } from './types';

const nylasClient = createNylasClient();

// ── Template substitution ────────────────────────────────────────────

function resolveTemplate(template: string, context: ScenarioContext): string {
  return template.replace(/\$\{(\w+)\}/g, (_, key: string) =>
    key in context ? context[key] : `\${${key}}`
  );
}

// ── Delay resolution ─────────────────────────────────────────────────

function resolveDelay(spec: DelaySpec): number {
  if (typeof spec === 'number') return spec * 1000;
  // Random uniform in [min, max]
  return (spec.min + Math.random() * (spec.max - spec.min)) * 1000;
}

// ── Load a scenario by ID ────────────────────────────────────────────

async function loadScenario(scenarioId: string): Promise<Scenario> {
  try {
    // Dynamic import — tsx resolves .ts files when compiled to .js
    const mod = await import(`./scenarios/${scenarioId}.js`);
    if (!mod.scenario) {
      throw new Error(`Scenario file "${scenarioId}" does not export a "scenario" object.`);
    }
    return mod.scenario as Scenario;
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(
        `Scenario "${scenarioId}" not found. Available: po-processing`
      );
    }
    throw err;
  }
}

// ── Cross-grant message ID resolution ───────────────────────────────

/**
 * Poll the recipient's inbox to find the just-sent message and return
 * its messageId IN THE RECIPIENT'S grant context. This is different
 * from the sender's messageId because Nylas IDs are grant-scoped.
 *
 * Using the recipient's ID as replyToMessageId produces proper
 * In-Reply-To / References headers that Gmail and Outlook respect.
 */
async function findRecipientMessageId(
  recipientGrantId: string,
  subject: string,
  sentAt: number,
): Promise<string | null> {
  const since = Math.floor(sentAt / 1000) - 30; // look back 30s before send
  const maxTries = 12;
  const pollMs = 5000;

  for (let attempt = 0; attempt < maxTries; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, pollMs));
    }
    try {
      const page = await nylasClient.listMessages(recipientGrantId, {
        sinceTimestamp: since,
        limit: 20,
      });
      const match = page.messages.find(m => m.subject === subject);
      if (match) {
        console.log(`     ✓ Found recipient message after ${attempt * 5}s`);
        return match.id;
      }
    } catch {
      // Retry on transient errors
    }
  }
  console.warn(`     ⚠ Could not find message in recipient inbox after ${maxTries * pollMs / 1000}s`);
  return null;
}

// ── Send one step ────────────────────────────────────────────────────

async function executeStep(
  scenario: Scenario,
  stepIndex: number,
  context: ScenarioContext,
  previousMessageId: string | null,
  dryRun: boolean,
): Promise<{ messageId: string; context: ScenarioContext }> {
  const step = scenario.steps[stepIndex];
  const persona = step.senderId === 'buyer' ? BUYER : SELLER;
  const recipient = step.senderId === 'buyer' ? SELLER : BUYER;

  // Merge step-specific variables into context
  const mergedContext: ScenarioContext = { ...context, ...(step.variables ?? {}) };

  const subject = resolveTemplate(step.subjectTemplate, mergedContext);
  const body = resolveTemplate(step.bodyTemplate, mergedContext);

  // Resolve attachments from templates
  const attachments: EmailAttachment[] = (step.attachments ?? []).map((att) => ({
    filename: resolveTemplate(att.filename, mergedContext),
    contentType: att.contentType,
    content: Buffer.from(resolveTemplate(att.bodyTemplate, mergedContext), 'utf-8'),
  }));

  if (dryRun) {
    console.log(`\n[DRY RUN] Step ${stepIndex}: ${persona.name} → ${recipient.name}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  ReplyTo: ${previousMessageId ?? '(new thread)'}`);
    if (attachments.length > 0) {
      console.log(`  Attachments: ${attachments.map(a => a.filename).join(', ')}`);
    }
    console.log(`  Body: ${body.slice(0, 300)}${body.length > 300 ? '...' : ''}`);
    return { messageId: `dry-run-msg-${stepIndex}`, context: mergedContext };
  }

  // Send via Nylas with threading
  const result = await nylasClient.sendMessage(
    persona.grantId,
    recipient.email,
    subject,
    body,
    attachments,
    previousMessageId ?? undefined,
  );

  const sentAt = Date.now();
  const threadId = previousMessageId ?? result.messageId;

  // Look up the message in the RECIPIENT's inbox to get their grant's messageId.
  // This ID is needed for proper In-Reply-To threading when they reply.
  let recipientMessageId: string | null = null;
  if (!dryRun) {
    recipientMessageId = await findRecipientMessageId(recipient.grantId, subject, sentAt);
  }

  // Persist state immediately after successful send
  insertThreadRecord({
    threadId,
    scenarioId: scenario.id,
    stepIndex,
    senderId: step.senderId,
    sentMessageId: result.messageId,
    recipientMessageId: recipientMessageId ?? undefined,
    subject,
  });

  console.log(`[SENT] Step ${stepIndex}: ${persona.name} → ${recipient.name}: "${subject}"`);

  return { messageId: result.messageId, context: mergedContext };
}

// ── Main entry point ─────────────────────────────────────────────────

export async function runScenario(options: RunOptions): Promise<void> {
  const scenario = await loadScenario(options.scenarioId);

  if (options.loop) {
    await runLoop(scenario, options);
    return;
  }

  const startStep = options.startFromStep ?? getLatestStep(options.scenarioId) + 1;
  if (startStep >= scenario.steps.length) {
    console.log(`Scenario "${scenario.name}" already complete (${scenario.steps.length} steps).`);
    console.log('Use --reset to wipe state and re-run from scratch.');
    return;
  }

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  Scenario: ${scenario.name.padEnd(51)}║`);
  console.log(`║  Steps:    ${String(startStep + 1)}–${String(Math.min(options.maxSteps ? startStep + options.maxSteps : scenario.steps.length, scenario.steps.length))} of ${scenario.steps.length}`.padEnd(65) + '║');
  console.log(`║  Mode:     ${(options.dryRun ? 'DRY RUN' : 'LIVE').padEnd(51)}║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

  await runSteps(scenario, startStep, options);
}

async function runSteps(
  scenario: Scenario,
  startStep: number,
  options: RunOptions,
  parentContext?: ScenarioContext,
): Promise<void> {
  let context: ScenarioContext = { ...(parentContext ?? scenario.initialContext) };
  let previousMessageId: string | null = null;

  // In dry-run mode, track message IDs in-memory so threading works without DB
  const dryRunMessageIds = new Map<number, string>();

  const endStep = options.maxSteps !== undefined
    ? Math.min(startStep + options.maxSteps, scenario.steps.length)
    : scenario.steps.length;

  const isDryRun = options.dryRun ?? false;

  for (let i = startStep; i < endStep; i++) {
    const step = scenario.steps[i];

    // Determine reply target for this step.
    // Use recipient_message_id — the parent message's ID in the CURRENT
    // sender's grant context (resolved after parent was sent).
    // This produces proper In-Reply-To/References headers for Gmail/Outlook threading.
    if (step.replyToStepIndex !== undefined) {
      if (isDryRun) {
        previousMessageId = dryRunMessageIds.get(step.replyToStepIndex) ?? null;
      } else {
        const parentRecord = getStepRecord(scenario.id, step.replyToStepIndex);
        // recipient_message_id is the message ID in the RESPONDER's grant —
        // exactly what we need for replyToMessageId. Do NOT fall back to
        // sent_message_id across grants (it belongs to the other persona).
        previousMessageId = parentRecord?.recipient_message_id ?? null;
      }
    } else {
      previousMessageId = null; // new thread
    }

    // Apply delay — skip in dry-run mode
    const isFirstInBatch = i === startStep;
    if (!isFirstInBatch && !isDryRun) {
      const delayMs = resolveDelay(step.delaySeconds);
      const delayLabel = typeof step.delaySeconds === 'number'
        ? `${step.delaySeconds}s`
        : `${step.delaySeconds.min}s–${step.delaySeconds.max}s`;
      console.log(`  ⏳ Waiting ${delayLabel}...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    try {
      const result = await executeStep(scenario, i, context, previousMessageId, isDryRun);
      context = result.context;
      previousMessageId = result.messageId;
      if (isDryRun) {
        dryRunMessageIds.set(i, result.messageId);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Step ${i} failed: ${detail}`);
      // Log full Nylas error details if available
      if (err && typeof err === 'object' && 'statusCode' in err) {
        console.error(`     Status: ${(err as Record<string, unknown>).statusCode}`);
      }
      if (err && typeof err === 'object' && 'code' in err) {
        console.error(`     Code: ${(err as Record<string, unknown>).code}`);
      }
      if (!isDryRun) {
        console.error(`     State saved up to step ${i - 1}. Resume with --from-step ${i}`);
      }
      throw err;
    }
  }

  console.log(`\n✓ Scenario "${scenario.name}" complete.`);
}

// ── Loop mode: continuous data generation ────────────────────────────

async function runLoop(scenario: Scenario, options: RunOptions): Promise<void> {
  const intervalMs = (options.loopIntervalMinutes ?? 30) * 60 * 1000;
  let iteration = 0;

  console.log(`\n🔄 Loop mode: "${scenario.name}"`);
  console.log(`   Interval: ${(intervalMs / 60000).toFixed(0)} minutes between loops\n`);

  while (true) {
    iteration++;
    console.log(`\n─── Loop ${iteration} ───`);

    // Wipe state so each loop is a fresh independent thread
    resetState(scenario.id);

    try {
      await runSteps(scenario, 0, { ...options, loop: false });
    } catch (err) {
      console.error(`Loop ${iteration} failed:`, err instanceof Error ? err.message : err);
      console.error('Waiting 60s before retry...');
      await new Promise(resolve => setTimeout(resolve, 60_000));
      continue;
    }

    console.log(`\n⏳ Next loop in ${(intervalMs / 60000).toFixed(0)} minutes...`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
