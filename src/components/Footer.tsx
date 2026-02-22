'use client';

import { ADDRESS, GOOGLE_RATING, HOURS, bookingLink } from '@/lib/constants';
import { useLanguage } from '@/shared/context/LanguageContext';

type FooterProps = {
  id?: string;
};

export function Footer({ id }: FooterProps) {
  const { language } = useLanguage();
  const copy =
    language === 'es'
      ? {
          locationHours: 'Ubicación y Horario',
          bookNow: 'Reservar Ahora',
        }
      : {
          locationHours: 'Location & Hours',
          bookNow: 'Book Now',
        };

  return (
    <footer id={id} className="border-t border-[#E9DED2] bg-[#F6F1EA] pb-28 pt-10 md:pb-10">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <p className="text-[#B08A57]" aria-label={`${GOOGLE_RATING} stars`}>
            ★★★★★
          </p>
          <p className="mt-1 flex items-center gap-2 text-3xl font-semibold text-[#2A2622]">
            <span>{GOOGLE_RATING}</span>
            <span>{language === 'es' ? 'en' : 'on'}</span>
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E9DED2] bg-white text-xl font-bold leading-none"
              >
                <span className="text-[#4285F4]">G</span>
              </span>
            </span>
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7B726B]">{copy.locationHours}</p>
          <p className="mt-2 text-lg text-[#2A2622]">{ADDRESS}</p>
          <p className="mt-1 text-[#7B726B]">{HOURS}</p>
        </div>

        <div className="md:text-right">
          <a
            href={bookingLink()}
            className="inline-flex rounded-xl bg-[#B08A57] px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-[#9D794C]"
          >
            {copy.bookNow}
          </a>
        </div>
      </div>
    </footer>
  );
}
