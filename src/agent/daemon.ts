/**
 * Unified agent daemon CLI.
 *
 * Usage:
 *   npx tsx src/agent/daemon.ts --persona tifa
 *   npx tsx src/agent/daemon.ts --persona cloud
 *   npx tsx src/agent/daemon.ts --persona all
 *
 * Env vars:
 *   AGENT_POLL_SECONDS        — poll interval (default: 5)
 *   MANAGER_DIGEST_FREQUENCY  — on_sensitive | every_6h | daily_4pm
 *   ANTHROPIC_API_KEY         — LLM API key
 *   ANTHROPIC_BASE_URL        — LLM base URL (default: DeepSeek)
 *   DATABASE_PATH             — path to vellum.db
 */
import { PERSONAS, type PersonaConfig } from './personas';
import { startDaemon } from './daemon-runner';
import type { DigestFrequency } from './managerDigest';

// ── CLI arg parsing ──────────────────────────────────────────────────

function parseArgs(): { personas: PersonaConfig[] } {
  const args = process.argv.slice(2);
  const personaArg = args.find(a => a.startsWith('--persona='));
  const raw = personaArg?.split('=')[1]?.toLowerCase() ?? 'tifa';

  if (raw === 'all') {
    return { personas: Object.values(PERSONAS) };
  }

  const cfg = PERSONAS[raw];
  if (!cfg) {
    console.error(`Unknown persona: "${raw}". Valid: ${Object.keys(PERSONAS).join(', ')}, all`);
    process.exit(1);
  }

  return { personas: [cfg] };
}

// ── Main ─────────────────────────────────────────────────────────────

const { personas } = parseArgs();
const pollSeconds = parseInt(process.env.AGENT_POLL_SECONDS || '5', 10);
const digestFrequency: DigestFrequency =
  (process.env.MANAGER_DIGEST_FREQUENCY as DigestFrequency) || 'on_sensitive';

const handles = personas.map(p =>
  startDaemon({ persona: p, pollSeconds, digestFrequency }),
);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n👋 Shutting down ${handles.map(h => h.label).join(' + ')}...`);
  for (const h of handles) clearInterval(h.timer);
  process.exit(0);
});
