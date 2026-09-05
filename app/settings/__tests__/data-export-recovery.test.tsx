import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Alert, Linking, RefreshControl } from 'react-native';
import { queryClient } from '@/lib/queryClient';

const mockList = jest.fn();
const mockAvailability = jest.fn();
const mockRequest = jest.fn();
const mockDownload = jest.fn();
const mockCaptureException = jest.fn();
let mockUser = { id: 'export-viewer-a' };
jest.mock('@/api/entities', () => ({
  DataExport: {
    list: () => mockList(),
    availability: () => mockAvailability(),
    request: () => mockRequest(),
    download: () => mockDownload(),
  },
}));
jest.mock('@/utils/sentry', () => ({
  captureBreadcrumb: jest.fn(),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));
jest.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
import DataExportScreen from '../data-export';

function ViewUnderQuery() {
  return (
    <QueryClientProvider client={queryClient}>
      <DataExportScreen />
    </QueryClientProvider>
  );
}

describe('Data export availability and recovery', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    queryClient.clear();
    mockUser = { id: 'export-viewer-a' };
    mockList.mockReset().mockResolvedValue([]);
    mockAvailability.mockReset().mockResolvedValue({ available: true, retention_days: 7 });
    mockRequest.mockReset().mockResolvedValue({ id: 'export-1', status: 'pending' });
    mockDownload.mockReset();
    mockCaptureException.mockReset();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    queryClient.clear();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('unavailable service disables requesting and never reports queued', async () => {
    mockAvailability.mockResolvedValue({ available: false, retention_days: 7 });
    render(<ViewUnderQuery />);
    await waitFor(() => expect(screen.getByText('Temporarily Unavailable')).toBeTruthy());
    fireEvent.press(screen.getByText('Temporarily Unavailable'));
    expect(mockRequest).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(
      screen.getByText('Data exports are temporarily unavailable. Please try again later.')
    ).toBeTruthy();
  });

  it('load failure is not an empty success; refreshing recovers', async () => {
    mockList.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);
    const view = render(<ViewUnderQuery />);
    await waitFor(() =>
      expect(screen.getByText('Unable to load exports. Pull down to try again.')).toBeTruthy()
    );
    expect(screen.queryByText('No exports yet')).toBeNull();
    await act(async () => {
      view.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });
    await waitFor(() => expect(screen.getByText('No exports yet')).toBeTruthy());
    expect(screen.getByText('Request New Export')).toBeTruthy();
  });

  it('account switch does not display the previous account archive', async () => {
    mockList.mockResolvedValueOnce([
      {
        id: 'private-export',
        status: 'ready',
        requested_at: '2026-01-01T00:00:00Z',
        size_bytes: 123456,
      },
    ]);
    const view = render(<ViewUnderQuery />);
    await waitFor(() => expect(screen.getByText('Ready')).toBeTruthy());
    mockUser = { id: 'export-viewer-b' };
    view.rerender(<ViewUnderQuery />);
    expect(screen.queryByText('Ready')).toBeNull();
    await waitFor(() => expect(screen.getByText('No exports yet')).toBeTruthy());
  });

  it('rapid taps enqueue once and a 503 does not display success', async () => {
    let reject!: (error: unknown) => void;
    mockRequest.mockImplementation(
      () =>
        new Promise((_resolve, r) => {
          reject = r;
        })
    );
    render(<ViewUnderQuery />);
    await waitFor(() => expect(screen.getByText('Request New Export')).toBeTruthy());
    const button = screen.getByText('Request New Export');
    fireEvent.press(button);
    fireEvent.press(button);
    expect(mockRequest).toHaveBeenCalledTimes(1);
    await act(async () => reject({ status: 503 }));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Exports Temporarily Unavailable',
      'Please try again later.'
    );
    expect(Alert.alert).not.toHaveBeenCalledWith('Export Requested', expect.anything());
  });

  it('switching accounts during a request clears busy state and suppresses the old result', async () => {
    let resolve!: (row: unknown) => void;
    mockRequest.mockImplementation(
      () =>
        new Promise(r => {
          resolve = r;
        })
    );
    const view = render(<ViewUnderQuery />);
    await waitFor(() => expect(screen.getByText('Request New Export')).toBeTruthy());
    fireEvent.press(screen.getByText('Request New Export'));
    mockUser = { id: 'export-viewer-b' };
    view.rerender(<ViewUnderQuery />);
    await waitFor(() => expect(screen.getByText('Request New Export')).toBeTruthy());
    await act(async () => resolve({ id: 'account-a-export', status: 'pending' }));
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Request New Export' }).props.accessibilityState.disabled
    ).toBe(false);
  });

  it('a failed download does not send the signed URL to error reporting', async () => {
    mockList.mockResolvedValue([
      { id: 'private-export', status: 'ready', requested_at: '2026-01-01T00:00:00Z' },
    ]);
    const signed =
      'https://private.fixture.invalid/export.zip?X-Amz-Signature=fixture-bearer-secret';
    mockDownload.mockResolvedValue({ url: signed });
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error(`Cannot open ${signed}`));
    render(<ViewUnderQuery />);
    await waitFor(() => expect(screen.getByText('Download')).toBeTruthy());
    fireEvent.press(screen.getByText('Download'));
    await waitFor(() => expect(mockCaptureException).toHaveBeenCalled());
    expect(mockCaptureException.mock.calls[0][0].message).toBe('Data export download failed');
    expect(JSON.stringify(mockCaptureException.mock.calls)).not.toContain('fixture-bearer-secret');
  });

  it('polling stops five minutes after request even when every response is a new object', async () => {
    const requested_at = new Date().toISOString();
    mockList.mockImplementation(async () => [{ id: 'pending-1', status: 'pending', requested_at }]);
    render(<ViewUnderQuery />);
    await waitFor(() => expect(screen.getByText('Queued')).toBeTruthy());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(310000);
    });
    const calls = mockList.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20000);
    });
    expect(mockList.mock.calls.length).toBe(calls);
  });
});
