'use client';

import { motion } from 'framer-motion';
import { useLanguage } from '@/shared/context/LanguageContext';
import { testimonials } from '@/lib/story';

export function Testimonials() {
  const { language } = useLanguage();
  const items = testimonials[language];
  const title = language === 'es' ? 'Lo que dicen nuestras clientas' : 'What our clients say';

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.55 }}
        className="mb-10 text-center"
      >
        <h2 className="font-display text-4xl text-[#4A3D34] sm:text-5xl">{title}</h2>
      </motion.div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {items.map((item, index) => (
          <motion.article
            key={`${item.name}-${item.service}`}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: index * 0.07 }}
            className="rounded-2xl border border-[#DDD3C8] bg-white p-6 shadow-[0_10px_28px_rgba(42,38,34,0.06)]"
          >
            <p className="text-[#8A6F58]">★★★★★</p>
            <p className="mt-4 text-[#433830]">&ldquo;{item.text}&rdquo;</p>
            <div className="mt-5 border-t border-[#DDD3C8] pt-4">
              <p className="font-semibold text-[#4A3D34]">{item.name}</p>
              <p className="text-sm text-[#6E635B]">{item.service}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
