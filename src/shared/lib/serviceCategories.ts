import type { DefaultServiceCategory } from '@/shared/lib/types';

export const SERVICE_CATEGORY_LABELS: Record<DefaultServiceCategory, string> = {
  'hair-haircuts-styling': 'Hair - Haircuts & Styling',
  'hair-color': 'Hair - Color',
  'hair-bleach-highlights': 'Hair - Bleach & Highlights',
  'hair-treatments-signature': 'Hair - Treatments & Signature',
  'hair-men': "Hair - Men's Services",
  'hair-kids': 'Hair - Kids Cuts',
  'hair-extensions': 'Hair - Extensions',
  'beauty-lamination': 'Beauty - Lamination',
  'beauty-brow-services': 'Beauty - Brow Services',
  'beauty-lash-extensions-full-set': 'Beauty - Lash Extensions (Full Set)',
  'beauty-lash-refill-infill': 'Beauty - Lash Refill / Infill',
  'beauty-lash-removal': 'Beauty - Lash Removal',
  'beauty-semi-permanent-makeup': 'Beauty - Semi-Permanent Makeup',
  'beauty-professional-makeup': 'Beauty - Professional Makeup',
  'manicure': 'Manicure',
  'pedicure-care': 'Pedicure & Care',
  'nail-art-care-combinations': 'Manicura & Pedicura — Combinaciones / Combinations',
  'nail-art-care-manicure': 'Nail Art & Care - Manicure',
  'professional-foot-services': 'Professional Foot Services',
  'foot-sole-treatments': 'Foot Sole Treatments (KART)',
  'lamination': 'Lamination',
  'brow-services': 'Brow Services',
  'lash-extensions': 'Lash Extensions',
  'lash-extension-refill': 'Lash Extension Refill / Infill',
  'lash-extension-removal': 'Lash Extension Removal',
  'semi-permanent-makeup': 'Semi-Permanent Makeup',
  'professional-makeup': 'Professional Makeup',
  'other': 'Other',
};

export const SERVICE_CATEGORIES: DefaultServiceCategory[] = [
  'hair-haircuts-styling',
  'hair-color',
  'hair-bleach-highlights',
  'hair-treatments-signature',
  'hair-men',
  'hair-kids',
  'hair-extensions',
  'beauty-lamination',
  'beauty-brow-services',
  'beauty-lash-extensions-full-set',
  'beauty-lash-refill-infill',
  'beauty-lash-removal',
  'beauty-semi-permanent-makeup',
  'beauty-professional-makeup',
  'manicure',
  'pedicure-care',
  'nail-art-care-combinations',
  'nail-art-care-manicure',
  'professional-foot-services',
  'foot-sole-treatments',
  'lamination',
  'brow-services',
  'lash-extensions',
  'lash-extension-refill',
  'lash-extension-removal',
  'semi-permanent-makeup',
  'professional-makeup',
  'other',
];

const formatFallback = (category: string): string => {
  const label = category.replace(/-/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const formatServiceCategory = (category: string): string => {
  return SERVICE_CATEGORY_LABELS[category as DefaultServiceCategory] || formatFallback(category);
};

export const getOrderedServiceCategories = (
  services: Array<{ category?: string }>,
  options: { includeEmptyDefaults?: boolean } = {}
): string[] => {
  const categoriesInServices = new Set<string>();
  for (const service of services) {
    categoriesInServices.add(service.category || 'other');
  }

  const defaults = options.includeEmptyDefaults
    ? SERVICE_CATEGORIES
    : SERVICE_CATEGORIES.filter((category) => categoriesInServices.has(category));

  const extras = Array.from(categoriesInServices).filter(
    (category) => !SERVICE_CATEGORIES.includes(category as DefaultServiceCategory)
  );
  extras.sort((a, b) => a.localeCompare(b));

  return [...defaults, ...extras];
};
