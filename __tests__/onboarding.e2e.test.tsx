import { fireEvent, render } from '@testing-library/react-native';
import App from '../App';

describe('Onboarding Flow', () => {
  it('should allow user to register as a coach and complete onboarding', async () => {
    const { getByText, getByPlaceholderText, findByText } = render(<App />);
    // Simulate navigation and input for onboarding steps
    fireEvent.press(getByText('Get Started'));
    fireEvent.press(getByText('Coach / Organizer'));
    fireEvent.press(getByText('Continue'));
    fireEvent.changeText(getByPlaceholderText('username'), 'coachuser');
    fireEvent.changeText(getByPlaceholderText('ZIP Code'), '12345');
    fireEvent.press(getByText('Continue'));
    // ...continue for all onboarding steps
    expect(await findByText('Onboarding Complete')).toBeTruthy();
  });
});
