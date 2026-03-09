import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { NavBar } from '@/components/NavBar';
import { Hero } from '@/components/Hero';
import { FounderStory } from '@/components/FounderStory';
import { ServiceCards } from '@/components/ServiceCards';
import { MomentsGallery } from '@/components/MomentsGallery';
import { Testimonials } from '@/components/Testimonials';
import { Footer } from '@/components/Footer';
import { ADDRESS, BOOKING_URL, GOOGLE_RATING, HOURS, PHONE, SITE_URL } from '@/lib/constants';
import { services } from '@/lib/services';

export const metadata: Metadata = {
  title: 'Amor Amar | Ibiza Beauty Salon',
  description:
    'Beauty, the Ibiza way. Manicure, pedicure, hair styling, and makeup with premium care in Ibiza Town.',
  openGraph: {
    title: 'Amor Amar | Ibiza Beauty Salon',
    description:
      'Beauty, the Ibiza way. Manicure, pedicure, hair styling, and makeup with premium care in Ibiza Town.',
    url: SITE_URL,
    type: 'website',
    images: [
      {
        url: '/images/hero/New-hero.jpg.avif',
        width: 1200,
        height: 630,
        alt: 'Amor Amar Ibiza salon interior',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Amor Amar | Ibiza Beauty Salon',
    description:
      'Beauty, the Ibiza way. Manicure, pedicure, hair styling, and makeup with premium care in Ibiza Town.',
    images: ['/images/hero/New-hero.jpg.avif'],
  },
};

export default function HomePage() {
  if (process.env.NEXT_PUBLIC_APP_MODE === 'backoffice') {
    redirect('/login');
  }

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'BeautySalon',
    name: 'Amor Amar',
    image: `${SITE_URL}/images/hero/New-hero.jpg.avif`,
    url: SITE_URL,
    telephone: PHONE,
    address: {
      '@type': 'PostalAddress',
      streetAddress: ADDRESS,
      addressLocality: 'Ibiza Town',
      addressRegion: 'Balearic Islands',
      addressCountry: 'ES',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: GOOGLE_RATING,
      reviewCount: '120',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '10:00',
        closes: '17:00',
      },
    ],
    sameAs: [BOOKING_URL],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Beauty Services',
      itemListElement: services.map((service) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: service.title,
          description: service.description,
        },
      })),
    },
    slogan: HOURS,
  };

  return (
    <main className="bg-[#F1F2F0] text-[#4A3D34]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(localBusinessSchema),
        }}
      />

      <NavBar />
      <Hero />
      <FounderStory id="story" />
      <ServiceCards id="services" />
      <MomentsGallery id="gallery" />
      <Testimonials />
      <Footer id="location" />
    </main>
  );
}
