import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  I18N_LANGUAGE_STORAGE_KEY,
  resources,
  type AppLanguage,
} from './resources';

let initPromise: Promise<typeof i18n> | null = null;

function isSupportedLanguage(language: string): language is AppLanguage {
  return language in resources;
}

function resolveLanguage(language?: string | null): AppLanguage {
  if (language && isSupportedLanguage(language)) {
    return language;
  }

  return DEFAULT_LANGUAGE;
}

function getDeviceLanguage(): AppLanguage {
  const locale = getLocales()[0];
  const language = locale?.languageCode ?? locale?.languageTag?.split('-')[0];
  return resolveLanguage(language);
}

async function loadInitialLanguage(): Promise<AppLanguage> {
  try {
    const storedLanguage = await AsyncStorage.getItem(I18N_LANGUAGE_STORAGE_KEY);
    if (storedLanguage) {
      return resolveLanguage(storedLanguage);
    }
  } catch {
    // Fall back to device locale when persistence is unavailable.
  }

  return getDeviceLanguage();
}

export async function initializeI18n(): Promise<typeof i18n> {
  if (i18n.isInitialized) {
    return i18n;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const language = await loadInitialLanguage();

      await i18n.use(initReactI18next).init({
        compatibilityJSON: 'v4',
        defaultNS: 'common',
        fallbackLng: DEFAULT_LANGUAGE,
        interpolation: {
          escapeValue: false,
        },
        lng: language,
        resources,
      });

      return i18n;
    })();
  }

  return initPromise;
}

export async function setAppLanguage(language: AppLanguage): Promise<void> {
  await initializeI18n();
  const resolvedLanguage = resolveLanguage(language);
  await i18n.changeLanguage(resolvedLanguage);
  try {
    await AsyncStorage.setItem(I18N_LANGUAGE_STORAGE_KEY, resolvedLanguage);
  } catch {
    // Persistence is best effort; the current session still uses the chosen locale.
  }
}

export function getCurrentLanguage(): AppLanguage {
  return resolveLanguage(i18n.resolvedLanguage ?? i18n.language);
}

// Keep client namespaces mirrored and stable so the server can later render
// translated emails and push copy from the same catalog structure. The long-term
// source of truth should be preferences.language on User, with Accept-Language
// as the fallback before a profile exists.
export { i18n };
