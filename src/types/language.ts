export type Language = 'en' | 'he' | 'es';

export type Direction = 'ltr' | 'rtl';

export interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  direction: Direction;
  t: (key: string) => string;
}

export interface Translations {
  [key: string]: string;
}

export interface LanguageConfig {
  en: Translations;
  he: Translations;
  es: Translations;
}
