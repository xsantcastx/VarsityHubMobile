// Patch RN LogBoxData to wrap string children in <Text> to avoid
// "Text strings must be rendered within a <Text>" warnings on RN.
const fs = require('fs');
const path = require('path');

const file = path.join(
  process.cwd(),
  'node_modules',
  'react-native',
  'Libraries',
  'LogBox',
  'Data',
  'LogBoxData.js'
);

try {
  if (!fs.existsSync(file)) {
    console.log('[patch-logbox-data] File not found, skipping');
    process.exit(0);
  }
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('/* patched */')) {
    console.log('[patch-logbox-data] Already patched');
    process.exit(0);
  }
  // Try to patch any direct string rendering in JSX
  src = src.replace(
    /({[^}]*children[^}]*})/g,
    (m) => {
      return m.replace(
        /{([^}]+)}/g,
        '{/* patched */ (typeof $1 === "string" || typeof $1 === "number") ? <Text>{$1}</Text> : $1}'
      );
    }
  );
  src = src.replace(
    /import\s+\{([^}]+)\}\s+from\s+'react-native';/,
    (m, group) => {
      if (group.includes('Text')) return m;
      return `import {${group}, Text} from 'react-native';`;
    }
  );
  fs.writeFileSync(file, src, 'utf8');
  console.log('[patch-logbox-data] Patched successfully');
} catch (e) {
  console.warn('[patch-logbox-data] Failed:', e && e.message);
}
