# emailorning

An AI inbox digest service. Connects to your mailbox via Nylas, watches for incoming email via webhook, and periodically emails you an AI-written summary so you can skip the firehose.

---

## Architecture

A single Express + TypeScript server with SQLite for persistence and node-cron for scheduling. No separate services or queues required — the DB is the source of truth for everything durable.

```
Browser → /auth/connect → Nylas hosted OAuth → /auth/callback → grantId stored in SQLite
Nylas   → POST /webhooks/nylas → HMAC verified → messageId enqueued → async processor fetches + stores
node-cron (every 1 min) → claimDue() → InboxReader → Summarizer → EmailSender → digest email sent
```

---

## Prerequisites

- Node.js 20+
- A [Nylas](https://nylas.com) account (free tier is enough)
- An Anthropic API key
- An Ubuntu VM with a public IP (for webhook delivery and OAuth callbacks)

---

## Nylas App Setup (from scratch)

1. Sign up at [dashboard.nylas.com](https://dashboard.nylas.com)
2. Create a new application
3. Note your **API Key** and **Client ID** from the app settings
4. Under **OAuth → Callback URIs**, add your public callback URL (e.g. `https://your-domain/auth/callback`)
5. Under **Connectors**, enable the email providers you want to support (Google, Microsoft, etc.)
6. Under **Webhooks**, add a webhook pointing at `https://your-domain/webhooks/nylas` with trigger `message.created` — copy the **signing secret** shown after creation

---

## Installation

```bash
git clone https://github.com/dingonewen/emailorning.git
cd emailorning
npm install
cp .env.example .env
# fill in .env with your keys
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NYLAS_API_KEY` | Nylas API key (also used as client secret for OAuth code exchange) |
| `NYLAS_CLIENT_ID` | Nylas OAuth client ID |
| `NYLAS_WEBHOOK_SECRET` | Signing secret from Nylas webhook settings (optional at startup, required for webhook delivery) |
| `NYLAS_API_URI` | Nylas API base URL (default: `https://api.us.nylas.com`) |
| `APP_BASE_URL` | Public base URL of this server |
| `CALLBACK_URL` | OAuth callback URL (must be registered in Nylas Dashboard) |
| `PORT` | HTTP port (default: `3000`) |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI summarization |
| `ANTHROPIC_MODEL` | Claude model to use (default: `claude-haiku-4-5-20251001`) |
| `DATABASE_PATH` | SQLite database file path (default: `./data/emailorning.db`) |

---

## Running

### Development (local)

```bash
npm run dev
```

### Production (VM)

```bash
npm run build
pm2 start dist/server.js --name emailorning
pm2 save
pm2 startup  # auto-start on reboot
```

---

## Exposing the Webhook (HTTPS on the VM)

Nylas requires HTTPS for OAuth callback URIs and webhook endpoints. On the Ubuntu VM, we use **Caddy + sslip.io**:

- `sslip.io` is a free wildcard DNS service — `40-160-15-19.sslip.io` resolves to `40.160.15.19`
- Caddy automatically obtains a Let's Encrypt certificate for the hostname
- No domain name purchase or manual certificate management required

```bash
# Install Caddy
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Configure (replace IP dashes to match your VM)
sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
YOUR-IP-WITH-DASHES.sslip.io {
    reverse_proxy localhost:3000
}
EOF

sudo systemctl restart caddy
```

Set `APP_BASE_URL` and `CALLBACK_URL` to use the `sslip.io` hostname.

---

## End-to-End Flow

### 1. Connect a mailbox

Visit `https://your-domain/auth/connect` in a browser. This redirects to Nylas hosted OAuth where the user picks their email provider. After authorizing, Nylas redirects to `/auth/callback` which exchanges the code for a `grantId` and persists it in SQLite.

### 2. Configure your digest cadence

```bash
curl -X POST https://your-domain/config \
  -H "Content-Type: application/json" \
  -d '{
    "email": "connected@gmail.com",
    "destEmail": "you@anywhere.com",
    "cronExpr": "0 8 * * *"
  }'
```

`cronExpr` is a standard 5-field cron expression. Examples:
- `* * * * *` — every minute (for testing)
- `0 * * * *` — hourly
- `0 8 * * *` — daily at 8am UTC

### 3. Incoming mail is collected via webhook

When a new email arrives, Nylas POSTs to `/webhooks/nylas`. The handler:
1. Verifies the `x-nylas-signature` HMAC with `timingSafeEqual`
2. Returns 200 immediately
3. Enqueues the `messageId` into `pending_messages`

A background processor polls every 5 seconds, claims a batch atomically, refetches each full message from Nylas, and upserts it into the `messages` table (`INSERT OR IGNORE` for deduplication).

### 4. Scheduled digest is sent

Every minute, node-cron fires and calls `claimDue()` — an atomic SQLite transaction that finds a due schedule and claims it. The job runner:
1. Fetches messages since `last_summary_at` via the Nylas API (paginated, max 200)
2. Passes them to the AI summarizer (Anthropic Claude)
3. Sends the HTML digest via Nylas to the destination address
4. Updates `last_summary_at` and computes the next fire time

If there are no new messages, the digest is skipped (no empty emails sent).

---

## Design Decisions & Tradeoffs

### Scheduling: DB-backed atomic claim

**Mechanism:** `node-cron` polls every minute. All schedule state (`next_fire_at`, `last_summary_at`, `claimed_at`) lives in SQLite.

**How the three requirements are met:**

| Requirement | How |
|-------------|-----|
| Survives restart | `next_fire_at` is persisted in SQLite, not RAM |
| Per-user | One row per `grantId` in `schedules` table |
| Fires once | `UPDATE schedules SET claimed_at = ? WHERE claimed_at IS NULL AND next_fire_at <= ?` — only the process that wins the UPDATE proceeds |

**Tradeoff:** SQLite's single-writer model means this scales to one process. For multi-instance deployments, PostgreSQL with `SELECT FOR UPDATE SKIP LOCKED` would be the upgrade path. For this single-VM challenge, SQLite is the right fit — zero setup, ACID guarantees, and the atomic UPDATE pattern gives the fires-once guarantee without a separate lock service.

### Webhook deduplication

Two layers:
1. **Pending queue**: `pending_messages` table — duplicates are wasteful but harmless
2. **Messages table**: `INSERT OR IGNORE INTO messages ... UNIQUE(message_id)` — the authoritative dedup. Even if the same event is delivered and processed twice, the second insert is a no-op.

Truncated payloads are handled by always refetching the full message from Nylas in the processor (we never trust webhook payload data for the message body).

### AI summarizer seam

`assemblePrompt(messages)` and `parseResponse(text, count)` are pure functions — no I/O, no side effects. They can be unit-tested with fixture data without any API key. The `Summarizer` interface is the boundary the orchestrator depends on; tests can stub it with `{ summarize: async () => fixedResult }`.

The prompt asks Claude for HTML output (no `<html>`/`<body>` tags) structured around: threads needing attention, asks awaiting a reply, deadlines, and general activity. Snippets are capped at 300 characters per message to keep prompt size predictable.

### External dependency interfaces

All external calls (Nylas API, Anthropic API) are behind TypeScript interfaces (`NylasClient`, `Summarizer`, `EmailSender`, `InboxReader`). A live mailbox is not required to test the orchestration logic — stub any interface to return fixture data.

---

## Assumptions

- **First run lookback**: When no previous summary exists, the job fetches the last 24 hours of inbox.
- **Max messages per summary**: Capped at 200 to keep prompt size and latency bounded. If more arrive in a window, the oldest 200 are summarized.
- **OAuth state**: CSRF nonces are stored in an in-memory Map with a 10-minute TTL. They do not survive a process restart (acceptable — a restart during an OAuth flow just requires the user to re-click connect).
- **Cadence as cron expression**: The `cronExpr` field stores a standard 5-field cron expression. The `cron-parser` library computes `nextFireAt` from it.

---

## What I'd Do With More Time

- **Unit tests** for `assemblePrompt`, `parseResponse`, `ScheduleStore.claimDue`, and `MessageStore.upsertMessage` using `initDb(":memory:")` fixtures
- **Web UI** — a minimal HTML page for connecting the mailbox and configuring cadence, instead of raw curl commands
- **Webhook retry handling** — currently a failed message fetch leaves the claim set until the 1-hour stale-claim TTL releases it; exponential backoff with a retry counter would be better
- **Multi-grant scheduler iteration** — `claimDue()` claims one schedule per minute; with many users, a batch claim would be more efficient
- **OAuth state persistence** — store nonces in SQLite rather than an in-memory Map so they survive restarts
- **Rate limiting** on the webhook endpoint to mitigate replay attacks beyond HMAC verification
- **PM2 ecosystem file** for consistent environment configuration instead of relying on `.env` being present on the VM
