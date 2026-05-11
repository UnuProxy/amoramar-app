export type ServiceMeta = {
  key: string;
  title: string;
  duration: string;
  image: string;
  bookingParam: string;
  description: string;
};

export const services: ServiceMeta[] = [
  {
    key: 'manicure',
    title: 'Perfect Manicure',
    duration: 'From 30 min',
    image: '/images/services/Manicure.jpg',
    bookingParam: 'manicure',
    description: 'Precision nail care with a polished, elegant finish.',
  },
  {
    key: 'pedicure',
    title: 'Luxury Pedicure',
    duration: 'From 40 min',
    image: '/images/services/Pedicure.JPG',
    bookingParam: 'pedicure',
    description: 'Relaxing foot care ritual for softness, comfort, and shine.',
  },
  {
    key: 'hair',
    title: 'Hair Styling & Blowouts',
    duration: 'From 45 min',
    image: '/images/services/Hair.JPG',
    bookingParam: 'hair',
    description: 'Modern styling and blow-dry looks tailored to your event.',
  },
  {
    key: 'makeup',
    title: 'Flawless Makeup',
    duration: 'From 60 min',
    image: '/images/services/MakeupNew.JPG',
    bookingParam: 'makeup',
    description: 'Camera-ready makeup designed for all-day confidence.',
  },
];

export const galleryMoments = [
  '/images/gallery/moment-1.webp',
  '/images/gallery/IMG_4487.jpg',
  '/images/gallery/Salon.jpg',
  '/images/gallery/Before&After.jpg',
  '/images/gallery/moment-8.jpg',
  '/images/gallery/IMG_4491.jpg',
  '/images/gallery/moment-7.webp',
  '/images/gallery/moment-8.jpg',
];

export function getServiceBySlug(slug: string) {
  return services.find((service) => service.key === slug);
}
