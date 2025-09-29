// Ensures a minimal is-arrayish implementation exists to satisfy
// simple-swizzle/color-string on Windows when installs are incomplete.
const fs = require('fs');
const path = require('path');

function writeIfMissing(dir) {
  try {
    const target = path.join(dir, 'index.js');
    if (!fs.existsSync(dir)) return false;
    if (fs.existsSync(target)) return true;
    const code = `"use strict";\nmodule.exports = function isArrayish(obj){\n  if (!obj) return false;\n  if (Array.isArray(obj)) return true;\n  // Strings are array-like but should not be treated as arrayish here
  if (typeof obj === 'string') return false;\n  return typeof obj.length === 'number';\n};\n`;
    fs.writeFileSync(target, code, 'utf8');
    console.log('[ensure-is-arrayish] Wrote fallback at', target);
    return true;
  } catch (e) {
    console.warn('[ensure-is-arrayish] Failed:', e && e.message);
    return false;
  }
}

const root = path.join(__dirname, '..', 'node_modules', 'is-arrayish');
const nested = path.join(__dirname, '..', 'node_modules', 'simple-swizzle', 'node_modules', 'is-arrayish');

let ok = false;
if (fs.existsSync(root) || fs.existsSync(nested)) {
  ok = writeIfMissing(root) || writeIfMissing(nested);
} else {
  // If neither dir exists, create top-level and write
  try {
    fs.mkdirSync(root, { recursive: true });
    ok = writeIfMissing(root);
  } catch (e) {
    console.warn('[ensure-is-arrayish] Could not create root dir:', e && e.message);
  }
}

if (!ok) {
  console.log('[ensure-is-arrayish] Nothing to do');
}

