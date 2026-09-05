import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

const mockFollowed = jest.fn();
let mockUser = { id: 'followed-viewer-a' };
jest.mock('@/api/entities', () => ({ Team: { followed: () => mockFollowed() } }));
jest.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
import FollowedTeamsScreen from '../followed-teams';

function ViewUnderQuery() {
  return (
    <QueryClientProvider client={queryClient}>
      <FollowedTeamsScreen />
    </QueryClientProvider>
  );
}

describe('Followed Teams request recovery', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    queryClient.clear();
    mockUser = { id: 'followed-viewer-a' };
    mockFollowed.mockReset();
  });
  afterEach(() => {
    cleanup();
    queryClient.clear();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('initial failure is not empty success, and Retry can reach a successful empty result', async () => {
    mockFollowed.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce([]);
    render(<ViewUnderQuery />);
    await waitFor(() => expect(mockFollowed).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
    expect(screen.queryByText('No followed teams yet.')).toBeNull();
    expect(screen.getByText('Unable to load followed teams. Please try again.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Retry followed teams' }));
    await waitFor(() => expect(screen.getByText('No followed teams yet.')).toBeTruthy());
    expect(screen.queryByText('Unable to load followed teams. Please try again.')).toBeNull();
    expect(mockFollowed).toHaveBeenCalledTimes(2);
  });

  it('a failed background read preserves known teams and Retry replaces them with confirmed data', async () => {
    mockFollowed
      .mockResolvedValueOnce([{ id: 'first', name: 'Known team' }])
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce([{ id: 'second', name: 'Updated team' }]);
    render(<ViewUnderQuery />);
    await waitFor(() => expect(screen.getByText('Known team')).toBeTruthy());
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['followed-teams'] });
    });
    await waitFor(() =>
      expect(screen.getByText('Unable to load followed teams. Please try again.')).toBeTruthy()
    );
    expect(screen.getByText('Known team')).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.queryByText('No followed teams yet.')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Retry followed teams' }));
    await waitFor(() => expect(screen.getByText('Updated team')).toBeTruthy());
    expect(screen.queryByText('Known team')).toBeNull();
  });

  it('changing accounts cannot render the previous account cached teams', async () => {
    mockFollowed
      .mockResolvedValueOnce([{ id: 'private-follow', name: 'Account A team' }])
      .mockResolvedValueOnce([]);
    const view = render(<ViewUnderQuery />);
    await waitFor(() => expect(screen.getByText('Account A team')).toBeTruthy());
    mockUser = { id: 'followed-viewer-b' };
    view.rerender(<ViewUnderQuery />);
    expect(screen.queryByText('Account A team')).toBeNull();
    await waitFor(() => expect(screen.getByText('No followed teams yet.')).toBeTruthy());
    expect(mockFollowed).toHaveBeenCalledTimes(2);
  });
});
