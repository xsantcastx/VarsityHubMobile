import auth from '../locales/en/auth.json';
import common from '../locales/en/common.json';

function flatten(resource: unknown, prefix = ''): Record<string, string> {
  if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
    return {};
  }

  return Object.entries(resource).reduce<Record<string, string>>((accumulator, [key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      accumulator[nextKey] = value;
      return accumulator;
    }

    Object.assign(accumulator, flatten(value, nextKey));
    return accumulator;
  }, {});
}

describe('auth i18n resources', () => {
  it('contains non-empty English strings for auth and common namespaces', () => {
    const flattened = {
      ...flatten(common, 'common'),
      ...flatten(auth, 'auth'),
    };

    expect(Object.keys(flattened).length).toBeGreaterThan(0);

    for (const [key, value] of Object.entries(flattened)) {
      expect(value.trim()).not.toHaveLength(0);
      expect(value).not.toBe(key);
    }
  });
});
