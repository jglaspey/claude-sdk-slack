#!/usr/bin/env node
// Node.js wrapper to spawn Claude CLI
// This bypasses shell script issues in Docker

const { spawn } = require('child_process');

// Use absolute path to node and CLI
const nodePath = '/usr/local/bin/node';
const cliPath = '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js';

// Ensure PATH includes /usr/local/bin
const env = {
  ...process.env,
  PATH: '/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin'
};

const child = spawn(nodePath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
