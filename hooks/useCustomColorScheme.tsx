import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
// @ts-ignore JS exports
import { User } from '@/api/entities';

type ColorScheme = 'light' | 'dark' | 'system';
type ActualColorScheme = 'light' | 'dark';

interface ThemeContextType {
  colorScheme: ActualColorScheme;
  themePreference: ColorScheme;
  setThemePreference: (theme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'VarsityHub_theme_preference';

function storageKeyForUser(userId?: string | null) {
  if (!userId) return THEME_STORAGE_KEY + ':global';
  return `${THEME_STORAGE_KEY}:${userId}`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ColorScheme>('system');
  const [isLoaded, setIsLoaded] = useState(false);
  const currentStorageKey = useRef<string>(storageKeyForUser(null));

  // Load theme preference from storage on app start
  // Load theme preference from storage on app start or when user changes
  useEffect(() => {
    let mounted = true;
    const loadTheme = async () => {
      try {
        // Try to resolve current user to scope the theme key per-account when possible
        let me: any = null;
        try {
          me = await User.me();
        } catch (_) {
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
      } finally {
        if (mounted) setIsLoaded(true);
      }
    };
    loadTheme();
    return () => { mounted = false; };
  }, []);

  // Calculate actual color scheme based on preference
  const colorScheme: ActualColorScheme = 
    themePreference === 'system' 
      ? (systemColorScheme ?? 'light') 
      : themePreference;

  // Save theme preference to storage when changed
  const setThemePreference = async (theme: ColorScheme) => {
    try {
      // Save to the scoped key (per-user when possible)
      const key = currentStorageKey.current || storageKeyForUser(null);
      await SecureStore.setItemAsync(key, theme);
      setThemePreferenceState(theme);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
      // Still update state even if storage fails
      setThemePreferenceState(theme);
    }
  };

  return (
    <ThemeContext.Provider value={{ colorScheme, themePreference, setThemePreference }}>
      {/* Don't render children until theme is loaded to prevent flash */}
      {isLoaded ? children : null}
    </ThemeContext.Provider>
  );
}

export function useCustomColorScheme(): ActualColorScheme {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Fallback if used outside provider
    const systemColorScheme = useSystemColorScheme();
    return systemColorScheme ?? 'light';
  }
  return context.colorScheme;
}

export function useThemePreference() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemePreference must be used within a ThemeProvider');
  }
  return {
    themePreference: context.themePreference,
    setThemePreference: context.setThemePreference,
  };
}