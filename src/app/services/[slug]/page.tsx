import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { StickyBookBar } from '@/components/StickyBookBar';
import { SITE_URL, bookingLink } from '@/lib/constants';
import { getServiceBySlug, services } from '@/lib/services';

type ServiceDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.key }));
}

export async function generateMetadata({ params }: ServiceDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) {
    return {};
  }

  return {
    title: `${service.title} | Amor Amar Ibiza`,
    description: `${service.title} at Amor Amar in Ibiza. ${service.duration}.`,
    openGraph: {
      title: `${service.title} | Amor Amar Ibiza`,
      description: `${service.title} at Amor Amar in Ibiza. ${service.duration}.`,
      url: `${SITE_URL}/services/${service.key}`,
      images: [{ url: service.image, alt: service.title }],
    },
  };
}

export default async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) notFound();

  return (
    <main className="min-h-screen bg-[#F6F1EA] text-[#2A2622]">
      <NavBar />
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:px-8">
        <div className="relative min-h-[320px] overflow-hidden rounded-2xl border border-[#E9DED2] bg-white">
          <Image
            src={service.image}
            alt={service.title}
            fill
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-contain p-3"
          />
        </div>

        <div className="self-center">
          <h1 className="font-display text-5xl leading-tight">{service.title}</h1>
          <p className="mt-4 text-lg text-[#7B726B]">{service.duration}</p>
          <p className="mt-6 text-lg text-[#2A2622]">{service.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={bookingLink(service.bookingParam)}
              className="rounded-xl bg-[#B08A57] px-7 py-3 text-lg font-semibold text-white transition-colors hover:bg-[#9D794C]"
            >
              Book {service.title}
            </a>
            <a
              href="/services"
              className="rounded-xl border border-[#E9DED2] bg-white px-7 py-3 text-lg font-semibold text-[#2A2622]"
            >
              Back to Services
            </a>
          </div>
        </div>
      </section>
      <Footer />
      <StickyBookBar />
    </main>
  );
}
