import { validateOrganization, validateOrganizationArray } from '@/api/schemas/organization';
import { captureException } from '@/utils/sentry';

jest.mock('@/utils/sentry', () => ({
  captureException: jest.fn(),
}));

const captureExceptionMock = captureException as jest.MockedFunction<typeof captureException>;

const baseOrganization = {
  id: 'org_1',
  name: 'Westhill Academy',
  description: 'Test org',
  logo_url: null,
  profile_picture_url: 'https://cdn.example/profile.png',
  avatar_url: 'https://cdn.example/profile.png',
  background_url: null,
  sport: 'Basketball',
  org_type: 'school',
  location: 'Syracuse, NY',
  formatted_address: 'Syracuse, NY',
  zip_code: '13210',
  season_start: null,
  season_end: null,
  status: 'active',
  created_at: null,
  admin_approved: true,
  contact_info: null,
};

describe('organization response schema validation', () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  it('preserves unknown fields on valid payloads', () => {
    const payload = {
      ...baseOrganization,
      organization_name: 'Legacy alias',
      nested_extra: { enabled: true },
    };

    const result = validateOrganization('organizations.get', payload);

    expect(result).toEqual(payload);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('reports schema drift and fails open on invalid payloads', () => {
    const payload = {
      ...baseOrganization,
      admin_approved: 'yes',
      extra_hint: 'keep me',
    };

    const result = validateOrganization('organizations.get', payload);

    expect(result).toBe(payload);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock.mock.calls[0]?.[1]).toMatchObject({
      tags: {
        context: 'response_shape_drift',
        entity: 'organization',
        endpoint: 'organizations.get',
      },
    });
  });

  it('validates organization arrays without mutating items', () => {
    const payload = [{ ...baseOrganization, adhoc_field: 'present' }];

    const result = validateOrganizationArray('organizations.list', payload);

    expect(result).toEqual(payload);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});
