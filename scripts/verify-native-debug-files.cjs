#!/usr/bin/env node
const { execFileSync } = require('node:child_process');

function hasMatchingDebugInfo(files, debugId) {
  return (
    Array.isArray(files) &&
    files.some(
      file =>
        String(file.debugId || '').toLowerCase() === debugId.toLowerCase() &&
        file.data?.features?.includes('debug')
    )
  );
}
async function verify(debugIds, env = process.env) {
  if (!env.SENTRY_AUTH_TOKEN)
    throw new Error('SENTRY_AUTH_TOKEN is required for native symbol verification');
  const org = env.SENTRY_ORG || 'lime-productions',
    project = env.SENTRY_PROJECT || 'varsityhub';
  for (const debugId of debugIds) {
    if (!/^[a-f0-9-]{36}$/i.test(debugId)) throw new Error('Invalid native debug UUID');
    let found = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      const response = await fetch(
        `https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/files/dsyms/?query=${encodeURIComponent(debugId)}`,
        {
          headers: { Authorization: `Bearer ${env.SENTRY_AUTH_TOKEN}` },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (!response.ok) throw new Error(`Native symbol verification HTTP ${response.status}`);
      if (hasMatchingDebugInfo(await response.json(), debugId)) {
        found = true;
        break;
      }
      if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 5000));
    }
    if (!found) throw new Error(`Full native debug information missing for ${debugId}`);
  }
  console.log(`Verified full native debug information for ${debugIds.length} UUID(s)`);
}
if (require.main === module) {
  let ids = process.argv.slice(2);
  try {
    if (!ids.length) {
      const dir = process.env.DWARF_DSYM_FOLDER_PATH;
      const name = process.env.DWARF_DSYM_FILE_NAME;
      if (!dir || !name) throw new Error('Xcode dSYM path is required');
      const path = require('node:path').join(dir, name);
      const output = execFileSync('xcrun', ['dwarfdump', '--uuid', path], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      ids = [...output.matchAll(/UUID: ([A-Fa-f0-9-]{36})/g)].map(match => match[1]);
      if (!ids.length) throw new Error('No native UUID found in application dSYM');
    }
    verify(ids).catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { hasMatchingDebugInfo, verify };
