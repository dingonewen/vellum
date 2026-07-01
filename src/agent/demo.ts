import { spawn } from 'child_process';
import * as path from 'path';

const agentDir = path.resolve(__dirname, '..', 'agent');

console.log('🚀 Starting dual-agent demo...\n');

// Start Tifa daemon
const tifa = spawn('npx', ['tsx', path.join(agentDir, 'daemon.ts')], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, AGENT_POLL_SECONDS: '3' },
});
console.log('🤖 Tifa agent started');

// Start Cloud daemon
const cloud = spawn('npx', ['tsx', path.join(agentDir, 'daemon-cloud.ts')], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, AGENT_POLL_SECONDS: '3' },
});
console.log('☁️  Cloud agent started');

// Wait for daemons to initialize, then fire sandbox
setTimeout(() => {
  console.log('\n📧 Firing 20 initial emails to Tifa\'s inbox...\n');

  const sandbox = spawn('npx', ['tsx', 'sandbox/scripts/run-scenario.ts', 'buyer-inbox', '--fast'], {
    stdio: 'inherit',
    shell: true,
    cwd: path.resolve(__dirname, '..', '..'),
  });

  sandbox.on('close', () => {
    console.log('\n✅ Initial emails sent. Agents are processing...');
    console.log('   Watch Tifa\'s inbox: npx tsx sandbox/scripts/check-inbox.ts primary 30');
    console.log('   Ctrl+C to stop all agents.\n');
  });
}, 2000);

// Cleanup on exit
process.on('SIGINT', () => {
  tifa.kill();
  cloud.kill();
  process.exit(0);
});
