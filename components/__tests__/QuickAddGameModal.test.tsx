import { render, waitFor } from '@testing-library/react-native';
import QuickAddGameModal, { buildQuickGameData } from '../QuickAddGameModal';

jest.mock('@/hooks/useTeamOptions', () => ({
  useTeamOptions: () => ({ teams: [{ id: 'team-1', name: 'My Team' }] }),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: {},
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-view-shot', () => {
  const ViewShotMock = ({ children }: any) => children;
  return { __esModule: true, default: ViewShotMock, captureRef: jest.fn() };
});

jest.mock('@react-native-community/datetimepicker', () => {
  const Mock = () => null;
  return Mock;
});

jest.mock('../AppearancePicker', () => {
  const Mock = () => null;
  return { __esModule: true, default: Mock };
});

jest.mock('../ImageEditor', () => {
  const Mock = () => null;
  return { __esModule: true, default: Mock };
});

jest.mock('../LocationPicker', () => {
  const Mock = () => null;
  return { __esModule: true, default: Mock };
});

jest.mock('@/api/upload', () => ({
  uploadFile: jest.fn(),
}));

jest.mock('@/api/http', () => ({
  getApiBaseUrl: () => 'https://example.com',
}));

jest.mock('../../app/components/MatchBanner', () => {
  const Mock = () => null;
  return { __esModule: true, default: Mock };
});

describe('QuickAddGameModal', () => {
  const baseProps = {
    visible: true,
    onClose: jest.fn(),
    onSave: jest.fn(),
    currentTeamName: 'My Team',
    currentTeamId: 'team-1',
  };

  it('locks advanced fields when editing a live event', async () => {
    const { getByText, getAllByTestId } = render(
      <QuickAddGameModal
        {...baseProps}
        initialData={{
          id: 'game-1',
          opponent: 'Rivals',
          date: '12/25/2025',
          time: '7:00 PM',
          type: 'home',
          status: 'live',
          location: 'My Stadium',
        }}
      />
    );

    expect(getByText('Live Event Restrictions')).toBeTruthy();

    await waitFor(() => {
      expect(getAllByTestId('live-edit-locked').length).toBeGreaterThan(0);
    });
  });

  it('leaves fields editable for upcoming events', () => {
    const { queryByText, queryAllByTestId } = render(
      <QuickAddGameModal
        {...baseProps}
        initialData={{
          id: 'game-2',
          opponent: 'Eagles',
          date: '12/31/2025',
          time: '7:30 PM',
          type: 'away',
          status: 'upcoming',
          location: 'Championship Field',
        }}
      />
    );

    expect(queryByText('Live Event Restrictions')).toBeNull();
    expect(queryAllByTestId('live-edit-locked')).toHaveLength(0);
  });
});

describe('buildQuickGameData', () => {
  it('creates a competitive away payload with opponent data and map link', () => {
    const payload = buildQuickGameData({
      id: 'game-123',
      isCompetitive: true,
      currentTeam: '  Thunder  ',
      eventTitle: 'Ignored Event Title',
      currentTeamId: 'team-home',
      opponent: '  Lightning ',
      opponentTeamId: 'team-away',
      formattedDate: '2025-03-15',
      formattedTime: '7:30 PM',
      gameType: 'away',
      expectedAttendance: 150,
      eventType: 'game',
      eventDescription: '   Rivalry showdown  ',
      donationGoal: undefined,
      watchLocation: '',
      watchLocationLat: undefined,
      watchLocationLng: undefined,
      watchLocationPlaceId: undefined,
      destination: '',
      homeVenue: ' Thunder Stadium ',
      homeVenueLat: 12.34,
      homeVenueLng: -56.78,
      awayVenue: ' Lightning Field ',
      awayVenueLat: 33.123,
      awayVenueLng: -112.456,
    });

    expect(payload).toMatchObject({
      id: 'game-123',
      currentTeam: 'Thunder',
      opponent: 'Lightning',
      opponentTeamId: 'team-away',
      date: '2025-03-15',
      time: '7:30 PM',
      type: 'away',
      isCompetitive: true,
      expectedAttendance: 150,
      eventType: 'game',
      description: 'Rivalry showdown',
      homeVenue: 'Thunder Stadium',
      awayVenue: 'Lightning Field',
      mapsUrl: 'https://maps.google.com/?q=33.123,-112.456',
    });
  });

  it('strips opponent data for non-competitive events and keeps custom fields', () => {
    const payload = buildQuickGameData({
      id: undefined,
      isCompetitive: false,
      currentTeam: '',
      eventTitle: '  Team Fundraiser Dinner ',
      currentTeamId: 'team-home',
      opponent: 'Rivals',
      opponentTeamId: 'team-away',
      formattedDate: '2025-05-01',
      formattedTime: '6:00 PM',
      gameType: 'home',
      expectedAttendance: undefined,
      eventType: 'fundraiser',
      eventDescription: ' Support travel  ',
      donationGoal: 2500,
      watchLocation: '',
      watchLocationLat: undefined,
      watchLocationLng: undefined,
      watchLocationPlaceId: undefined,
      destination: ' Downtown Hall ',
      homeVenue: ' Field House ',
      homeVenueLat: undefined,
      homeVenueLng: undefined,
      awayVenue: '',
      awayVenueLat: undefined,
      awayVenueLng: undefined,
    });

    expect(payload).toMatchObject({
      currentTeam: 'Team Fundraiser Dinner',
      opponent: '',
      opponentTeamId: '',
      eventType: 'fundraiser',
      description: 'Support travel',
      donationGoal: 2500,
      destination: 'Downtown Hall',
      homeVenue: 'Field House',
      mapsUrl: undefined,
    });
  });
});
