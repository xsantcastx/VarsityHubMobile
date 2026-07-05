import { render, fireEvent } from '@testing-library/react-native';
import PasswordInput from '@/components/PasswordInput';

describe('PasswordInput', () => {
  it('starts hidden and toggles visibility via the eye button', () => {
    const { getByTestId } = render(
      <PasswordInput testID="pw" value="secret123" onChangeText={() => {}} />
    );
    expect(getByTestId('pw').props.secureTextEntry).toBe(true);
    fireEvent.press(getByTestId('pw-visibility-toggle'));
    expect(getByTestId('pw').props.secureTextEntry).toBe(false);
    fireEvent.press(getByTestId('pw-visibility-toggle'));
    expect(getByTestId('pw').props.secureTextEntry).toBe(true);
  });
});
