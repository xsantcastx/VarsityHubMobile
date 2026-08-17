import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import PressableScale from '@/components/PressableScale';
import { haptics } from '@/utils/haptics';

jest.mock('@/utils/haptics', () => ({
  haptics: {
    selection: jest.fn(),
    impact: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

describe('PressableScale', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders its children', () => {
    const { getByText } = render(
      <PressableScale>
        <Text>Tap me</Text>
      </PressableScale>
    );
    expect(getByText('Tap me')).toBeTruthy();
  });

  it('forwards onPress', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <PressableScale testID="btn" onPress={onPress}>
        <Text>Go</Text>
      </PressableScale>
    );
    fireEvent.press(getByTestId('btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fires a selection haptic on press-in when haptic is enabled', () => {
    const { getByTestId } = render(
      <PressableScale testID="btn" haptic>
        <Text>Go</Text>
      </PressableScale>
    );
    fireEvent(getByTestId('btn'), 'pressIn');
    expect(haptics.selection).toHaveBeenCalledTimes(1);
  });

  it('does not fire a haptic when haptic is not set', () => {
    const { getByTestId } = render(
      <PressableScale testID="btn">
        <Text>Go</Text>
      </PressableScale>
    );
    fireEvent(getByTestId('btn'), 'pressIn');
    expect(haptics.selection).not.toHaveBeenCalled();
  });
});
