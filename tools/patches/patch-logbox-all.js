// Patch all RN LogBox UI files to wrap string children in <Text>
const fs = require('fs');
const path = require('path');

const logboxDir = path.join(
  process.cwd(),
  'node_modules',
  'react-native',
  'Libraries',
  'LogBox'
);

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let src = fs.readFileSync(filePath, 'utf8');
  if (src.includes('/* patched */')) return;
  let changed = false;
  // Patch import
  src = src.replace(
    /import\s+\{([^}]+)\}\s+from\s+'react-native';/g,
    (m, group) => {
      if (group.includes('Text')) return m;
      changed = true;
      return `import {${group}, Text} from 'react-native';`;
    }
  );
  // Patch JSX children
  src = src.replace(
    /{([^}]+)}/g,
    (m, child) => {
      if (child.includes('props.children')) {
        changed = true;
        return '{/* patched */ (typeof props.children === "string" || typeof props.children === "number") ? <Text>{String(props.children)}</Text> : props.children}';
      }
      return m;
    }
  );
  if (changed) {
    fs.writeFileSync(filePath, src, 'utf8');
    console.log(`[patch-logbox-all] Patched: ${filePath}`);
  }
}

fs.readdirSync(logboxDir).forEach((file) => {
  if (file.endsWith('.js') || file.endsWith('.tsx')) {
    patchFile(path.join(logboxDir, file));
  }
});
