jest.mock('@/api/http', () => ({
  httpGet: jest.fn(),
}));

import { formatPostalCodeInput, isValidZipCode, normalizeZipCode } from '../zipCodeUtils';

describe('zipCodeUtils', () => {
  describe('isValidZipCode', () => {
    it('accepts standard US ZIP formats', () => {
      expect(isValidZipCode('94105')).toBe(true);
      expect(isValidZipCode('94105-1234')).toBe(true);
    });

    it('accepts international style postal codes', () => {
      expect(isValidZipCode('H0H 0H0')).toBe(true);
      expect(isValidZipCode('SW1A 1AA')).toBe(true);
    });

    it('rejects too-short or malformed codes', () => {
      expect(isValidZipCode('12')).toBe(false);
      expect(isValidZipCode('!!!')).toBe(false);
    });
  });

  describe('formatPostalCodeInput', () => {
    it('keeps numeric ZIP characters and trims to length', () => {
      expect(formatPostalCodeInput(' 94105-12345 ')).toBe('94105-1234');
    });

    it('uppercases and condenses spaces for alphanumeric codes', () => {
      expect(formatPostalCodeInput(' sw1a   1aa ')).toBe('SW1A 1AA');
    });

    it('drops disallowed characters', () => {
      expect(formatPostalCodeInput('H0H!0H0*')).toBe('H0H0H0');
    });
  });

  describe('normalizeZipCode', () => {
    it('strips non-numeric characters and limits to 5 digits', () => {
      expect(normalizeZipCode('94105-1234')).toBe('94105');
    });
  });
});
