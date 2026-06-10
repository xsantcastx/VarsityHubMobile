import fs from 'node:fs';
import path from 'node:path';

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8');

describe('theme surface contract', () => {
  it('keeps the flagged readability regressions on theme-driven surfaces', () => {
    const actionModal = read('components', 'CustomActionModal.tsx');
    const zipAlternatives = read('components', 'ZipAlternativesModal.tsx');
    // ZipCodeMapPreview is now a thin wrapper — the map surface lives in GeocodedMapPreview
    const zipPreview = read('components', 'GeocodedMapPreview.tsx');
    const seasonStats = read('app', 'season-stats.tsx');

    expect(actionModal).toContain(
      'backgroundColor: opt.isDestructive ? destructiveButtonBackground : theme.surface'
    );
    expect(actionModal).toContain(
      'borderColor: opt.isDestructive ? destructiveButtonBorder : theme.border'
    );
    expect(actionModal).not.toContain("backgroundColor: '#f3f4f6'");
    expect(actionModal).not.toContain("backgroundColor: '#fee2e2'");

    expect(zipAlternatives).toContain("const errorSurface = colorScheme === 'dark' ?");
    expect(zipAlternatives).toContain("const infoSurface = colorScheme === 'dark' ?");
    expect(zipAlternatives).toContain(
      '{ backgroundColor: theme.background, borderColor: theme.border }'
    );
    expect(zipAlternatives).toContain(
      "backgroundColor: colorScheme === 'dark' ? theme.border : '#D1D5DB'"
    );
    expect(zipAlternatives).not.toContain("backgroundColor: '#FEE2E2'");
    expect(zipAlternatives).not.toContain("backgroundColor: '#DBEAFE'");
    expect(zipAlternatives).not.toContain("backgroundColor: '#F9FAFB'");
    expect(zipAlternatives).not.toContain("borderColor: '#D1D5DB'");

    expect(zipPreview).toContain(
      '[styles.mapWrapper, { backgroundColor: Colors[colorScheme].surface }]'
    );
    expect(zipPreview).not.toMatch(/backgroundColor: '#f5f5f5'/i);

    expect(seasonStats).toContain('const theme = Colors[colorScheme];');
    expect(seasonStats).toContain('[styles.tabContainer, { backgroundColor: theme.surface }]');
    expect(seasonStats).toContain('[styles.percentageTrack, { backgroundColor: theme.border }]');
    expect(seasonStats).toContain('[styles.playerRank, { backgroundColor: theme.card }]');
    expect(seasonStats).not.toContain("backgroundColor: '#F8FAFC'");
    expect(seasonStats).not.toContain("backgroundColor: '#D1D5DB'");
    expect(seasonStats).not.toContain("backgroundColor: '#F3F4F6'");
    expect(seasonStats).not.toContain('Colors.light.mutedText');
  });
});
