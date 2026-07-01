# Vellum

An autonomous email agent with a built-in integration testing sandbox. Connects to real mailboxes via Nylas, processes incoming mail through a classify → reply pipeline, and simulates multi-persona conversation threads for regression testing.

Dual-architecture: the **Agent** handles real inboxes autonomously; the **Sandbox** generates labeled training data and verifies agent behavior. LLM-powered via DeepSeek (rule-based fallback available, no API key required for sandbox-only use).

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     V ELLUM                          │
│                                                      │
│  ┌──────────────┐       ┌──────────────────────────┐ │
│  │   S A N D B O X │       │   A G E N T               │ │
│  │   (testing tool) │       │   (production engine)     │ │
│  │                  │       │                           │ │
│  │  Scenario .ts ───┤       │  Incoming email ──► classify│
│  │  Engine ───► Nylas│      │    ├─ ignore (spam)        │ │
│  │  DB ──► resume   │       │    ├─ auto_reply (send)    │ │
│  │                  │       │    └─ draft (manager queue)│ │
│  │  Generates data ──┼───────► Trains & validates agent  │ │
│  └──────────────┘       └──────────────────────────┘ │
│                                                      │
│  Shared: NylasClient · SQLite · LLM (DeepSeek)        │
└─────────────────────────────────────────────────────┘
```

**Sandbox** generates realistic multi-persona email threads. Used during development to create labeled training data, during CI to verify the agent hasn't regressed, and for demos.

**Agent** processes a real inbox: classifies every incoming email, auto-replies to routine business, ignores spam, and queues sensitive items for human review. A daily digest summarizes pending approvals.

Both share the same `NylasClient` abstraction and `Agent` pipeline — you can run the agent against live mail or replay Sandbox scenarios to verify its behavior.

---

## Prerequisites

- Node.js 20+
- A [Nylas](https://nylas.com) account (free tier works)
- Two email accounts with Nylas OAuth grants (Gmail + Outlook tested)
- A [DeepSeek API key](https://platform.deepseek.com) for LLM-powered agent mode (optional — rule-based fallback works without it)

---

## Installation

```bash
git clone https://github.com/dingonewen/vellum.git
cd vellum
npm install
cp .env.example .env
# fill in .env with your keys (see below)
```

> **Ubuntu / Node 20+:** `better-sqlite3` is a native module. If `npm install` fails with an ABI error:
> ```bash
> sudo apt-get install -y build-essential python3
> npm install better-sqlite3 --build-from-source
> ```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NYLAS_API_KEY` | Nylas API key (doubles as OAuth client secret) |
| `NYLAS_CLIENT_ID` | Nylas OAuth client ID |
| `NYLAS_API_URI` | Nylas API base URL (default: `https://api.us.nylas.com`) |
| `APP_BASE_URL` | Public base URL for OAuth redirects |
| `CALLBACK_URL` | Full OAuth callback URL |
| `PORT` | HTTP port (default: `3000`) |
| `DATABASE_PATH` | SQLite DB path (default: `./data/vellum.db`) |
| `ANTHROPIC_API_KEY` | DeepSeek API key (used by both Sandbox LLM and Agent LLM) |
| `ANTHROPIC_MODEL` | Model ID (default: `deepseek-v4-pro`) |
| `ANTHROPIC_BASE_URL` | API endpoint (`https://api.deepseek.com/anthropic`) |
| `AGENT_API_KEY` | Agent-specific key (falls back to `ANTHROPIC_API_KEY`) |
| `SANDBOX_PRIMARY_EMAIL` | Primary persona email (Tifa, Gmail — the product inbox) |
| `SANDBOX_PRIMARY_GRANT_ID` | Nylas grant ID for primary persona |
| `SANDBOX_CLOUD_EMAIL` | Cloud persona email (supplier, Outlook) |
| `SANDBOX_CLOUD_GRANT_ID` | Nylas grant ID for Cloud persona |

