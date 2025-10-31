#!/usr/bin/env node
// Node.js wrapper to spawn Claude CLI
// This bypasses shell script issues in Docker

const { spawn } = require('child_process');
const fs = require('fs');

// Use absolute path to node and CLI
const nodePath = '/usr/local/bin/node';
const cliPath = '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js';

// Debug logging
console.error('[WRAPPER] Starting wrapper');
console.error('[WRAPPER] Node path:', nodePath);
console.error('[WRAPPER] Node exists:', fs.existsSync(nodePath));
console.error('[WRAPPER] CLI path:', cliPath);
console.error('[WRAPPER] CLI exists:', fs.existsSync(cliPath));
console.error('[WRAPPER] Args:', process.argv.slice(2));
console.error('[WRAPPER] PATH:', process.env.PATH);

// Ensure PATH includes /usr/local/bin
const env = {
  ...process.env,
  PATH: '/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin'
};

console.error('[WRAPPER] Spawning with env PATH:', env.PATH);

const child = spawn(nodePath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: env
});

child.on('error', (err) => {
  console.error('[WRAPPER] Spawn error:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  console.error('[WRAPPER] Child exited with code:', code);
  process.exit(code || 0);
});
