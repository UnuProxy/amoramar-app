'use client';

import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LANGUAGE_STORAGE_KEY, getBrowserLanguage, normalizeStoredLanguage, translations, type Language } from '@/shared/lib/i18n';
import { isBackofficePath } from '@/shared/lib/routes';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const isBackofficeRoute = isBackofficePath(pathname);
  // Keep initial render deterministic between server and client to avoid hydration mismatches.
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isBackofficeRoute) return;
    const stored = normalizeStoredLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
    setLanguageState(stored ?? getBrowserLanguage());
  }, [isBackofficeRoute]);

  useEffect(() => {
    const activeLanguage = isBackofficeRoute ? 'en' : language;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = activeLanguage;
    }
    if (typeof window !== 'undefined' && !isBackofficeRoute) {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
  }, [language, isBackofficeRoute]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === 'en' ? 'es' : 'en'));
  }, []);

  const t = useCallback(
    (key: string) => {
      const activeLanguage = isBackofficeRoute ? 'en' : language;
      return translations[activeLanguage][key] ?? key;
    },
    [language, isBackofficeRoute]
  );

  const value = useMemo(() => {
    const activeLanguage = isBackofficeRoute ? 'en' : language;
    return {
      language: activeLanguage,
      setLanguage,
      toggleLanguage,
      t,
    };
  }, [language, isBackofficeRoute, setLanguage, toggleLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
