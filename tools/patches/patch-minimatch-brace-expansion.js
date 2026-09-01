const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..', 'node_modules');
const targetLine = "var expand = require('brace-expansion')";
const replacement = `${targetLine}
if (expand && typeof expand !== 'function' && typeof expand.expand === 'function') {
  expand = expand.expand
}`;

function patchFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  if (source.includes("typeof expand.expand === 'function'")) return false;
  if (!source.includes(targetLine)) return false;
  fs.writeFileSync(filePath, source.replace(targetLine, replacement), 'utf8');
  return true;
}

function walk(dir, patched) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '.bin') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'minimatch') {
        const target = path.join(fullPath, 'minimatch.js');
        if (fs.existsSync(target) && patchFile(target)) patched.push(target);
      }
      walk(fullPath, patched);
    }
  }
}

const patched = [];
walk(root, patched);

if (patched.length > 0) {
  console.log(`[patch-minimatch-brace-expansion] Patched ${patched.length} file(s)`);
} else {
  console.log('[patch-minimatch-brace-expansion] No changes needed');
}
