'use client';

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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.55, delay: 0.05 }}
        className="mx-auto max-w-4xl"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8A6F58]">{copy.eyebrow}</p>
        <h2 className="mt-3 font-display text-4xl leading-tight text-[#4A3D34] sm:text-5xl">{copy.title}</h2>
        <div className="mt-6 space-y-4 text-lg leading-relaxed text-[#5A5048]">
          <p>{copy.paragraphs[0]}</p>
          <p>{copy.paragraphs[1]}</p>
        </div>
      </motion.div>

    </section>
  );
}
