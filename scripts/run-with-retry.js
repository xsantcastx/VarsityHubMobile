#!/usr/bin/env node

const { spawn } = require('node:child_process');
const fs = require('node:fs');

const [, , rawAttempts, ...command] = process.argv;
const maxAttempts = Number.parseInt(rawAttempts || '', 10);

if (!Number.isInteger(maxAttempts) || maxAttempts <= 0 || command.length === 0) {
  console.error('Usage: node scripts/run-with-retry.js <maxAttempts> <command...>');
  process.exit(1);
}

function appendSummary(message) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  try {
    fs.appendFileSync(summaryPath, `${message}\n`);
  } catch {
    // Summary write failures should never affect the job result.
  }
}

function runAttempt(attempt) {
  return new Promise((resolve, reject) => {
    console.log(`\n[run-with-retry] Attempt ${attempt}/${maxAttempts}: ${command.join(' ')}`);
    const child = spawn(command[0], command.slice(1), {
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Command terminated by signal ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

(async () => {
  let lastExitCode = 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastExitCode = await runAttempt(attempt);

    if (lastExitCode === 0) {
      if (attempt > 1) {
        const recoveredMessage = `### Flake Recovered\nCommand passed on retry ${attempt}/${maxAttempts}: \`${command.join(' ')}\``;
        console.warn(`[run-with-retry] Command passed on retry ${attempt}/${maxAttempts}`);
        appendSummary(recoveredMessage);
      }
      process.exit(0);
    }

    if (attempt < maxAttempts) {
      console.warn(`[run-with-retry] Command failed with exit code ${lastExitCode}. Retrying...`);
    }
  }

  appendSummary(`### Persistent Failure\nCommand failed after ${maxAttempts} attempts: \`${command.join(' ')}\``);
  console.error(`[run-with-retry] Command failed after ${maxAttempts} attempts.`);
  process.exit(lastExitCode);
})().catch((error) => {
  console.error(`[run-with-retry] ${error.message}`);
  process.exit(1);
});
