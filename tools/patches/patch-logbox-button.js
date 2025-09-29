// Patch Expo LogBoxButton to wrap string children in <Text> to avoid
// "Text strings must be rendered within a <Text>" warnings on RN.
// Safe for dev overlay only.
const fs = require('fs');
const path = require('path');

const file = path.join(
  process.cwd(),
  'node_modules',
  '@expo',
  'metro-runtime',
  'src',
  'error-overlay',
  'UI',
  'LogBoxButton.tsx'
);

try {
  if (!fs.existsSync(file)) {
    console.log('[patch-logbox-button] File not found, skipping');
    process.exit(0);
  }
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('/* patched */')) {
    console.log('[patch-logbox-button] Already patched');
    process.exit(0);
  }
  src = src.replace(
    /import \{ ([^}]+) \} from 'react-native';/,
    (m, group) => {
      if (group.includes('Text')) return m;
      return `import { ${group}, Text } from 'react-native';`;
    }
  );
  src = src.replace(
    /\{props\.children\}/,
    `{/* patched */ (typeof props.children === 'string' || typeof props.children === 'number') ? <Text>{String(props.children)}</Text> : props.children}`
  );
  fs.writeFileSync(file, src, 'utf8');
  console.log('[patch-logbox-button] Patched successfully');
} catch (e) {
  console.warn('[patch-logbox-button] Failed:', e && e.message);
}

