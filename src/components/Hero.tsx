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
          subtitle: 'Manicura • Pedicura • Pelo • Maquillaje',
          view: 'Ver Servicios',
        }
      : {
          title: 'Beauty, the Ibiza way.',
          subtitle: 'Manicure • Pedicure • Hair • Makeup',
          view: 'View Services',
        };

  return (
    <section className="relative min-h-[82vh] overflow-hidden lg:min-h-screen">
      <Image
        src="/images/hero/heroImage.webp"
        alt="Amor Amar beauty salon interior in Ibiza"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-[#2A2622]/45 via-[#2A2622]/32 to-[#2A2622]/20" />

      <div className="relative mx-auto flex min-h-[82vh] max-w-6xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6 lg:min-h-screen lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6 }}
          className="mb-5 font-display text-4xl italic text-[#F6F1EA] sm:text-5xl"
        >
          Amor Amar
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl font-display text-5xl leading-tight text-[#F6F1EA] sm:text-6xl md:text-7xl"
        >
          {copy.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, delay: 0.08 }}
          className="mt-5 text-lg text-[#F6F1EA]/95 sm:text-2xl"
        >
          {copy.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, delay: 0.16 }}
          className="mt-10 flex justify-center"
        >
          <a
            href="#services"
            className="rounded-xl bg-white/95 px-10 py-3 text-lg font-semibold text-[#2A2622] transition-colors hover:bg-white"
          >
            {copy.view}
          </a>
        </motion.div>
      </div>
    </section>
  );
}
