'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { galleryMoments } from '@/lib/services';
import { useLanguage } from '@/shared/context/LanguageContext';

type MomentsGalleryProps = {
  id?: string;
};

const MOMENT_LABELS = [
  {
    en: 'Team • Opening day',
    es: 'Equipo • Día de apertura',
  },
  {
    en: 'Balayage • Soft waves',
    es: 'Balayage • Ondas suaves',
  },
  {
    en: 'Salon • Ibiza vibe',
    es: 'Salón • Vibe Ibiza',
  },
  {
    en: 'Before ⇔ After • Correction',
    es: 'Antes ⇔ Después • Corrección',
  },
  {
    en: 'Gloss + waves • Ibiza-ready',
    es: 'Gloss + ondas • Lista para Ibiza',
  },
  {
    en: 'Perfect French Manicure',
    es: 'Manicura francesa perfecta',
  },
] as const;

export function MomentsGallery({ id }: MomentsGalleryProps) {
  const { language } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'center',
    skipSnaps: false,
  });
  const [mobileSelectedIndex, setMobileSelectedIndex] = useState(0);
  const [mobileSnaps, setMobileSnaps] = useState<number[]>([]);
  const copy =
    language === 'es'
      ? {
          title: 'Momentos Amor Amar',
          subtitle: 'Resultados reales de nuestro salón en Ibiza. Toca una foto para explorar.',
          close: 'Cerrar',
        }
      : {
          title: 'Amor Amar Moments',
          subtitle: 'Real results from our Ibiza salon. Tap a photo to explore.',
          close: 'Close',
        };

  const featuredMoments = galleryMoments.slice(0, 6);

  const onMobileSelect = useCallback(() => {
    if (!emblaApi) return;
    setMobileSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setMobileSnaps(emblaApi.scrollSnapList());
    onMobileSelect();
    emblaApi.on('select', onMobileSelect);
    emblaApi.on('reInit', onMobileSelect);
    return () => {
      emblaApi.off('select', onMobileSelect);
      emblaApi.off('reInit', onMobileSelect);
    };
  }, [emblaApi, onMobileSelect]);

  const scrollToMobile = useCallback(
    (index: number) => {
      emblaApi?.scrollTo(index);
    },
    [emblaApi]
  );

  return (
    <section id={id} className="bg-[#ECECEA]">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-10 max-w-4xl text-center sm:mb-12"
        >
          <h2 className="font-display text-[2.65rem] leading-[1.05] text-[#4A3D34] sm:text-[3.45rem] lg:text-[4.2rem]">
            {copy.title}
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-[#5B5149] sm:text-[2rem]">
            {copy.subtitle}
          </p>
        </motion.div>

        <div className="sm:hidden">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-3">
              {featuredMoments.map((image, index) => (
                <motion.button
                  key={`${image}-${index}`}
                  type="button"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, delay: index * 0.05 }}
                  whileHover={{ y: -2 }}
                  onClick={() => setSelectedIndex(index)}
                  className="group relative aspect-square min-w-0 flex-[0_0_86%] overflow-hidden rounded-[22px] border border-[#DDD3C8] bg-white shadow-[0_10px_30px_rgba(42,38,34,0.09)]"
                >
                  <Image
                    src={image}
                    alt={MOMENT_LABELS[index]?.[language] || `Amor Amar moment ${index + 1}`}
                    fill
                    sizes="86vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/68 via-black/28 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 px-4 pb-4 text-left">
                    <p className="text-[1.02rem] font-light leading-[1.2] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.22)]">
                      {MOMENT_LABELS[index]?.[language]}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2" role="tablist" aria-label="Momentos">
            {mobileSnaps.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => scrollToMobile(index)}
                className={`h-2 rounded-full transition-all ${
                  index === mobileSelectedIndex ? 'w-8 bg-[#8A6F58]' : 'w-2 bg-[#CEC4B8]'
                }`}
                aria-label={`Ir al momento ${index + 1}`}
                aria-current={index === mobileSelectedIndex ? 'true' : 'false'}
              />
            ))}
          </div>
        </div>

        <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {featuredMoments.map((image, index) => (
            <motion.button
              key={`${image}-${index}`}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: index * 0.05 }}
              whileHover={{ y: -5 }}
              onClick={() => setSelectedIndex(index)}
              className="group relative aspect-square overflow-hidden rounded-[22px] border border-[#DDD3C8] bg-white shadow-[0_10px_30px_rgba(42,38,34,0.09)]"
            >
              <Image
                src={image}
                alt={MOMENT_LABELS[index]?.[language] || `Amor Amar moment ${index + 1}`}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/68 via-black/28 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-4 pb-4 text-left sm:px-5 sm:pb-5">
                <p className="text-[1.02rem] font-light leading-[1.2] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.22)] sm:text-[1.14rem] lg:text-[1.2rem]">
                  {MOMENT_LABELS[index]?.[language]}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {selectedIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <button
            type="button"
            onClick={() => setSelectedIndex(null)}
            className="absolute right-4 top-4 rounded-full border border-white/40 bg-black/30 px-3 py-1 text-white"
          >
            {copy.close}
          </button>
          <div className="relative h-[75vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/20">
            <Image
              src={featuredMoments[selectedIndex]}
              alt={MOMENT_LABELS[selectedIndex]?.[language] || `Amor Amar moment ${selectedIndex + 1}`}
              fill
              sizes="100vw"
              className="object-contain bg-black/20"
            />
          </div>
        </div>
      )}
    </section>
  );
}
