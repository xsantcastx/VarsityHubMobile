/**
 * Unit tests for messageHelpers (buildConversationId)
 */
import { describe, expect, it } from '@jest/globals';
import { buildConversationId } from '../lib/messageHelpers.js';

describe('buildConversationId', () => {
  it('produces deterministic ID regardless of argument order', () => {
    const id1 = buildConversationId('userA', 'userB');
    const id2 = buildConversationId('userB', 'userA');
    expect(id1).toBe(id2);
  });

  it('uses dm: prefix', () => {
    const id = buildConversationId('a', 'b');
    expect(id).toMatch(/^dm:/);
  });

  it('sorts user IDs lexicographically', () => {
    const id = buildConversationId('zebra', 'alpha');
    expect(id).toBe('dm:alpha__zebra');
  });

  it('handles string coercion', () => {
    const id = buildConversationId('123' as any, '456' as any);
    expect(id).toBe('dm:123__456');
  });
});
