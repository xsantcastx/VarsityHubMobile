import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const expandableText = readFileSync(join(ROOT, 'components/ExpandableText.tsx'), 'utf8');

describe('expandable text contracts', () => {
  it('keeps the text expansion control on a Pressable with tactile feedback', () => {
    expect(expandableText).toContain('Pressable');
    expect(expandableText).toContain("android_ripple={{ color: 'rgba(37, 99, 235, 0.12)' }}");
    expect(expandableText).toContain('pressed && styles.toggleButtonPressed');
    expect(expandableText).toContain(
      "accessibilityLabel={expanded ? 'Collapse text' : 'Expand text'}"
    );
  });

  it('animates expansion instead of swapping text abruptly', () => {
    expect(expandableText).toContain(
      'LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);'
    );
    expect(expandableText).toContain('setExpanded(prev => !prev);');
  });
});
