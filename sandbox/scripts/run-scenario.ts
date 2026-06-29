#!/usr/bin/env npx tsx
/**
 * Run a sandbox email scenario.
 *
 * Usage:
 *   npx tsx sandbox/scripts/run-scenario.ts <scenario-id> [options]
 *
 * Options:
 *   --dry-run          Print emails without sending
 *   --from-step N      Resume from step N
 *   --max-steps N      Stop after N steps
 *   --loop             Re-run continuously (new thread each loop)
 *   --loop-interval N  Minutes between loops (default: 30)
 *
 * Examples:
 *   npx tsx sandbox/scripts/run-scenario.ts po-processing --dry-run
 *   npx tsx sandbox/scripts/run-scenario.ts po-processing --max-steps 3
 *   npx tsx sandbox/scripts/run-scenario.ts po-processing --loop --loop-interval 60
 */

import 'dotenv/config';
import { runScenario } from '../engine';
import type { RunOptions } from '../types';

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasArg(name: string): boolean {
  return args.includes(name);
}

const scenarioId = args[0];
if (!scenarioId) {
  console.error('Usage: npx tsx sandbox/scripts/run-scenario.ts <scenario-id> [options]');
  console.error('');
  console.error('Options:');
  console.error('  --dry-run           Print emails without sending');
  console.error('  --from-step N       Resume from step N');
  console.error('  --max-steps N       Stop after N steps');
  console.error('  --loop              Re-run continuously (new thread each loop)');
  console.error('  --loop-interval N   Minutes between loops (default: 30)');
  console.error('');
  console.error('Available scenarios: po-processing');
  process.exit(1);
}

const options: RunOptions = {
  scenarioId,
  dryRun: hasArg('--dry-run'),
  loop: hasArg('--loop'),
  startFromStep: getArg('--from-step') !== undefined
    ? parseInt(getArg('--from-step')!, 10)
    : undefined,
  maxSteps: getArg('--max-steps') !== undefined
    ? parseInt(getArg('--max-steps')!, 10)
    : undefined,
  loopIntervalMinutes: getArg('--loop-interval') !== undefined
    ? parseInt(getArg('--loop-interval')!, 10)
    : undefined,
};

if (options.startFromStep !== undefined && isNaN(options.startFromStep)) {
  console.error('Error: --from-step must be a number');
  process.exit(1);
}
if (options.maxSteps !== undefined && isNaN(options.maxSteps)) {
  console.error('Error: --max-steps must be a number');
  process.exit(1);
}

runScenario(options)
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Fatal error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
