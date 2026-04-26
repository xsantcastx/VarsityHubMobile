#!/usr/bin/env node

const { spawn } = require('node:child_process');

const [, , rawIterations, ...command] = process.argv;
const iterations = Number.parseInt(rawIterations || '', 10);

if (!Number.isInteger(iterations) || iterations <= 0 || command.length === 0) {
  console.error('Usage: node scripts/repeat-command.js <iterations> <command...>');
  process.exit(1);
}

function runOnce(iteration) {
  return new Promise((resolve, reject) => {
    console.log(`\n[repeat-command] Run ${iteration}/${iterations}: ${command.join(' ')}`);
    const child = spawn(command[0], command.slice(1), {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Command terminated by signal ${signal} on run ${iteration}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code} on run ${iteration}`));
        return;
      }
      resolve();
    });

    child.on('error', reject);
  });
}

(async () => {
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    await runOnce(iteration);
  }
  console.log(`\n[repeat-command] All ${iterations} runs passed.`);
})().catch((error) => {
  console.error(`\n[repeat-command] ${error.message}`);
  process.exit(1);
});