**No LLM key is required for the Sandbox dry run or rule-based agent.** The LLM-powered classifier and reply generator need a DeepSeek key.

---

## Automated Integration Testing Sandbox

The Sandbox simulates real email conversations between personas using their actual email accounts via Nylas. It generates chronological, contextual, threaded email data for AI agent training, regression testing, and live demos.

### Three Scenarios

| Scenario | Steps | Description |
|----------|-------|-------------|
| `clean-po` | 3 | Supplier sends PO acknowledgement → buyer confirms → supplier ships. Clean, frictionless transaction. |
| `po-processing` | 14 | Buyer sends PO → supplier confirms → delay → QC failure → escalation → partial shipment → resolution. Two PDF attachments inline. Exception-heavy. |
| `mixed-inbox` | 6 (4 threads) | Clean PO update (replied), spam (ignored), wrong person (drafted for manager), sourcing inquiry (polite redirect). Trains the agent to distinguish reply-worthy from noise. |

### Quick Start

```bash
# Preview without sending
npm run sandbox:dry

# Live run — instant mode (no delays)
npx tsx sandbox/scripts/run-scenario.ts clean-po --fast

# Full scenario with realistic delays
npx tsx sandbox/scripts/run-scenario.ts po-processing

# Continuous generation (new thread every hour)
npx tsx sandbox/scripts/run-scenario.ts mixed-inbox --loop --loop-interval 60
```

### Testing Commands

| Command | Purpose |
|---------|---------|
| `npm run sandbox:dry` | Dry run — print all emails without sending |
| `npm run sandbox:run -- <id>` | Live run a scenario |
| `npx tsx ... --fast` | Skip all delays (demo mode) |
| `npx tsx ... --max-steps N` | Stop after N steps |
| `npx tsx ... --from-step N` | Resume from step N after a crash |
| `npm run sandbox:list` | Show all sent messages grouped by conversation |
| `npm run sandbox:inbox -- primary` | Check Tifa's real inbox |
| `npm run sandbox:reset` | Wipe state, start fresh |

### How It Works

1. A **scenario file** (TypeScript) defines personas, variables, and an ordered array of steps.
2. The **engine** (`sandbox/engine.ts`) iterates through steps: resolves `${variable}` templates, sends via Nylas with proper `In-Reply-To` headers, polls the recipient's inbox to capture the cross-grant message ID, and persists state to SQLite after every step.
3. Cross-grant threading (Gmail ↔ Outlook) works because the engine translates message IDs between Nylas grant contexts.
4. On crash, `--from-step N` reloads the saved context (PO number, subject, etc.) and resumes from the exact breakpoint.

### Writing a New Scenario

Create `sandbox/scenarios/<name>.ts` exporting a `Scenario` object. The engine dynamically imports it — no other files need to change.

---

## Autonomous Email Agent

The Agent processes a real inbox: classify → decide → act. Rule-based by default (zero dependencies); swap to LLM-powered when a DeepSeek key is configured.

### Pipeline

```
Incoming email
  │
  ├─ sensitivity.ts    — hard-rule check: payment/contract/legal?
  │
  ├─ classifier.ts     — classify into one of three actions:
  │    ├─ ignore           spam, newsletter, wrong person → do nothing
  │    ├─ auto_reply       routine business (PO updates, shipping) → reply immediately
  │    └─ draft_for_manager  sensitive or unclear → draft reply, queue for human
  │
  ├─ replyGenerator.ts — generate the reply body
  │    rule-based: template-driven, conservative
  │    LLM: natural, context-aware, model-swappable
  │
  └─ orchestrator.ts   — dispatches the action:
       auto_reply → send via Nylas → log
       draft      → store in memory → appear in daily digest
       ignore     → log and skip
```

### Rule-Based Agent (no API key)

```typescript
import { createAgent, createMemoryDraftStore } from './src/agent';

const agent = createAgent({ draftStore: createMemoryDraftStore() });
const result = await agent.process(incomingEmail);
// result.action.type: 'ignored' | 'auto_replied' | 'drafted'
```

