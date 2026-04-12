import auth from '../../locales/en/auth.json';
import common from '../../locales/en/common.json';

export const DEFAULT_LANGUAGE = 'en' as const;
export const I18N_LANGUAGE_STORAGE_KEY = 'preferred_language';

export const resources = {
  en: {
    auth,
    common,
  },
} as const;

type Join<K extends string, P> = P extends string ? `${K}.${P}` : never;

type LevelOne<T> = Extract<keyof T, string>;
type LevelTwo<T> = {
  [K in LevelOne<T>]: T[K] extends object ? Join<K, LevelOne<T[K]>> : never;
}[LevelOne<T>];
type LevelThree<T> = {
  [K in LevelOne<T>]: T[K] extends object ? Join<K, LevelTwo<T[K]>> : never;
}[LevelOne<T>];
type LevelFour<T> = {
  [K in LevelOne<T>]: T[K] extends object ? Join<K, LevelThree<T[K]>> : never;
}[LevelOne<T>];
type LevelFive<T> = {
  [K in LevelOne<T>]: T[K] extends object ? Join<K, LevelFour<T[K]>> : never;
}[LevelOne<T>];
type NestedKeys<T> = LevelOne<T> | LevelTwo<T> | LevelThree<T> | LevelFour<T> | LevelFive<T>;

type ResourceNamespaces = typeof resources.en;

export type AppLanguage = keyof typeof resources;
export type TranslationKey = {
  [Namespace in Extract<keyof ResourceNamespaces, string>]: `${Namespace}.${NestedKeys<ResourceNamespaces[Namespace]>}`;
}[Extract<keyof ResourceNamespaces, string>];
