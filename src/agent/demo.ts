/**
 * Dual-agent demo — runs Tifa + Cloud daemons in-process, then fires a
 * curated mix of sandbox scenarios to generate ~20+ rich threaded email
 * conversations across the two inboxes.
 *
 * Scenario mix:
 *   clean-po ×6       →  6 threads, 3 emails each (clean transaction)
 *   mixed-inbox ×3    → 12 threads, varied (spam, wrong-person, sourcing)
 *   po-processing ×1  →  1 thread, 14 emails (exception-heavy epic)
 *   buyer-inbox ×1    → 20 threads, agent handles all replies (PO + noise)
 *                     ──
 *                     ~39 threads total
 *
 * Usage:
 *   npm run demo
 *   npx tsx src/agent/demo.ts
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { PERSONAS } from './personas';
import { startDaemon } from './daemon-runner';

const POLL_SECONDS = 3;
const ROOT = path.resolve(__dirname, '..', '..');

// ── Scenario playlist ─────────────────────────────────────────────────

interface PlaylistEntry {
  id: string;
  count: number;
  label: string; // human-readable for console
}

const PLAYLIST: PlaylistEntry[] = [
  { id: 'clean-po',      count: 6, label: 'clean PO transactions (3-step threads)' },
  { id: 'mixed-inbox',   count: 3, label: 'mixed inbox (spam / wrong-person / sourcing)' },
  { id: 'po-processing', count: 1, label: 'PO exception epic (14-step thread)' },
  { id: 'buyer-inbox',   count: 1, label: '20 diverse initial emails (agent-driven replies)' },
];

// ── Helpers ───────────────────────────────────────────────────────────

function runScenario(scenarioId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', 'sandbox/scripts/run-scenario.ts', scenarioId, '--fast'], {
      stdio: 'inherit',
      shell: true,
      cwd: ROOT,
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`"${scenarioId}" exited with code ${code}`));
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting dual-agent demo (in-process)...\n');

  // Start both daemons in-process
  const tifaHandle = startDaemon({
    persona: PERSONAS.tifa,
    pollSeconds: POLL_SECONDS,
  });

  const cloudHandle = startDaemon({
    persona: PERSONAS.cloud,
    pollSeconds: POLL_SECONDS,
  });

  // Let daemons finish their initial poll before firing scenarios
  console.log('⏳ Waiting for daemons to initialize...\n');
  await sleep(3000);

  // ── Run playlist ──────────────────────────────────────────────────

  let scenarioIndex = 0;
  const totalRuns = PLAYLIST.reduce((sum, e) => sum + e.count, 0);

  for (const entry of PLAYLIST) {
    for (let i = 0; i < entry.count; i++) {
      scenarioIndex++;
      console.log(`\n📧 [${scenarioIndex}/${totalRuns}] ${entry.label} (${i + 1}/${entry.count})\n`);

      try {
        await runScenario(entry.id);
      } catch (err) {
        console.error(`  ⚠ ${(err as Error).message}`);
      }

      // Short gap between scenarios — agents poll and process in between
      if (scenarioIndex < totalRuns) {
        console.log('  ⏸  Waiting for agents to catch up...\n');
        await sleep(4000);
      }
    }
  }

  // ── Keep running ──────────────────────────────────────────────────

  console.log('\n✅ All scenarios complete. Agents are still watching for follow-ups.');
  console.log('   Ctrl+C to stop all agents.\n');
}

// ── Graceful shutdown ─────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

main().catch((err) => {
  console.error('Demo failed:', err.message);
  process.exit(1);
});
