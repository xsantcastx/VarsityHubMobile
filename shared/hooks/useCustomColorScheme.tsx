import React, { createContext, useContext } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type ActualColorScheme = 'light' | 'dark';

const ThemeContext = createContext<ActualColorScheme | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const scheme: ActualColorScheme = systemScheme === 'dark' ? 'dark' : 'light';
  return <ThemeContext.Provider value={scheme}>{children}</ThemeContext.Provider>;
}

export function useCustomColorScheme(): ActualColorScheme {
  const context = useContext(ThemeContext);
  const systemScheme = useSystemColorScheme();
  return context ?? (systemScheme === 'dark' ? 'dark' : 'light');
}

export function useThemePreference(): ActualColorScheme {
  return useCustomColorScheme();
}
