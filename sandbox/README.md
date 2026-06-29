# Vellum Sandbox — Automated Integration Testing

Persona-driven email conversation simulator. Uses real Gmail accounts (via Nylas) to generate
chronological, contextual email threads for AI agent training and regression testing.

## Setup

1. **Register two Gmail accounts** (e.g. Tifa the procurement manager, Cloud the supplier).

2. **Connect both via Nylas OAuth** — start the Vellum server (`npm run dev`), visit
   `/auth/connect` for each account, and complete the OAuth flow. Note the `grantId` values
   returned in the response or stored in the DB.

3. **Add credentials to `.env`:**

```
SANDBOX_BUYER_EMAIL=cloud.strife@gmail.com
SANDBOX_BUYER_GRANT_ID=<nylas-grant-id-for-cloud>
SANDBOX_SELLER_EMAIL=tifa.lockhart@gmail.com
SANDBOX_SELLER_GRANT_ID=<nylas-grant-id-for-tifa>
```

4. **Verify connectivity:**

```bash
npm run sandbox:inbox -- seller    # Tifa's inbox
npm run sandbox:inbox -- buyer     # Cloud's inbox
```

## Usage

### Dry run (preview without sending)

```bash
npm run sandbox:dry
```

Prints every email fully resolved — subject, body, attachments, threading — without touching
the Nylas API. Always run this first when developing or modifying a scenario.

### Run a scenario

```bash
# Full run (all steps, live emails)
npx tsx sandbox/scripts/run-scenario.ts po-processing

# First 3 steps only
npx tsx sandbox/scripts/run-scenario.ts po-processing --max-steps 3

# Resume from step 7 (after a crash)
npx tsx sandbox/scripts/run-scenario.ts po-processing --from-step 7
```

### Continuous mode (loop)

```bash
# Re-run forever, new thread each cycle, 30 min between loops
npx tsx sandbox/scripts/run-scenario.ts po-processing --loop

# Custom interval: 5 minutes between loops
npx tsx sandbox/scripts/run-scenario.ts po-processing --loop --loop-interval 5
```

Each loop generates an independent email thread with fresh timestamps and PO numbers.

### Inspect state

```bash
npm run sandbox:list              # all scenarios
npm run sandbox:list -- po-processing  # one scenario
```

### Reset state

```bash
npm run sandbox:reset             # wipe everything
npm run sandbox:reset -- po-processing  # wipe one scenario
```

## Scenarios

### `po-processing` — Purchase Order Processing (14 steps)

Tifa (procurement manager at Shinra Manufacturing) sends a PO for 500 precision bearings to
Cloud (sales rep at Nibelheim Precision Parts). Production delays, a QC failure, and escalating
urgency drive a 14-email thread across two weeks.

| Phase | Steps | What happens |
|-------|-------|-------------|
| Order placement | 0–3 | Tifa sends PO with PDF attachment, Cloud confirms, production schedule shared |
| Production (quiet) | 4–5 | Mid-point check-in, everything on track |
| Crisis | 6–9 | Deadline missed, QC failure revealed, partial shipment, anger, daily updates enforced |
| Resolution | 10–13 | Final shipment with tracking, receipt confirmed, relationship repair, Q3 discussion |

**Thread structure:** Single thread — all replies chain from the initial PO email.

**Attachments:** Two PDFs generated inline — the PO document (Step 0) and QC Report (Step 9).

## Architecture

```
sandbox/
  engine.ts                  # Core orchestrator
  types.ts                   # Scenario DSL types
  persona.ts                 # Character identities (env-configured)
  db.ts                      # Thread state SQLite (data/sandbox.db)
  pdf.ts                     # Minimal PDF generator
  scenarios/
    po-processing.ts         # 14-step procurement scenario
  scripts/
    run-scenario.ts          # CLI entry point
    list-threads.ts          # Inspect sent messages
    reset.ts                 # Wipe state
    check-inbox.ts           # Verify inbox delivery
```

The sandbox reuses the project's `NylasClient` interface and types — it sends real emails
through the Nylas API, which Gmail groups into conversations via `In-Reply-To` / `References`
headers.

## Writing New Scenarios

Create a file in `sandbox/scenarios/` exporting a `Scenario` object:

```typescript
import type { Scenario } from '../types';

export const scenario: Scenario = {
  id: 'my-scenario',
  name: 'My Scenario (N steps)',
  description: 'What this scenario simulates.',
  initialContext: {
    buyer_name: 'Cloud',
    seller_name: 'Tifa',
    buyer_email: '',
    seller_email: '',
    // ... your scenario-specific variables
  },
  steps: [
    {
      senderId: 'seller',           // Tifa sends (uses SANDBOX_SELLER_*)
      replyToStepIndex: undefined,  // new thread
      subjectTemplate: 'Subject with ${variable}',
      bodyTemplate: '<p>HTML body with ${variable}</p>',
      delaySeconds: { min: 30, max: 120 },
      variables: { key: 'value' },  // merged into context for subsequent steps
      attachments: [               // optional
        {
          filename: 'doc.pdf',
          contentType: 'application/pdf',
          bodyTemplate: 'Plain text content — templates work here too: ${po_number}',
        },
      ],
    },
    // ... more steps
  ],
};
```

`${variable}` placeholders are resolved against the accumulated context — each step can add
new variables via the `variables` field, and all previous variables remain available.
