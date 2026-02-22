'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import { bookingLink } from '@/lib/constants';
import { services } from '@/lib/services';
import { useLanguage } from '@/shared/context/LanguageContext';
import styles from './ServiceCards.module.css';

type ServiceCardsProps = {
  id?: string;
};

const ES_TITLE_BY_KEY: Record<string, string> = {
  manicure: 'Manicura Perfecta',
  pedicure: 'Pedicura Luxury',
  hair: 'Peinado & Brushing',
  makeup: 'Maquillaje Profesional',
};

const EN_TITLE_BY_KEY: Record<string, string> = {
  manicure: 'Perfect Manicure',
  pedicure: 'Luxury Pedicure',
  hair: 'Hair Styling & Blowouts',
  makeup: 'Flawless Makeup',
};

export function ServiceCards({ id }: ServiceCardsProps) {
  const { language } = useLanguage();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'center',
    skipSnaps: false,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const copy =
    language === 'es'
      ? {
          title: 'Servicios',
          previous: 'Anterior',
          next: 'Siguiente',
          seeAll: 'Ver todos los servicios',
          bookOnline: 'Reservar online',
        }
      : {
          title: 'Services',
          previous: 'Previous',
          next: 'Next',
          seeAll: 'See all services',
          bookOnline: 'Book online',
        };

  const localizedServices = useMemo(
    () =>
      services.map((service) => {
        const localizedTitle =
          language === 'es'
            ? ES_TITLE_BY_KEY[service.key] || service.title
            : EN_TITLE_BY_KEY[service.key] || service.title;
        const localizedMeta =
          language === 'es'
            ? service.duration.replace(/^From/i, 'Desde')
            : service.duration;
        return {
          ...service,
          localizedTitle,
          localizedMeta,
        };
      }),
    [language]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  return (
    <section id={id} className={styles.svc}>
      <h2 className={styles.title}>{copy.title}</h2>

      <div className={styles.carousel}>
        <button className={`${styles.nav} ${styles.navPrev}`} onClick={scrollPrev} aria-label={copy.previous}>
          ‹
        </button>

        <div className={styles.viewport} ref={emblaRef}>
          <div className={styles.container}>
            {localizedServices.map((service, index) => {
              const isActive = index === selectedIndex;
              return (
                <div
                  className={`${styles.slide} ${isActive ? styles.active : styles.inactive}`}
                  key={service.key}
                >
                  <article className={styles.card}>
                    <div className={styles.media}>
                      <Image
                        src={service.image}
                        alt={service.localizedTitle}
                        fill
                        sizes="(min-width: 1200px) 640px, 86vw"
                        className={styles.mediaImg}
                        priority={index === 0}
                      />
                      <div className={styles.overlay}>
                        <h3 className={styles.overlayTitle}>{service.localizedTitle}</h3>
                        <p className={styles.overlayMeta}>{service.localizedMeta}</p>
                        <div className={styles.activeDivider} />
                        <a className={styles.btnPrimary} href={bookingLink(service.bookingParam)}>
                          {copy.bookOnline}
                        </a>
                        <div className={styles.inactiveDetail}>
                          <div className={styles.inactiveLine} />
                          <div className={styles.inactiveDots} aria-hidden="true">
                            • • • • •
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        </div>

        <button className={`${styles.nav} ${styles.navNext}`} onClick={scrollNext} aria-label={copy.next}>
          ›
        </button>
      </div>

      <div className={styles.footer}>
        <div className={styles.dots} role="tablist" aria-label="Paginación de servicios">
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              className={`${styles.dot} ${index === selectedIndex ? styles.dotCurrent : ''}`}
              onClick={() => scrollTo(index)}
              aria-label={`Ir al servicio ${index + 1}`}
              aria-current={index === selectedIndex ? 'true' : 'false'}
            />
          ))}
        </div>

        <a className={styles.all} href={bookingLink()}>
          {copy.seeAll} <span aria-hidden>→</span>
        </a>
      </div>
    </section>
  );
}
