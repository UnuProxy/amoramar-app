'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useLanguage } from '@/shared/context/LanguageContext';

export function Hero() {
  const { language } = useLanguage();
  const copy =
    language === 'es'
      ? {
          title: 'Belleza, al estilo Ibiza.',
          view: 'Ver Servicios',
        }
      : {
          title: 'Beauty, the Ibiza way.',
          view: 'View Services',
        };

  return (
    <section className="relative min-h-[calc(100svh-5rem)] overflow-hidden lg:min-h-screen">
      <Image
        src="/images/hero/hero-stylist.png"
        alt="Amor Amar stylists transforming a client in Ibiza"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-[#4A3D34]/45 via-[#4A3D34]/32 to-[#4A3D34]/20" />

      <div className="relative mx-auto flex min-h-[calc(100svh-5rem)] max-w-6xl flex-col items-center justify-end px-4 pb-20 pt-24 text-center sm:px-6 sm:pb-24 lg:min-h-screen lg:px-8 lg:pb-28">
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6 }}
          className="mb-5 font-display text-4xl italic text-[#F1F2F0] sm:text-5xl"
        >
          Amor Amar
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl font-display text-5xl leading-tight text-[#F1F2F0] sm:text-6xl md:text-7xl"
        >
          {copy.title}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, delay: 0.16 }}
          className="mt-10 flex justify-center"
        >
          <a
            href="#services"
            className="rounded-xl border border-white/45 bg-[#4A3D34]/58 px-9 py-2.5 text-base font-medium text-[#F1F2F0] shadow-lg backdrop-blur-sm transition-all duration-300 hover:bg-[#4A3D34]/68"
          >
            {copy.view}
          </a>
        </motion.div>
      </div>
    </section>
  );
}
