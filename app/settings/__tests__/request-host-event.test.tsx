import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import RequestHostEvent from '../request-host-event';

const mockCreate = jest.fn();
const mockMessage = jest.fn();
jest.mock('@/api/entities', () => ({
  Event: { create: (...args: unknown[]) => mockCreate(...args) },
  Message: { send: (...args: unknown[]) => mockMessage(...args) },
}));
jest.mock('@/context/AuthProvider', () => ({
  useAuth: () => ({ user: { email: 'fan@example.test', display_name: 'Fan' } }),
}));
jest.mock('@/hooks/useLocationAutocomplete', () => ({
  useLocationAutocomplete: () => ({
    location: 'Local Field',
    locationSuggestions: [],
    locationQuerying: false,
    locationTouched: false,
    selectedPlace: null,
    handleLocationChange: jest.fn(),
    handleSelectLocation: jest.fn(),
  }),
}));
jest.mock('@/components/EventPreviewImageField', () => () => null);
jest.mock('@/components/EventFormShared', () => ({
  EventFormHeader: () => null,
  LocationSuggestionList: () => null,
}));
jest.mock('@/components/KeyboardAwareScreen', () => {
  const { ScrollView } = require('react-native');
  return ScrollView;
});
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
  Stack: { Screen: () => null },
}));

describe('host-event submission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'host-request' });
    mockMessage.mockRejectedValue(new Error('Recipient not eligible'));
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('acknowledges the persisted request without a second client notification request', async () => {
    const view = render(<RequestHostEvent />);
    fireEvent.changeText(
      view.getByPlaceholderText('e.g., Varsity Basketball Game'),
      'Community game'
    );
    fireEvent.press(view.getByText('Submit Request'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Request Submitted!',
        expect.any(String),
        expect.any(Array)
      )
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Community game',
        event_type: 'host_request',
        location: 'Local Field',
      })
    );
    expect(mockMessage).not.toHaveBeenCalled();
  });

  it('shows a failed create without acknowledging success', async () => {
    mockCreate.mockRejectedValue(new Error('Connection failed'));
    const view = render(<RequestHostEvent />);
    fireEvent.changeText(
      view.getByPlaceholderText('e.g., Varsity Basketball Game'),
      'Community game'
    );
    fireEvent.press(view.getByText('Submit Request'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', expect.any(String)));
    expect(mockMessage).not.toHaveBeenCalled();
  });
});
