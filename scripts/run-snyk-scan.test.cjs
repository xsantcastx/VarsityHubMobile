const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classify, safeSarif } = require('./run-snyk-scan.cjs');
test('distinguishes findings, clean and missing coverage', () => {
  assert.equal(classify({ vulnerabilities: [] }, 0, 'dependencies').status, 'clean');
  assert.equal(
    classify({ ok: false, vulnerabilities: [{ id: 'test' }] }, 1, 'dependencies').status,
    'findings'
  );
  assert.equal(classify({ runs: [{ results: [] }] }, 0, 'code').status, 'clean');
  assert.equal(classify({ runs: [{ results: [{}] }] }, 1, 'code').status, 'findings');
  for (const [result, code] of [
    [undefined, 1],
    [{ error: 'Forbidden' }, 1],
    [{ runs: [] }, 0],
    [{ runs: [{ results: [] }] }, 1],
    [{ runs: [{ results: [], invocations: [{ executionSuccessful: false }] }] }, 0],
  ]) {
    assert.equal(classify(result, code, 'code').status, 'unavailable');
  }
  assert.equal(classify({ vulnerabilities: [] }, 2, 'dependencies').exitCode, 2);
});

test('retains actionable locations without copying sensitive source snippets', () => {
  const result = safeSarif({
    runs: [
      {
        results: [
          {
            ruleId: 'hardcoded-secret',
            level: 'error',
            message: { text: 'SECRET_CONTENT' },
            fixes: [{ description: 'SECRET_CONTENT' }],
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: 'server/src/example.ts' },
                  region: { startLine: 12, snippet: { text: 'SECRET_CONTENT' } },
                },
              },
            ],
          },
        ],
      },
    ],
  });
  assert.ok(!JSON.stringify(result).includes('SECRET_CONTENT'));
  assert.equal(result.runs[0].results[0].locations[0].physicalLocation.region.startLine, 12);
});
