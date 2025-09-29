// Ensure node_modules/simple-swizzle/index.js exists. Some installs
// can produce a missing file on Windows; this recreates a minimal
// implementation compatible with color-string.

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'node_modules', 'simple-swizzle');
const target = path.join(dir, 'index.js');

try {
  if (!fs.existsSync(dir)) {
    console.log('[ensure-simple-swizzle] simple-swizzle not installed, skipping');
    process.exit(0);
  }
  if (fs.existsSync(target)) {
    console.log('[ensure-simple-swizzle] index.js present');
    process.exit(0);
  }

  const code = `"use strict";
var isArrayish = require('is-arrayish');
function toArray(args){return Array.prototype.slice.call(args)}
function swizzle(args){var arr=toArray(args);if(arr.length===1){var first=arr[0];if(Array.isArray(first))return first; if(isArrayish(first)) return toArray(first);} return arr;}
module.exports=function(){return swizzle(arguments)};
module.exports.wrap=function(fn){return function(){return fn(swizzle(arguments));}};
`;
  fs.writeFileSync(target, code, 'utf8');
  console.log('[ensure-simple-swizzle] Wrote fallback index.js');
} catch (err) {
  console.warn('[ensure-simple-swizzle] Failed:', err.message);
}

