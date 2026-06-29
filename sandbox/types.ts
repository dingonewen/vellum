// ── Persona ──────────────────────────────────────────────────────────
export interface Persona {
  id: 'buyer' | 'seller';
  name: string;
  email: string;
  grantId: string; // Nylas grant ID
}

// ── Variable context (accumulates across steps) ──────────────────────
export interface ScenarioContext {
  buyer_name: string;
  seller_name: string;
  buyer_email: string;
  seller_email: string;
  [key: string]: string; // extensible — scenarios add product, price, etc.
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
  senderId: 'buyer' | 'seller';
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
  senderId: 'buyer' | 'seller';
  sentMessageId: string;     // Nylas message ID returned after send
  subject: string;
  sentAt: number;            // Unix ms timestamp
}

// ── Engine run options ───────────────────────────────────────────────
export interface RunOptions {
  scenarioId: string;
  startFromStep?: number;    // resume from here; default: auto-detect from DB
  maxSteps?: number;
  dryRun?: boolean;
  loop?: boolean;            // re-run continuously with fresh variables
  loopIntervalMinutes?: number; // wait between loops (default 30)
}
