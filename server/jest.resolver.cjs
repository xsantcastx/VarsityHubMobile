const fs = require('node:fs');

function traceResolution(request, resolved) {
  const target = process.env.JEST_RESOLVE_TRACE_FILE;
  if (!target) return;
  try {
    fs.appendFileSync(target, `${request} => ${resolved}\n`);
  } catch {
    // Ignore trace write failures.
  }
}

module.exports = (request, options) => {
  try {
    const resolved = options.defaultResolver(request, options);
    traceResolution(request, resolved);
    return resolved;
  } catch (error) {
    if (!/^\.\.?\//.test(request) || !request.endsWith('.js')) {
      throw error;
    }

    const candidates = [
      request.replace(/\.js$/, '.ts'),
      request.replace(/\.js$/, '.tsx'),
      request.replace(/\/index\.js$/, '/index.ts'),
      request.replace(/\/index\.js$/, '/index.tsx'),
    ];

    for (const candidate of candidates) {
      try {
        const resolved = options.defaultResolver(candidate, options);
        traceResolution(request, resolved);
        return resolved;
      } catch {
        // Try next candidate.
      }
    }

    throw error;
  }
};
