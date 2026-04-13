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
  if (typeof navigator === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  const language = navigator.language?.split('-')[0];
  return resolveLanguage(language);
}

async function loadInitialLanguage(): Promise<AppLanguage> {
  try {
    if (typeof window !== 'undefined') {
      const storedLanguage = window.localStorage.getItem(I18N_LANGUAGE_STORAGE_KEY);
      if (storedLanguage) {
        return resolveLanguage(storedLanguage);
      }
    }
  } catch {
    // Fall back to browser locale when persistence is unavailable.
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
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(I18N_LANGUAGE_STORAGE_KEY, resolvedLanguage);
    }
  } catch {
    // Persistence is best effort; the current session still uses the chosen locale.
  }
}

export function getCurrentLanguage(): AppLanguage {
  return resolveLanguage(i18n.resolvedLanguage ?? i18n.language);
}

export { i18n };
