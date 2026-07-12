import { describe, expect, it } from '@jest/globals';
import { SERVER_ROOKIE_PROGRAM_LIMIT } from '../lib/planDefinitions.js';

describe('program allowance', () => {
  it('rookie free allowance is 5 sport programs', () => {
    expect(SERVER_ROOKIE_PROGRAM_LIMIT).toBe(5);
  });
});
