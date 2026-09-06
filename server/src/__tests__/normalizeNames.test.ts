import { normalizeOrganizationName } from '../lib/normalizeNames';

describe('normalizeOrganizationName', () => {
  it('normalizes common organization-name variants for duplicate detection', () => {
    expect(normalizeOrganizationName('St. Mary HS')).toBe('saintmaryhighschool');
    expect(normalizeOrganizationName('North & South League')).toBe('northandsouth');
    expect(normalizeOrganizationName('Eagles Club School')).toBe('eagles');
  });
});
