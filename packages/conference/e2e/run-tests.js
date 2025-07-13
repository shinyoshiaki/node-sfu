#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { randomInt } from 'node:crypto';

// Generate random ports for this test run with better range
const generatePort = () => randomInt(30000, 50000);
const VITE_PORT = process.env.VITE_PORT || generatePort();
let REFERENCE_SERVER_PORT = process.env.REFERENCE_SERVER_PORT || generatePort();

// Ensure ports are different
while (REFERENCE_SERVER_PORT === VITE_PORT) {
  REFERENCE_SERVER_PORT = generatePort();
}

console.log(`Running tests with ports: VITE=${VITE_PORT}, REFERENCE_SERVER=${REFERENCE_SERVER_PORT}`);

// Pass all arguments to playwright test
const args = process.argv.slice(2);

const env = {
  ...process.env,
  VITE_PORT: String(VITE_PORT),
  REFERENCE_SERVER_PORT: String(REFERENCE_SERVER_PORT),
};

const child = spawn('npx', ['playwright', 'test', ...args], {
  env,
  stdio: 'inherit',
});

// Handle process cleanup
process.on('SIGINT', () => {
  child.kill('SIGINT');
  process.exit(130);
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
  process.exit(143);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});