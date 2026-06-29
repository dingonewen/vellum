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

// Group by conversation — extract PO number or strip "Re:" prefix
function groupKey(subject: string): string {
  const poMatch = subject.match(/PO-\d{4}-\d{4}/);
  if (poMatch) return poMatch[0];
  return subject.replace(/^Re:\s*/i, '');
}

const threadsByGroup = new Map<string, typeof threads>();
for (const t of threads) {
  const key = groupKey(t.subject);
  const existing = threadsByGroup.get(key) || [];
  existing.push(t);
  threadsByGroup.set(key, existing);
}

console.log(`\n${threads.length} messages in ${threadsByGroup.size} conversation(s):\n`);

for (const [key, msgs] of threadsByGroup) {
  const sorted = msgs.sort((a, b) => a.step_index - b.step_index);
  console.log(`┌─ Conversation: "${sorted[0].subject.replace(/^Re:\s*/i, '').slice(0, 80)}"`);
  for (const m of sorted) {
    const date = new Date(m.sent_at).toLocaleString();
    const sender = m.sender_id === 'buyer' ? 'Cloud' : 'Tifa';
    console.log(`│  [${String(m.step_index).padStart(2)}] ${sender.padEnd(6)} ${date}  ${m.subject.slice(0, 70)}`);
  }
  console.log(`└─ ${msgs.length} messages\n`);
}
