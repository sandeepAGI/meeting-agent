#!/usr/bin/env node
/**
 * Electron Script Runner
 *
 * Runs TypeScript scripts using Electron's Node.js runtime (MODULE_VERSION 139)
 * instead of system Node.js. This ensures tests run in the same environment
 * as production.
 *
 * Usage:
 *   node scripts/electron-runner.js <script.ts> [args...]
 *
 * Example:
 *   node scripts/electron-runner.js scripts/test-full-pipeline.ts test.json
 */

const { spawn } = require('child_process');
const path = require('path');

// Get script path and args
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node scripts/electron-runner.js <script.ts> [args...]');
  process.exit(1);
}

const scriptPath = args[0];
const scriptArgs = args.slice(1);

// Path to electron executable
const electronPath = path.join(__dirname, '../node_modules/.bin/electron');

// Create a minimal Electron main.js that runs the script
const runnerCode = `
// Register ts-node for TypeScript support
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

// Run the script
const scriptPath = process.argv[process.argv.indexOf('--script') + 1];
const scriptArgs = process.argv.slice(process.argv.indexOf('--script') + 2);

// Override process.argv for the script
process.argv = [process.argv[0], scriptPath, ...scriptArgs];

// Run the script
require(scriptPath);
`;

// Write temporary runner file
const fs = require('fs');
const os = require('os');
const tmpRunner = path.join(os.tmpdir(), `electron-runner-${Date.now()}.js`);
fs.writeFileSync(tmpRunner, runnerCode);

// Run electron with the runner
const electron = spawn(
  electronPath,
  [tmpRunner, '--script', path.resolve(scriptPath), ...scriptArgs],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1', // Run as Node.js, not GUI
      NODE_PATH: path.join(__dirname, '../node_modules') // Help find modules
    }
  }
);

electron.on('close', (code) => {
  // Cleanup
  try {
    fs.unlinkSync(tmpRunner);
  } catch (e) {
    // Ignore cleanup errors
  }
  process.exit(code);
});

electron.on('error', (err) => {
  console.error('Failed to start electron:', err);
  process.exit(1);
});
