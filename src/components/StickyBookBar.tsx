'use client';

import { bookingLink } from '@/lib/constants';
import { useLanguage } from '@/shared/context/LanguageContext';

export function StickyBookBar() {
  const { language } = useLanguage();
  const copy =
    language === 'es'
      ? {
          line1: 'Reserva en 30 segundos',
          line2: 'Confirmación rápida y pago seguro',
          book: 'Reservar',
        }
      : {
          line1: 'Book in 30 seconds',
          line2: 'Fast confirmation and secure checkout',
          book: 'Book Now',
        };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E9DED2] bg-[#F6F1EA]/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#2A2622]">{copy.line1}</p>
          <p className="text-xs text-[#7B726B]">{copy.line2}</p>
        </div>
        <a
          href={bookingLink()}
          className="shrink-0 rounded-xl bg-[#B08A57] px-5 py-2.5 text-base font-semibold text-white"
        >
          {copy.book}
        </a>
      </div>
    </div>
  );
}
