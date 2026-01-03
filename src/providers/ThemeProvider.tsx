import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';

const STORAGE_KEY = 'theme_preference';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: 'light' | 'dark';
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [theme, setTheme] = useState<'light' | 'dark'>(Appearance.getColorScheme() || 'light');

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemePreferenceState(stored);
      }
    })();
  }, []);

  useEffect(() => {
    if (themePreference === 'system') {
      const listener = Appearance.addChangeListener(({ colorScheme }) => {
        setTheme(colorScheme === 'dark' ? 'dark' : 'light');
      });
      setTheme(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
      return () => listener.remove();
    } else {
      setTheme(themePreference);
    }
  }, [themePreference]);

  const setThemePreference = (pref: ThemePreference) => {
    setThemePreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref);
  };

  return (
    <ThemeContext.Provider value={{ theme, themePreference, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useThemePreference() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemePreference must be used within a ThemeProvider');
  return ctx;
}
