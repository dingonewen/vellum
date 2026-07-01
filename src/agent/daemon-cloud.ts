/**
 * Cloud daemon — thin wrapper over the unified daemon CLI.
 *
 * Kept for backward compatibility (demo.ts spawns this as a separate process).
 * Prefer the unified entry point: npx tsx src/agent/daemon.ts --persona=cloud
 */

// Re-route to the unified daemon with the cloud persona
process.argv.push('--persona=cloud');
import('./daemon');
