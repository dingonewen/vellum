#!/usr/bin/env npx tsx
/**
 * Reset sandbox state so scenarios can be re-run from scratch.
 *
 * Usage:
 *   npx tsx sandbox/scripts/reset.ts [scenario-id|--all]
 *
 * If no argument, resets all scenarios.
 */

import 'dotenv/config';
import { resetState } from '../db';

const arg = process.argv[2];
const target = arg === '--all' ? undefined : arg;

const label = target ?? 'all scenarios';
console.log(`Resetting sandbox state: ${label}...`);
resetState(target);
console.log('Done.');
