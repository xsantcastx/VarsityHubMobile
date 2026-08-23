import { describe, expect, it } from '@jest/globals';
import { needsEntityDecode, decodeCorruptedValue } from '../backfill-html-entity-decode.js';

describe('needsEntityDecode', () => {
  it('flags values containing a re-escaped entity', () => {
    expect(needsEntityDecode('Swimming &amp; Diving')).toBe(true);
    expect(needsEntityDecode('Coach&#39;s picks')).toBe(true);
    expect(needsEntityDecode('Q&amp;A Night')).toBe(true);
  });

  it('does not flag clean text', () => {
    expect(needsEntityDecode('Swimming & Diving')).toBe(false);
    expect(needsEntityDecode('Varsity Football')).toBe(false);
    expect(needsEntityDecode(null)).toBe(false);
    expect(needsEntityDecode('')).toBe(false);
  });
});

describe('decodeCorruptedValue', () => {
  it('decodes the corrupted value back to plain text', () => {
    expect(decodeCorruptedValue('Swimming &amp; Diving')).toBe('Swimming & Diving');
    expect(decodeCorruptedValue('Coach&#39;s picks')).toBe("Coach's picks");
  });

  it('is idempotent — re-running on already-clean text is a no-op', () => {
    const clean = decodeCorruptedValue('Swimming &amp; Diving');
    expect(decodeCorruptedValue(clean)).toBe(clean);
  });
});
