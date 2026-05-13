import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const mockUseAuth = jest.fn();
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockAddListener = jest.fn();
jest.mock('@/utils/notifications', () => ({
  __esModule: true,
  default: {
    addNotificationResponseReceivedListener: (...args: any[]) => mockAddListener(...args),
  },
}));

jest.mock('@/utils/sentry', () => ({
  captureBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

import { NotificationTapHandler } from '@/components/NotificationTapHandler';

function makeResponse(type: string, extra: Record<string, string> = {}) {
  return {
    notification: {
      request: {
        content: {
          data: {
            type,
            ...extra,
          },
        },
      },
    },
  };
}

describe('NotificationTapHandler', () => {
  let listener: ((response: any) => void) | null = null;

  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    mockUseAuth.mockReset();
    listener = null;
    mockAddListener.mockReset();
    mockAddListener.mockImplementation((cb: (response: any) => void) => {
      listener = cb;
      return { remove: jest.fn() };
    });
  });

  it('defers protected notification navigation until auth bootstrap finishes', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      hasSession: true,
    });

    const screen = render(<NotificationTapHandler />);
    expect(listener).toBeTruthy();

    listener?.(makeResponse('new_message', { conversation_id: 'conv_123' }));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();

    mockUseAuth.mockReturnValue({
      user: { id: 'user_1' },
      loading: false,
      hasSession: true,
    });

    screen.rerender(<NotificationTapHandler />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/message-thread?conversation_id=conv_123');
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects to sign-in after auth bootstrap settles with no session', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      hasSession: true,
    });

    const screen = render(<NotificationTapHandler />);
    expect(listener).toBeTruthy();

    listener?.(makeResponse('new_message', { conversation_id: 'conv_456' }));
    expect(mockReplace).not.toHaveBeenCalled();

    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      hasSession: false,
    });

    screen.rerender(<NotificationTapHandler />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/sign-in');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('routes game_story_added notifications to the dynamic game detail route', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user_1' },
      loading: false,
      hasSession: true,
    });

    render(<NotificationTapHandler />);
    expect(listener).toBeTruthy();

    listener?.(makeResponse('game_story_added', { game_id: 'game_123' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/game/[id]',
        params: { id: 'game_123' },
      });
    });
  });

  it('routes join_request_approved notifications through coach-agreement', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user_1' },
      loading: false,
      hasSession: true,
    });

    render(<NotificationTapHandler />);
    expect(listener).toBeTruthy();

    listener?.(makeResponse('join_request_approved', { organization_id: 'org_123' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding/coach-agreement');
    });
  });
});
