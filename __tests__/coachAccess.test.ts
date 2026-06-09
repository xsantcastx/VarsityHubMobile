import { Alert } from 'react-native';
import { handleCoachAccessError } from '@/utils/coachAccess';

describe('handleCoachAccessError', () => {
  const alertSpy = jest.spyOn(Alert, 'alert');
  const router = { replace: jest.fn() };

  beforeEach(() => {
    alertSpy.mockClear();
    router.replace.mockReset();
  });

  it('routes approval-required coaches to the league pending screen when org context exists', () => {
    expect(
      handleCoachAccessError(
        router,
        { data: { code: 'APPROVAL_REQUIRED' } },
        'loading your teams',
        {
          account_state: 'coach_pending_approval',
          preferences: { role: 'coach', organization_id: 'org_123' },
        }
      )
    ).toBe(true);

    const [, , buttons] = alertSpy.mock.calls[0];
    expect(buttons?.[1]?.text).toBe('View Status');
    buttons?.[1]?.onPress?.();
    expect(router.replace).toHaveBeenCalledWith('/onboarding/league-pending-approval');
  });

  it('sends proceeding-as-fan coaches home instead of resurfacing approval status', () => {
    expect(
      handleCoachAccessError(
        router,
        { data: { code: 'APPROVAL_REJECTED' } },
        'editing events',
        {
          approval_status: 'REJECTED',
          preferences: { role: 'coach', proceeding_as_fan: true },
        }
      )
    ).toBe(true);

    const [, , buttons] = alertSpy.mock.calls[0];
    expect(buttons?.[1]?.text).toBe('Go Home');
    buttons?.[1]?.onPress?.();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/feed');
  });

  it('prefers top-level fan mode over stale preferences for approval-required recovery', () => {
    expect(
      handleCoachAccessError(
        router,
        { data: { code: 'APPROVAL_REQUIRED' } },
        'creating teams',
        {
          approval_status: 'PENDING',
          account_state: 'coach_application_submitted',
          next_step: '/onboarding/league-pending-approval',
          proceeding_as_fan: true,
          preferences: { role: 'coach', proceeding_as_fan: false },
        } as any
      )
    ).toBe(true);

    const [, , buttons] = alertSpy.mock.calls[0];
    expect(buttons?.[1]?.text).toBe('Go Home');
    buttons?.[1]?.onPress?.();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/feed');
  });

  it('preserves the legacy generic pending route when no user context is provided', () => {
    expect(
      handleCoachAccessError(router, { data: { code: 'APPROVAL_REQUIRED' } }, 'creating games')
    ).toBe(true);

    const [, , buttons] = alertSpy.mock.calls[0];
    expect(buttons?.[1]?.text).toBe('View Status');
    buttons?.[1]?.onPress?.();
    expect(router.replace).toHaveBeenCalledWith('/onboarding/pending-approval');
  });
});
