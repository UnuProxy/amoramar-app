'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useLanguage } from '@/shared/context/LanguageContext';
import { founderStory } from '@/lib/story';

type FounderStoryProps = {
  id?: string;
};

export function FounderStory({ id }: FounderStoryProps) {
  const { language } = useLanguage();
  const copy = founderStory[language];

  return (
    <section id={id} className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.55 }}
          className="relative min-h-[360px] overflow-hidden rounded-2xl border border-[#DDD3C8] bg-white"
        >
          <Image
            src="/images/hero/FounderImage.jpg"
            alt="Founder of Amor Amar"
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.55, delay: 0.05 }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8A6F58]">{copy.eyebrow}</p>
          <h2 className="mt-3 font-display text-4xl leading-tight text-[#4A3D34] sm:text-5xl">{copy.title}</h2>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-[#5A5048]">
            <p>{copy.paragraphs[0]}</p>
            <p>{copy.paragraphs[1]}</p>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.55, delay: 0.1 }}
        className="mt-10 rounded-2xl border border-[#DDD3C8] bg-white p-6 sm:p-8"
      >
        <h3 className="font-display text-2xl text-[#4A3D34] sm:text-3xl">{copy.signatureTitle}</h3>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {copy.signaturePoints.map((point) => (
            <article key={point} className="rounded-xl border border-[#DDD3C8] bg-[#F1F2F0]/65 p-4">
              <p className="text-[#4A3D34]">{point}</p>
            </article>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
