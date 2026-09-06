import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import * as Native from 'react-native';
import { Colors } from '@/constants/Colors';

let mockUser = { id: 'theme-user-a' };
const mockStoredTheme = jest.fn();

jest.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: unknown[]) => mockStoredTheme(...args),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/api/entities', () => ({ Team: { followed: jest.fn().mockResolvedValue([]) } }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isPending: false, isError: false, error: null }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => <Native.View {...props}>{children}</Native.View>,
}));
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));

import {
  ThemeProvider,
  useCustomColorScheme,
  useThemePreference,
} from '@/hooks/useCustomColorScheme';
import FollowedTeamsScreen from '../followed-teams';

function ThemeProbe() {
  const theme = useCustomColorScheme();
  const { themePreference } = useThemePreference();
  return <Native.Text testID="active-theme">{`${themePreference}:${theme}`}</Native.Text>;
}

function ScreenUnderProvider() {
  return (
    <ThemeProvider>
      <ThemeProbe />
      <FollowedTeamsScreen />
    </ThemeProvider>
  );
}

describe('Settings theme isolation regressions', () => {
  beforeEach(() => {
    mockUser = { id: 'theme-user-a' };
    mockStoredTheme
      .mockReset()
      .mockImplementation(async (key: string) => (key.endsWith('_theme-user-a') ? 'dark' : null));
    jest.spyOn(Native, 'useColorScheme').mockReturnValue('light');
  });
  afterEach(() => jest.restoreAllMocks());

  it('Followed Teams must honor the selected dark theme while the system stays light', async () => {
    render(<ScreenUnderProvider />);
    await waitFor(() =>
      expect(screen.getByTestId('active-theme').props.children).toBe('dark:dark')
    );
    expect(Native.StyleSheet.flatten(screen.getByText('Followed Teams').props.style).color).toBe(
      Colors.dark.text
    );
  });

  it('switching to a user with no saved theme must default to system instead of previous user preference', async () => {
    const view = render(<ScreenUnderProvider />);
    await waitFor(() =>
      expect(screen.getByTestId('active-theme').props.children).toBe('dark:dark')
    );
    mockUser = { id: 'theme-user-b' };
    view.rerender(<ScreenUnderProvider />);
    await waitFor(() =>
      expect(mockStoredTheme).toHaveBeenCalledWith('vh_theme_preference_theme-user-b')
    );
    expect(screen.getByTestId('active-theme').props.children).toBe('system:light');
  });
});
