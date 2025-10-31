#!/usr/bin/env node
// Node.js wrapper to spawn Claude CLI
// This bypasses shell script issues in Docker

const { spawn } = require('child_process');
const path = require('path');

// Spawn the actual Claude CLI with all arguments
const cliPath = '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js';
const child = spawn(process.execPath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
