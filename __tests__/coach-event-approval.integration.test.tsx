import { render } from '@testing-library/react-native';
import SettingsScreen from '../app/settings/index';

describe('Coach Event Approval', () => {
  it('shows pending event requests for coaches', () => {
    // Mock user as coach and mock pending events
    // ...mocking logic here
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Pending Event Requests')).toBeTruthy();
  });
});