### LLM-Powered Agent (DeepSeek)

```typescript
import {
  createAgent, createMemoryDraftStore,
  createLlmClassifier, createLlmReplyGenerator,
} from './src/agent';
import { config } from './src/config';

const agent = createAgent({
  nylasClient,           // from src/nylas/instance
  grantId: config.SANDBOX_PRIMARY_GRANT_ID,
  classifier: createLlmClassifier(config.AGENT_API_KEY, config.ANTHROPIC_BASE_URL),
  replyGenerator: createLlmReplyGenerator(config.AGENT_API_KEY, config.ANTHROPIC_BASE_URL),
  draftStore: createMemoryDraftStore(),
});
```

### Manager Daily Digest

Sensitive items are held for human review. A daily HTML digest lists every pending draft with the original email context and the agent's suggested reply.

```typescript
import { generateManagerDigest } from './src/agent';
const digest = generateManagerDigest(agent.getDrafts());
// → { subject: "📋 Agent Digest — Jun 30", htmlBody: "...", draftCount: 2 }
```

### Sensitivity Detection

Hard rules catch what must never be auto-replied: wire transfers, payment terms, invoices, contract reviews, legal language, urgent meetings. These bypass the classifier entirely and go straight to the manager queue.

### Module Structure

```
src/agent/
  sensitivity.ts       — keyword-based sensitivity checker (11 patterns)
  classifier.ts         — RuleClassifier: regex heuristics, zero-dependency
  llmClassifier.ts      — LLM classifier via Anthropic SDK (DeepSeek-compatible)
  replyGenerator.ts     — RuleReplyGenerator: template-driven, conservative
  llmReplyGenerator.ts  — LLM reply generator (DeepSeek-compatible)
  orchestrator.ts       — Agent pipeline: classify → reply → dispatch
  managerDigest.ts      — HTML digest builder for pending approvals
  index.ts              — unified exports
```

---

## Legacy: Digest Service

Vellum originally shipped an AI inbox digest (connect mailbox → cron reads → LLM summarizes → sends summary email). This feature is **paused** but the infrastructure remains:

- OAuth flow (`src/routes/auth.ts`) for connecting new mailboxes
- Webhook processing (`src/webhook/processor.ts`) for incoming mail ingestion
- Scheduler + job runner (`src/scheduler/`, `src/orchestrator/`)
- React Email templates, Gotenberg PDF generation

The Agent module reuses `NylasClient`, summarizer interfaces, and the DB layer from the digest service. The Sandbox is fully independent.

---

## Development

```bash
npm run dev       # Start Express server with hot reload
npm run build     # Compile TypeScript
npm run lint      # ESLint
```

Connect mailboxes at `http://localhost:3000/auth/connect`. Grant IDs appear in the server log or can be queried from `SELECT * FROM grants`.

---

## Design Decisions

- **Dual-architecture:** Sandbox for testing, Agent for production. Same Nylas abstraction, separate engines. Changes to one don't break the other.
- **Interface-driven LLM:** `Classifier` and `ReplyGenerator` are interfaces. Rule-based and LLM implementations are interchangeable — swap them in one line without touching the orchestrator.
- **Cross-grant threading:** Nylas message IDs are grant-scoped. The Sandbox engine polls the recipient's inbox after every send to capture the cross-grant ID for proper `In-Reply-To` headers.
- **Crash recovery:** Every step is persisted to a local SQLite DB immediately after sending. On restart, the engine reads the last completed step and resumes without regenerating variables.
- **Zero-dependency PDF generation:** Sandbox attachments are generated as valid PDFs with no external library — the format is text, so we write objects and cross-reference tables by hand.
- **Outlook throttling awareness:** The `po-processing` scenario uses 5–10 minute Cloud (Outlook) delays to avoid spam-detection freezes. Gmail (primary) delays are 0–2 minutes. `--fast` mode overrides all delays for demos.
