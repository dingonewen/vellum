import BetterSqlite3 from 'better-sqlite3';
import type { Database } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'data', 'sandbox.db');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS threads (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id             TEXT    NOT NULL,
    scenario_id           TEXT    NOT NULL,
    step_index            INTEGER NOT NULL,
    sender_id             TEXT    NOT NULL,
    sent_message_id       TEXT    NOT NULL,
    recipient_message_id  TEXT,
    subject               TEXT    NOT NULL,
    sent_at               INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scenario_state (
    scenario_id TEXT PRIMARY KEY,
    context_json TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_threads_scenario
    ON threads (scenario_id, step_index);

  CREATE INDEX IF NOT EXISTS idx_threads_thread
    ON threads (thread_id);
`;

let db: Database | null = null;

export function getDb(): Database {
  if (db) return db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new BetterSqlite3(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}

export interface ThreadInsert {
  threadId: string;
  scenarioId: string;
  stepIndex: number;
  senderId: string;
  sentMessageId: string;
  recipientMessageId?: string;
  subject: string;
}

export function insertThreadRecord(r: ThreadInsert): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO threads (thread_id, scenario_id, step_index, sender_id, sent_message_id, recipient_message_id, subject, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(r.threadId, r.scenarioId, r.stepIndex, r.senderId, r.sentMessageId, r.recipientMessageId ?? null, r.subject, Date.now());
}

/** Return the highest completed step index for a scenario, or -1 if none. */
export function getLatestStep(scenarioId: string): number {
  const d = getDb();
  const row = d.prepare(`
    SELECT MAX(step_index) AS max_step FROM threads WHERE scenario_id = ?
  `).get(scenarioId) as { max_step: number | null } | undefined;
  return row?.max_step ?? -1;
}

/** Look up a specific step's record (needed for replyToMessageId resolution). */
export function getStepRecord(
  scenarioId: string,
  stepIndex: number,
): { sent_message_id: string; recipient_message_id: string | null } | undefined {
  const d = getDb();
  return d.prepare(`
    SELECT sent_message_id, recipient_message_id FROM threads WHERE scenario_id = ? AND step_index = ?
  `).get(scenarioId, stepIndex) as { sent_message_id: string; recipient_message_id: string | null } | undefined;
}

/** Wipe state. Pass a scenarioId to reset only that scenario; omit to wipe all. */
export function resetState(scenarioId?: string): void {
  const d = getDb();
  if (scenarioId) {
    d.prepare('DELETE FROM threads WHERE scenario_id = ?').run(scenarioId);
    d.prepare('DELETE FROM scenario_state WHERE scenario_id = ?').run(scenarioId);
  } else {
    d.prepare('DELETE FROM threads').run();
    d.prepare('DELETE FROM scenario_state').run();
  }
}

/** Save or update the scenario's accumulated context for resume. */
export function saveScenarioContext(scenarioId: string, context: Record<string, string>): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO scenario_state (scenario_id, context_json) VALUES (?, ?)
    ON CONFLICT (scenario_id) DO UPDATE SET context_json = excluded.context_json
  `).run(scenarioId, JSON.stringify(context));
}

/** Load the saved context for a scenario (for resume), or null. */
export function loadScenarioContext(scenarioId: string): Record<string, string> | null {
  const d = getDb();
  const row = d.prepare(`
    SELECT context_json FROM scenario_state WHERE scenario_id = ?
  `).get(scenarioId) as { context_json: string } | undefined;
  return row ? JSON.parse(row.context_json) : null;
}

/** Return all thread records for a scenario, ordered by step. */
export function listThreads(scenarioId?: string) {
  const d = getDb();
  if (scenarioId) {
    return d.prepare(`
      SELECT * FROM threads WHERE scenario_id = ? ORDER BY step_index ASC
    `).all(scenarioId);
  }
  return d.prepare(`
    SELECT * FROM threads ORDER BY scenario_id, step_index ASC
  `).all();
}
