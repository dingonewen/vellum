// ── Persona ──────────────────────────────────────────────────────────
export interface Persona {
  id: 'primary' | 'cloud';  // primary = Tifa (product inbox), cloud = Cloud (supplier)
  name: string;
  email: string;
  grantId: string; // Nylas grant ID
}

// ── Variable context (accumulates across steps) ──────────────────────
export interface ScenarioContext {
  primary_name: string;       // Tifa — the buyer whose inbox is the product
  cloud_name: string;         // Cloud — supplier (or the supplier persona for this scenario)
  primary_email: string;
  cloud_email: string;
  [key: string]: string;      // extensible — scenarios add supplier_name_2, po_number, etc.
}

// ── Delay specification ──────────────────────────────────────────────
export type DelaySpec =
  | number                    // exact seconds
  | { min: number; max: number }; // random uniform in [min, max]

// ── Email attachment (resolved from template) ──────────────────────
export interface AttachmentSpec {
  filename: string;
  contentType: string;
  bodyTemplate: string;      // resolved with scenario context
}

// ── One step in a scenario ───────────────────────────────────────────
export interface ScenarioStep {
  senderId: 'primary' | 'cloud';  // which persona sends this step
  /** undefined = new thread root; number = reply to that step index */
  replyToStepIndex?: number;
  subjectTemplate: string;
  bodyTemplate: string;      // HTML body, ${variable} placeholders
  delaySeconds: DelaySpec;
  /** Step-specific variable overrides merged into context for future steps */
  variables?: Record<string, string>;
  /** Optional attachments (resolved from templates, sent with the email) */
  attachments?: AttachmentSpec[];
}

// ── A full scenario ──────────────────────────────────────────────────
export interface Scenario {
  id: string;
  name: string;
  description: string;
  initialContext: ScenarioContext;
  steps: ScenarioStep[];
}

// ── Sandbox state persisted in SQLite ────────────────────────────────
export interface ThreadRecord {
  id: number;
  threadId: string;          // Nylas first-message ID (thread anchor)
  scenarioId: string;
  stepIndex: number;
  senderId: 'primary' | 'cloud';
  sentMessageId: string;     // Nylas message ID returned after send
  subject: string;
  sentAt: number;            // Unix ms timestamp
}

// ── Engine run options ───────────────────────────────────────────────
export interface RunOptions {
  scenarioId: string;
  startFromStep?: number;
  maxSteps?: number;
  dryRun?: boolean;
  fast?: boolean;              // override all delays to 0 (demo mode)
  loop?: boolean;
  loopIntervalMinutes?: number;
}
