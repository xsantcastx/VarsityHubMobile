import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { User } from '@/api/entities';

type ColorScheme = 'light' | 'dark' | 'system';
type ActualColorScheme = 'light' | 'dark';

interface ThemeContextType {
  colorScheme: ActualColorScheme;
  themePreference: ColorScheme;
  setThemePreference: (theme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'vh_theme_preference';

function storageKeyForUser(userId?: string | null) {
  if (!userId) return THEME_STORAGE_KEY + '_global';
  return `${THEME_STORAGE_KEY}_${userId}`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ColorScheme>('system');
  const currentStorageKey = useRef<string>(storageKeyForUser(null));

  useEffect(() => {
    let mounted = true;
    const loadTheme = async () => {
      try {
        let me: any = null;
        try {
          me = await User.me();
        } catch {
          me = null;
        }
        const key = storageKeyForUser(me?.id ?? me?.user_id ?? null);
        currentStorageKey.current = key;
        const savedTheme = await SecureStore.getItemAsync(key);
        if (mounted && savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          setThemePreferenceState(savedTheme as ColorScheme);
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      }
    };
    void loadTheme();
    return () => {
      mounted = false;
    };
  }, []);

  const colorScheme: ActualColorScheme =
    themePreference === 'system' ? systemColorScheme ?? 'light' : themePreference;

  const setThemePreference = async (theme: ColorScheme) => {
    try {
      const key = currentStorageKey.current || storageKeyForUser(null);
      await SecureStore.setItemAsync(key, theme);
      setThemePreferenceState(theme);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
      setThemePreferenceState(theme);
    }
  };

  return (
    <ThemeContext.Provider value={{ colorScheme, themePreference, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useCustomColorScheme(): ActualColorScheme {
  const systemColorScheme = useSystemColorScheme();
  const context = useContext(ThemeContext);
  if (context === undefined) {
    return systemColorScheme ?? 'light';
  }
  return context.colorScheme;
}

export function useThemePreference() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    console.warn('useThemePreference used outside ThemeProvider, returning defaults');
    return {
      themePreference: 'system' as ColorScheme,
      setThemePreference: () => {},
    };
  }
  return {
    themePreference: context.themePreference,
    setThemePreference: context.setThemePreference,
  };
}
