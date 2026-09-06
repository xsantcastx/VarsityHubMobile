import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, useColorScheme as useSystemColorScheme } from 'react-native';
import { useAuth } from '@/context/AuthProvider';
import { useHydrated } from './useHydrated';

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

async function getStoredTheme(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function setStoredTheme(key: string, theme: ColorScheme): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(key, theme);
    } catch {
      // Best effort only on web.
    }
    return;
  }
  await SecureStore.setItemAsync(key, theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const hydrated = useHydrated();
  const { user } = useAuth();
  const [themePreference, setThemePreferenceState] = useState<ColorScheme>('system');
  const currentStorageKey = useRef<string>(storageKeyForUser(null));
  const themeRevision = useRef(0);

  // Scope theme preference to the active auth identity instead of resolving
  // a parallel /me snapshot here. AuthProvider already owns current-user state.
  useEffect(() => {
    let mounted = true;
    const revision = ++themeRevision.current;
    setThemePreferenceState('system');
    const loadTheme = async () => {
      try {
        const key = storageKeyForUser(user?.id ?? null);
        currentStorageKey.current = key;
        const savedTheme = await getStoredTheme(key);
        if (mounted && revision === themeRevision.current) {
          setThemePreferenceState(
            savedTheme && ['light', 'dark', 'system'].includes(savedTheme)
              ? (savedTheme as ColorScheme)
              : 'system'
          );
        }
      } catch (error) {
        if (__DEV__) console.warn('Failed to load theme preference:', error);
      }
    };
    void loadTheme();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  // Calculate actual color scheme based on preference
  const colorScheme: ActualColorScheme =
    Platform.OS === 'web' && !hydrated
      ? 'light'
      : themePreference === 'system'
        ? (systemColorScheme ?? 'light')
        : themePreference;

  // Save theme preference to storage when changed
  const setThemePreference = useCallback(async (theme: ColorScheme) => {
    // A slow storage read/write must not replace a newer selection or leak a
    // previous account's theme into the currently signed-in account.
    ++themeRevision.current;
    setThemePreferenceState(theme);
    try {
      // Save to the scoped key (per-user when possible)
      const key = currentStorageKey.current || storageKeyForUser(null);
      await setStoredTheme(key, theme);
    } catch (error) {
      if (__DEV__) console.warn('Failed to save theme preference:', error);
    }
  }, []);

  const value = useMemo(
    () => ({
      colorScheme,
      themePreference,
      setThemePreference,
    }),
    [colorScheme, themePreference, setThemePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useCustomColorScheme(): ActualColorScheme {
  const systemColorScheme = useSystemColorScheme();
  const hydrated = useHydrated();
  const context = useContext(ThemeContext);
  if (Platform.OS === 'web' && !hydrated) return 'light';
  if (context === undefined) {
    // Fallback if used outside provider
    return systemColorScheme ?? 'light';
  }
  return context.colorScheme;
}

// Backward-compatible alias for screens that still import `useColorScheme`
// from this module after the hook was renamed.
export const useColorScheme = useCustomColorScheme;

export function useThemePreference() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Return default values if used outside provider instead of throwing
    if (__DEV__) console.warn('useThemePreference used outside ThemeProvider, returning defaults');
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
