import type { Language } from '@/shared/lib/i18n';
import type { Service } from '@/shared/lib/types';

type ServiceDescriptionFields = Pick<Service, 'description' | 'descriptionEn' | 'descriptionEs'>;

export const normalizeServiceDescriptions = (
  fields: Partial<ServiceDescriptionFields>
): ServiceDescriptionFields => {
  const fallback = fields.description?.trim() || '';
  const descriptionEn = fields.descriptionEn?.trim() || fallback;
  const descriptionEs = fields.descriptionEs?.trim() || fallback;
  const description = descriptionEn || descriptionEs || fallback;

  return {
    description,
    descriptionEn: descriptionEn || description,
    descriptionEs: descriptionEs || description,
  };
};

export const getLocalizedServiceDescription = (
  service: Partial<ServiceDescriptionFields>,
  language: Language
): string => {
  if (language === 'es') {
    return service.descriptionEs || service.description || service.descriptionEn || '';
  }

  return service.descriptionEn || service.description || service.descriptionEs || '';
};

export const getServiceDescriptionSearchText = (
  service: Partial<ServiceDescriptionFields>
): string => {
  return [service.description, service.descriptionEn, service.descriptionEs]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase();
};
