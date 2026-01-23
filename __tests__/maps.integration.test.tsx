import { render } from '@testing-library/react-native';
import EventMap from '../app/components/EventMap';

describe('Google Maps Integration', () => {
  it('renders map and event pins', () => {
    const { getByTestId } = render(<EventMap events={[{ id: '1', title: 'Test Event', latitude: 40, longitude: -74 }]} />);
    expect(getByTestId('event-map')).toBeTruthy();
    expect(getByTestId('event-pin-1')).toBeTruthy();
  });
});
