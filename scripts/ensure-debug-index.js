// Ensures node_modules/debug/src/index.js exists. Some installs miss this file on Windows.
const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'node_modules', 'debug', 'src', 'index.js');
try {
  if (!fs.existsSync(file)) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const content = `// Auto-generated shim to fix truncated installs on Windows\nmodule.exports = require('./node.js');\n`;
    fs.writeFileSync(file, content, 'utf8');
    console.log('[ensure-debug-index] Created debug/src/index.js shim');
  } else {
    // console.log('[ensure-debug-index] Found debug/src/index.js');
  }
} catch (e) {
  console.warn('[ensure-debug-index] Failed:', e && e.message);
}

