#!/usr/bin/env npx tsx
/**
 * List sent emails tracked by the sandbox database.
 *
 * Usage:
 *   npx tsx sandbox/scripts/list-threads.ts [scenario-id]
 */

import 'dotenv/config';
import { listThreads } from '../db';

const scenarioId = process.argv[2];

const threads = listThreads(scenarioId) as Array<{
  id: number;
  thread_id: string;
  scenario_id: string;
  step_index: number;
  sender_id: string;
  sent_message_id: string;
  subject: string;
  sent_at: number;
}>;

if (threads.length === 0) {
  console.log('No messages found.' + (scenarioId ? ` (scenario: ${scenarioId})` : ''));
  process.exit(0);
}

// Group by thread
const threadsByThread = new Map<string, typeof threads>();
for (const t of threads) {
  const existing = threadsByThread.get(t.thread_id) || [];
  existing.push(t);
  threadsByThread.set(t.thread_id, existing);
}

console.log(`\n${threads.length} messages in ${threadsByThread.size} thread(s):\n`);

for (const [threadId, msgs] of threadsByThread) {
  console.log(`┌─ Thread: ${threadId.slice(0, 8)}... (${msgs[0].scenario_id})`);
  for (const m of msgs.sort((a, b) => a.step_index - b.step_index)) {
    const date = new Date(m.sent_at).toLocaleString();
    const sender = m.sender_id === 'buyer' ? 'Cloud' : 'Tifa';
    console.log(`│  [${m.step_index}] ${sender}: "${m.subject}" — ${date}`);
  }
  console.log(`└─ ${msgs.length} messages\n`);
}
