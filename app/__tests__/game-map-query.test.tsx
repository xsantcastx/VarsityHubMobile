import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

const mockHttpGet = jest.fn();
const mockRouter = { push: jest.fn(), back: jest.fn() };
let mockMapProps: any;
let mockSports: string[] = [];
jest.mock('@/api/http', () => ({ httpGet: (...args: any[]) => mockHttpGet(...args) }));
jest.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'map-viewer' } }) }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, Stack: { Screen: () => null } }));
jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('@/components/EventMap', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => {
      mockMapProps = props;
      return (
        <View>
          <Pressable accessibilityLabel="Open calendar" onPress={props.onCalendarPress}>
            <Text>Calendar</Text>
          </Pressable>
          <Pressable accessibilityLabel="Refresh map" onPress={props.onRefresh}>
            <Text>Refresh</Text>
          </Pressable>
          {props.events.map((event: any) => (
            <Text key={event.id}>{event.title}</Text>
          ))}
        </View>
      );
    },
  };
});
jest.mock('@/components/SportFilterBar', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => {
      mockSports = props.sports;
      return (
        <View>
          {props.sports.map((sport: string) => (
            <Pressable
              key={sport}
              accessibilityLabel={`Sport ${sport}`}
              onPress={() => props.onSelect(sport)}
            >
              <Text>{sport}</Text>
            </Pressable>
          ))}
        </View>
      );
    },
  };
});
import GameMapScreen from '../game-map';

const card = (
  id: string,
  day = '2026-09-06',
  sport = 'basketball',
  level: string | null = null
) => ({
  id,
  source_type: 'game',
  title: id,
  date: `${day}T16:00:00.000Z`,
  latitude: 40,
  longitude: -74,
  sport,
  league_level: level,
  upload_access: { can_upload_post: false },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => {
    resolve = yes;
  });
  return { promise, resolve };
}
async function openMap() {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <GameMapScreen />
    </QueryClientProvider>
  );
  await waitFor(() => expect(mockMapProps.dataLoaded).toBe(true));
  fireEvent.press(screen.getByLabelText('Open calendar'));
  return view;
}
async function settle(action: () => void) {
  await act(async () => {
    action();
  });
  await act(async () => {
    jest.advanceTimersByTime(1);
  });
}

describe('Game map active-date query and filters', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-05T12:00:00.000Z') });
    queryClient.clear();
    mockHttpGet.mockReset().mockResolvedValue({ items: [card('upcoming')] });
    mockMapProps = null;
    mockSports = [];
  });
  afterEach(() => {
    queryClient.clear();
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  it('late day A response cannot replace selected day B markers or its sports', async () => {
    await openMap();
    const a = deferred<any>(),
      b = deferred<any>();
    mockHttpGet.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    fireEvent.press(screen.getByLabelText('Thu 9/3, 0 events'));
    await act(async () => {});
    fireEvent.press(screen.getByLabelText('Fri 9/4, 0 events'));
    await act(async () => {});
    await settle(() =>
      b.resolve({
        items: [
          card('B football', '2026-09-04', 'football'),
          card('B soccer', '2026-09-04', 'soccer'),
        ],
      })
    );
    await waitFor(() => expect(screen.getByText('B football')).toBeTruthy());
    expect(mockSports).toEqual(['football', 'soccer']);
    await settle(() => a.resolve({ items: [card('A basketball', '2026-09-03', 'basketball')] }));
    expect(screen.queryByText('A basketball')).toBeNull();
    expect(screen.getByText('B football')).toBeTruthy();
    expect(mockSports).toEqual(['football', 'soccer']);
    expect(screen.getByLabelText('Showing 2026-09-04, tap to clear')).toBeTruthy();
  });
  it('date failure shows retry and retries the selected day without pretending success', async () => {
    await openMap();
    mockHttpGet.mockRejectedValueOnce(new Error('offline'));
    fireEvent.press(screen.getByLabelText('Fri 9/4, 0 events'));
    await waitFor(() =>
      expect(screen.getByText('Unable to load events. Please check your connection.')).toBeTruthy()
    );
    mockHttpGet.mockResolvedValueOnce({ items: [card('retried date', '2026-09-04')] });
    fireEvent.press(screen.getByText('Retry'));
    await waitFor(() => expect(screen.getByText('retried date')).toBeTruthy());
    expect(screen.queryByText('Unable to load events. Please check your connection.')).toBeNull();
    expect(mockHttpGet.mock.calls.at(-1)[0]).toContain('from=2026-09-04');
  });
  it('clearing a pending date restores the default map and ignores its late result', async () => {
    await openMap();
    const pending = deferred<any>();
    mockHttpGet.mockReturnValueOnce(pending.promise);
    fireEvent.press(screen.getByLabelText('Fri 9/4, 0 events'));
    await act(async () => {});
    fireEvent.press(screen.getByLabelText('Showing 2026-09-04, tap to clear'));
    expect(screen.getByText('upcoming')).toBeTruthy();
    await settle(() => pending.resolve({ items: [card('old date', '2026-09-04')] }));
    expect(screen.queryByText('old date')).toBeNull();
    expect(screen.getByText('upcoming')).toBeTruthy();
  });
  it('NCAA/Major/Minor filters use metadata and All retains local community events', async () => {
    mockHttpGet.mockResolvedValue({
      items: [
        card('NCAA game', '2026-09-06', 'football', 'college'),
        card('Major game', '2026-09-06', 'basketball', 'major'),
        card('Minor game', '2026-09-06', 'baseball', 'minor'),
        card('School event', '2026-09-06', 'soccer'),
      ],
    });
    await openMap();
    for (const [label, title] of [
      ['NCAA', 'NCAA game'],
      ['Major', 'Major game'],
      ['Minor', 'Minor game'],
    ]) {
      fireEvent.press(screen.getByLabelText(`${label} leagues`));
      expect(mockMapProps.events.map((e: any) => e.title)).toEqual([title]);
    }
    fireEvent.press(screen.getByLabelText('All leagues'));
    expect(mockMapProps.events).toHaveLength(4);
    expect(mockHttpGet).toHaveBeenCalledTimes(1);
  });
  it('background refresh failure retains markers while exposing retry', async () => {
    await openMap();
    mockHttpGet.mockRejectedValueOnce(new Error('offline'));
    fireEvent.press(screen.getByLabelText('Refresh map'));
    await waitFor(() =>
      expect(screen.getByText('Unable to load events. Please check your connection.')).toBeTruthy()
    );
    expect(screen.getByText('upcoming')).toBeTruthy();
    expect(screen.queryByText('Loading events...')).toBeNull();
  });
});
