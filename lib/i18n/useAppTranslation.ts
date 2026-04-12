import type { TOptions } from 'i18next';
import { useTranslation } from 'react-i18next';
import { i18n } from './index';
import type { TranslationKey } from './resources';

type TranslateOptions = TOptions & {
  defaultValue?: string;
};

export function translate(key: TranslationKey, options?: TranslateOptions): string {
  return i18n.t(key, options) as string;
}

export function useAppTranslation() {
  const { i18n: instance, ...translation } = useTranslation();

  return {
    ...translation,
    i18n: instance,
    t: (key: TranslationKey, options?: TranslateOptions) => translation.t(key, options) as string,
  };
}
