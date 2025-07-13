#!/usr/bin/env zx
//@ts-check

import { $ } from 'zx';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomPort } from 'werift';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logDir = join(__dirname, 'logs');
const logFile = join(logDir, 'server.log');
const PORT = await randomPort();

// Ensure log directory exists
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

async function findProcessByPort(port) {
  try {
    const { stdout } = await $`lsof -i:${port}`.quiet();
    const lines = stdout.trim().split('\n');
    if (lines.length > 1) {
      const pid = lines[1].trim().split(/\s+/)[1];
      return pid; // Return the PID of the process using the port
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function killServerByPort(port) {
  const pid = await findProcessByPort(port);
  if (pid) {
    try {
      await $`kill -9 ${pid}`;
    } catch (error) {
      console.error(`Failed to kill process ${pid}:`, error.message);
    }
  }
}

async function startServer() {
  console.log(`Using random port: ${PORT}`);

  // Kill any existing server on the port
  await killServerByPort(PORT);

  // Wait a bit for port to be released
  await $`sleep 1`;

  // Start server with nohup and set PORT environment variable
  await $`PORT=${PORT} nohup npx tsx ${join(join(__dirname, "../reference-server/src"), 'main.ts')} > ${logFile} 2>&1 &`.catch(error => {
    console.error('Failed to start server:', error.message);
  });

  // Wait for server to start
  let attempts = 0;
  while (attempts < 30) { // 30 seconds timeout
    try {
      const response = await fetch(`http://localhost:${PORT}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet
    }
    await $`sleep 1`;
    attempts++;
  }

  throw new Error('Server failed to start within 30 seconds');
}

async function runTests(vitestArgs = []) {
  try {
    // Use xvfb-run to run tests in a virtual display and pass PORT env var
    let result;
    if (vitestArgs.length > 0) {
      result = await $`VITE_TEST_SERVER_PORT=${PORT} npx vitest run --browser.headless -- ${vitestArgs}`;
    } else {
      result = await $`VITE_TEST_SERVER_PORT=${PORT} npx vitest run --browser.headless`;
    }

    // Display test output
    console.log(result.stdout);
    if (result.stderr) {
      console.error(result.stderr);
    }

    return { success: true };
  } catch (error) {
    console.error('Tests failed:', error.message);
    // Also display the output on failure
    if (error.stdout) {
      console.log(error.stdout);
    }
    if (error.stderr) {
      console.error(error.stderr);
    }
    return { success: false, error };
  }
}

async function cleanup() {
  await killServerByPort(PORT).catch(() => { });
}

// Main execution
let testResult;
// Get command line arguments for vitest
const vitestArgs = process.argv.slice(2);

try {
  await startServer();

  testResult = await runTests(vitestArgs);
} catch (error) {
  console.error('Error:', error.message);
  testResult = { success: false, error };
} finally {
  await cleanup();
}

if (!testResult.success) {
  console.error('Test failed');
  process.exit(1);
}

// Log successful test completion with details
if (vitestArgs.length > 0) {
  console.log(`All tests passed successfully with args: ${vitestArgs.join(' ')}`);
} else {
  console.log("All tests passed successfully");
}