import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Language, Direction, LanguageContextValue } from '../types';
import { translations } from '../i18n/translations';

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
  storagePrefix?: string;
}

export function LanguageProvider({ children, storagePrefix = '' }: LanguageProviderProps) {
  // Initialize language from localStorage or default to Hebrew
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem(`${storagePrefix}language`);
    return (stored === 'en' || stored === 'he') ? stored : 'he';
  });

  // Compute direction based on language
  const direction: Direction = language === 'he' ? 'rtl' : 'ltr';

  // Translation function
  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  // Set language and persist to localStorage
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(`${storagePrefix}language`, lang);
  };

  // Apply direction to document root
  useEffect(() => {
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('data-lang', language);
  }, [direction, language]);

  const value: LanguageContextValue = {
    language,
    setLanguage,
    direction,
    t,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
