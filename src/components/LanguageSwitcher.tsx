'use client';

import { useLanguage } from '@/shared/context/LanguageContext';
import { cn } from '@/shared/lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-[#DDD3C8] bg-white/90 p-1 shadow-sm',
        className
      )}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={cn(
          'rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors',
          language === 'en' ? 'bg-[#4A3D34] text-white' : 'text-[#6E635B] hover:text-[#4A3D34]'
        )}
        aria-pressed={language === 'en'}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('es')}
        className={cn(
          'rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors',
          language === 'es' ? 'bg-[#4A3D34] text-white' : 'text-[#6E635B] hover:text-[#4A3D34]'
        )}
        aria-pressed={language === 'es'}
      >
        ES
      </button>
    </div>
  );
}
