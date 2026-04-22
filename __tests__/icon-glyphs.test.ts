import fs from 'fs';
import path from 'path';

const materialGlyphs = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json');
const ioniconGlyphs = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');

type IconHit = {
  file: string;
  line: number;
  iconSet: 'MaterialIcons' | 'Ionicons';
  name: string;
};

function collectStaticIconUsages(iconSet: 'MaterialIcons' | 'Ionicons'): IconHit[] {
  const roots = ['app', 'components'].map((dir) => path.join(process.cwd(), dir));
  const files: string[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  };

  roots.forEach(walk);

  const matcher = new RegExp(`<${iconSet}\\s+name="([^"]+)"`, 'g');
  const hits: IconHit[] = [];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const lines = source.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      let match: RegExpExecArray | null;
      matcher.lastIndex = 0;
      while ((match = matcher.exec(line)) !== null) {
        hits.push({
          file: path.relative(process.cwd(), file),
          line: index + 1,
          iconSet,
          name: match[1],
        });
      }
    }
  }

  return hits;
}

describe('static icon names', () => {
  it('uses valid MaterialIcons names', () => {
    const hits = collectStaticIconUsages('MaterialIcons');
    const invalid = hits.filter((hit) => !Object.prototype.hasOwnProperty.call(materialGlyphs, hit.name));
    expect(invalid).toEqual([]);
  });

  it('uses valid Ionicons names', () => {
    const hits = collectStaticIconUsages('Ionicons');
    const invalid = hits.filter((hit) => !Object.prototype.hasOwnProperty.call(ioniconGlyphs, hit.name));
    expect(invalid).toEqual([]);
  });
});
