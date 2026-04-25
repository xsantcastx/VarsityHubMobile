/**
 * Pending-approval screen — admin-approves-during-pending race.
 *
 * Closes the medium-confidence gap from the application-process audit:
 * what happens when an admin flips approval_status from PENDING to
 * APPROVED while the coach's app is sitting on the pending-approval
 * screen?
 *
 * The expected behavior is:
 *   1. /me returns PENDING → screen shows "Application Submitted"
 *   2. Admin approves on the backend (next /me returns APPROVED)
 *   3. checkApproval (triggered by focus / interval / foreground) sees
 *      APPROVED → setApproved(true) → UI swaps to "You're Approved!"
 *   4. User taps "Continue Coach Setup" → handleApprovedNavigation calls
 *      checkAuth + getPostAuthRouteDecision → routes to coach-agreement
 *
 * If any step regresses, the user is stranded on the pending screen
 * even though the admin approved them.
 */

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockCheckAuth = jest.fn();
const mockRegisterPushToken = jest.fn(() => Promise.resolve(true));
const mockSignOut = jest.fn();
let capturedFocusCallback: null | (() => void) = null;

const PENDING_USER = {
  id: 'u_test_coach',
  email: 'coach@example.com',
  email_verified: true,
  role: 'coach',
  approval_status: 'PENDING',
  account_state: 'coach_pending_approval',
  preferences: {
    role: 'coach',
    onboarding_completed: false,
    organization_id: 'org_test_123',
    proceeding_as_fan: false,
  },
};

const APPROVED_USER = {
  ...PENDING_USER,
  approval_status: 'APPROVED',
  account_state: 'coach_agreement_required',
  required_coach_agreement_version: 1,
  preferences: {
    ...PENDING_USER.preferences,
    onboarding_completed: true,
  },
};

const mockUserMe = jest.fn();
const mockNotificationListPage = jest.fn(async () => ({ items: [] }));

jest.mock('@/api/entities', () => ({
  User: {
    me: (...args: any[]) => mockUserMe(...args),
    updatePreferences: jest.fn(async () => ({ ok: true })),
    reapplyCoach: jest.fn(),
  },
  Notification: {
    listPage: (...args: any[]) => mockNotificationListPage(...args),
  },
}));

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({ leagueName: 'Test League', ownerName: 'Test Admin' }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    capturedFocusCallback = cb as () => void;
  },
}));

jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
    checkAuth: mockCheckAuth,
    registerPushToken: mockRegisterPushToken,
  }),
}));

jest.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => ({ state: { organization_id: 'org_test_123' } }),
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: () => null,
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaView: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

import PendingApproval from '../app/onboarding/pending-approval';

describe('pending-approval — admin-approves-during-pending race', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockCheckAuth.mockReset();
    mockRegisterPushToken.mockClear();
    mockUserMe.mockReset();
    capturedFocusCallback = null;
  });

  it('renders Application Submitted when /me returns PENDING', async () => {
    mockUserMe.mockResolvedValue(PENDING_USER);
    const { findByText } = render(<PendingApproval />);
    expect(await findByText('Application Submitted')).toBeTruthy();
  });

  it('transitions to approved state when /me later returns APPROVED', async () => {
    // First call (initial mount) — PENDING
    // Second call onward (focus / interval / foreground) — APPROVED
    mockUserMe.mockResolvedValueOnce(PENDING_USER).mockResolvedValue(APPROVED_USER);

    const { findByText } = render(<PendingApproval />);

    // Initial state: pending
    expect(await findByText('Application Submitted')).toBeTruthy();

    // Simulate focus event firing — coach foregrounds app, admin already approved
    expect(capturedFocusCallback).not.toBeNull();
    capturedFocusCallback?.();

    // After the focus-driven checkApproval, /me reports APPROVED → UI swaps
    expect(await findByText("You're Approved!")).toBeTruthy();
    expect(await findByText('Continue Coach Setup')).toBeTruthy();
  });

  it('routes to coach-agreement when an approved user taps Continue Coach Setup', async () => {
    mockUserMe.mockResolvedValueOnce(PENDING_USER).mockResolvedValue(APPROVED_USER);
    // checkAuth resolves with the approved user — handleApprovedNavigation
    // pipes that into getPostAuthRouteDecision.
    mockCheckAuth.mockResolvedValue(APPROVED_USER);

    const { findByText } = render(<PendingApproval />);
    // Wait for initial pending render so the polling effect has wired up
    await findByText('Application Submitted');

    // Trigger focus → /me returns APPROVED → screen swaps
    capturedFocusCallback?.();
    const continueButton = await findByText('Continue Coach Setup');

    // User taps the button → handleApprovedNavigation runs
    fireEvent.press(continueButton);

    await waitFor(() => {
      expect(mockCheckAuth).toHaveBeenCalled();
      // APPROVED + onboarding_completed=true + no coach_agreement_accepted_at
      // → getPostAuthRouteDecision returns /onboarding/coach-agreement.
      // The handler appends the redirect param.
      const lastCall = mockReplace.mock.calls[mockReplace.mock.calls.length - 1]?.[0];
      // router.replace can be called with either a string or a {pathname,params}
      // shape. Accept both.
      const target =
        typeof lastCall === 'string'
          ? lastCall
          : (lastCall as any)?.pathname;
      expect(target).toBe('/onboarding/coach-agreement');
    });
  });
});
