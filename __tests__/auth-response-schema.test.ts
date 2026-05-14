import {
  validateAuthenticatedUser,
  validateOnboardingCompletion,
} from '@/api/schemas/auth';
import { captureException } from '@/utils/sentry';

jest.mock('@/utils/sentry', () => ({
  captureException: jest.fn(),
}));

const captureExceptionMock = captureException as jest.MockedFunction<typeof captureException>;

const baseUser = {
  id: 'user_1',
  email: 'coach@varsityhub.app',
  email_verified: true,
  username: 'coach.user',
  role: 'coach',
  account_state: 'coach_active',
  onboarding_completed: true,
  approval_status: 'APPROVED',
  organization_id: 'org_1',
  paid_by_owner: true,
  linked_providers: {
    password: true,
    google: false,
    apple: false,
  },
  preferences: {
    role: 'coach',
    onboarding_completed: true,
    organization_id: 'org_1',
  },
};

describe('auth response schema validation', () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  it('accepts a valid authenticated user payload and preserves unknown fields', () => {
    const payload = {
      ...baseUser,
      required_coach_agreement_version: 2,
      server_only_hint: 'keep me',
    };

    const result = validateAuthenticatedUser('/me', payload);

    expect(result).toEqual(payload);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('throws and reports drift for malformed authenticated user payloads', () => {
    const payload = {
      ...baseUser,
      id: 42,
      email_verified: 'yes',
    };

    expect(() => validateAuthenticatedUser('/me', payload)).toThrow(/Auth response schema drift/i);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock.mock.calls[0]?.[1]).toMatchObject({
      tags: {
        context: 'response_shape_drift',
        entity: 'auth',
        endpoint: '/me',
      },
    });
  });

  it('accepts onboarding completion envelopes with validated user payloads', () => {
    const payload = {
      message: 'Onboarding completed successfully',
      user: {
        ...baseUser,
        coach_application: {
          id: 'application_1',
          status: 'submitted',
          organization_name: 'Varsity League',
        },
      },
    };

    const result = validateOnboardingCompletion('auth.completeOnboarding', payload);

    expect(result).toEqual(payload);
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});
