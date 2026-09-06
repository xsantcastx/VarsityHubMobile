const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hasMatchingDebugInfo } = require('./verify-native-debug-files.cjs');
const id = '8e445c90-617a-36e8-9d5a-26cb1b785c82';
test('symbol tables without DWARF information do not satisfy full line symbolication', () => {
  assert.equal(
    hasMatchingDebugInfo([{ debugId: id, data: { features: ['symtab', 'unwind'] } }], id),
    false
  );
  assert.equal(
    hasMatchingDebugInfo([{ debugId: id, data: { features: ['debug', 'symtab', 'unwind'] } }], id),
    true
  );
});
test('debug information for another binary cannot satisfy this build gate', () => {
  assert.equal(
    hasMatchingDebugInfo([{ debugId: 'wrong', data: { features: ['debug'] } }], id),
    false
  );
  assert.equal(hasMatchingDebugInfo(null, id), false);
});
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
function gatePlugin() {
  const scope = {
    module: { exports: {} },
    require: () => ({ withXcodeProject: (config, callback) => callback(config) }),
  };
  vm.runInNewContext(
    readFileSync(
      require('node:path').join(__dirname, '../plugins/withSentryNativeGate.js'),
      'utf8'
    ),
    scope
  );
  return scope.module.exports;
}
test('Expo regeneration preserves exactly one native upload verification phase', () => {
  const phase = { shellScript: '/bin/sh sentry-xcode-debug-files.sh' };
  const config = {
    modResults: {
      hash: {
        project: {
          objects: {
            PBXShellScriptBuildPhase: { one: phase, one_comment: 'Upload Debug Symbols to Sentry' },
          },
        },
      },
    },
  };
  const plugin = gatePlugin();
  plugin(config);
  plugin(config);
  assert.match(phase.shellScript, /sentry-native-release.sh/);
  assert.equal(
    Object.keys(config.modResults.hash.project.objects.PBXShellScriptBuildPhase).length,
    2
  );
});
test('a missing upload phase fails configuration instead of claiming verification', () => {
  assert.throws(
    () => gatePlugin()({ modResults: { hash: { project: { objects: {} } } } }),
    /phase missing/
  );
});
