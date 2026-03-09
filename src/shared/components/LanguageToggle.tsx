'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/shared/context/LanguageContext';
import { isWebsitePath } from '@/shared/lib/routes';
import { cn } from '@/shared/lib/utils';

export const LanguageToggle = () => {
  const { language, setLanguage, t } = useLanguage();
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const isWebsiteRoute = isWebsitePath(pathname);
  const isBookingFlowRoute = pathname?.startsWith('/book');
  const usesHeaderLanguageSwitcher = pathname === '/book';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Keep floating switcher only for booking flow pages that do not use the new header switcher.
  if (!isMounted || !pathname || !isWebsiteRoute || !isBookingFlowRoute || usesHeaderLanguageSwitcher) {
    return null;
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-[80] flex items-center gap-1 rounded-full bg-white/90 border border-neutral-200 shadow-lg p-1 backdrop-blur"
      role="group"
      aria-label={t('language')}
    >
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={cn(
          'px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-full transition-all',
          language === 'en'
            ? 'bg-neutral-900 text-white shadow'
            : 'text-neutral-500 hover:text-neutral-900'
        )}
        aria-pressed={language === 'en'}
        title={t('language_en')}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('es')}
        className={cn(
          'px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-full transition-all',
          language === 'es'
            ? 'bg-neutral-900 text-white shadow'
            : 'text-neutral-500 hover:text-neutral-900'
        )}
        aria-pressed={language === 'es'}
        title={t('language_es')}
      >
        ES
      </button>
    </div>
  );
};
