import type {
  Service,
  ServiceCatalogConfig,
  ServiceCatalogMainGroup,
  ServiceCatalogSubgroup,
} from '@/shared/lib/types';
import { getServiceMainGroupForCategory, getServiceMainGroupLabel } from '@/shared/lib/serviceCategories';

export const DEFAULT_SALON_ID = 'default-salon-id';

const DEFAULT_GROUPS: ServiceCatalogMainGroup[] = [
  {
    id: 'beauty-face',
    labelEn: 'Brows, Lashes, Permanent Makeup & Makeup',
    labelEs: 'Cejas, Pestanas, Maquillaje Permanente y Maquillaje',
    subgroups: [
      { id: 'lamination', labelEn: 'Lamination', labelEs: 'Laminacion' },
      { id: 'brow-services', labelEn: 'Brow Services', labelEs: 'Servicios de cejas' },
      { id: 'lash-extensions', labelEn: 'Lash Extensions', labelEs: 'Extensiones de pestanas' },
      { id: 'lash-refill', labelEn: 'Lash Refill', labelEs: 'Relleno de pestanas' },
      { id: 'lash-removal', labelEn: 'Lash Removal', labelEs: 'Retirada de pestanas' },
      { id: 'semi-permanent-makeup', labelEn: 'Semi-Permanent Makeup', labelEs: 'Maquillaje semipermanente' },
      { id: 'professional-makeup', labelEn: 'Professional Makeup', labelEs: 'Maquillaje profesional' },
    ],
  },
  {
    id: 'nails',
    labelEn: 'Manicure, Pedicure & Combinations',
    labelEs: 'Manicura, Pedicura y Combinaciones',
    subgroups: [
      { id: 'manicure', labelEn: 'Manicure', labelEs: 'Manicura' },
      { id: 'pedicure', labelEn: 'Pedicure', labelEs: 'Pedicura' },
      { id: 'combinations', labelEn: 'Combinations', labelEs: 'Combinaciones' },
    ],
  },
  {
    id: 'hair',
    labelEn: 'Hair',
    labelEs: 'Peluqueria',
    subgroups: [
      { id: 'haircuts-styling', labelEn: 'Haircuts & Styling', labelEs: 'Cortes y peinado' },
      { id: 'color', labelEn: 'Color', labelEs: 'Color' },
      { id: 'bleach-highlights', labelEn: 'Bleach & Highlights', labelEs: 'Decoloracion y mechas' },
      { id: 'treatments-signature', labelEn: 'Treatments & Signature', labelEs: 'Tratamientos y signature' },
      { id: 'mens-services', labelEn: "Men's Services", labelEs: 'Servicios para hombre' },
      { id: 'kids-cuts', labelEn: 'Kids Cuts', labelEs: 'Cortes infantiles' },
      { id: 'extensions', labelEn: 'Extensions', labelEs: 'Extensiones' },
    ],
  },
  {
    id: 'estetica',
    labelEn: 'Estetica',
    labelEs: 'Estetica',
    subgroups: [{ id: 'estetica', labelEn: 'Estetica', labelEs: 'Estetica' }],
  },
];

export const getDefaultServiceCatalogConfig = (salonId: string = DEFAULT_SALON_ID): ServiceCatalogConfig => ({
  id: salonId,
  salonId,
  groups: DEFAULT_GROUPS,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

export const getCatalogGroupLabel = (
  group: Pick<ServiceCatalogMainGroup, 'labelEn' | 'labelEs'>,
  language: 'en' | 'es'
): string => (language === 'es' ? group.labelEs : group.labelEn);

export const getCatalogSubgroupLabel = (
  subgroup: Pick<ServiceCatalogSubgroup, 'labelEn' | 'labelEs'>,
  language: 'en' | 'es'
): string => (language === 'es' ? subgroup.labelEs : subgroup.labelEn);

export const humanizeCatalogId = (value?: string): string =>
  (value || '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const createCatalogSubgroupDraft = (group: Pick<ServiceCatalogMainGroup, 'subgroups'>) => {
  const nextIndex = group.subgroups.length + 1;
  return {
    id: slugifyCatalogId(`subgroup-${Date.now()}`),
    labelEn: `New subgroup ${nextIndex}`,
    labelEs: `Nuevo subgrupo ${nextIndex}`,
  };
};

export const createCatalogGroupDraft = (config: Pick<ServiceCatalogConfig, 'groups'>) => {
  const nextIndex = config.groups.length + 1;
  return {
    id: slugifyCatalogId(`group-${Date.now()}`),
    labelEn: `New group ${nextIndex}`,
    labelEs: `Nuevo grupo ${nextIndex}`,
    subgroups: [],
  };
};

export const getMissingCatalogSubgroupLabel = (subgroupId: string | undefined, language: 'en' | 'es'): string => {
  const fallbackId = humanizeCatalogId(subgroupId);
  const prefix = language === 'es' ? 'Subgrupo sin catalogar' : 'Unlisted subgroup';
  return fallbackId ? `${prefix}: ${fallbackId}` : prefix;
};

export const getServiceGroupId = (service: Partial<Service>): string => {
  return service.mainGroupId || getServiceMainGroupForCategory(service.category, service.serviceName);
};

export const getServiceSubgroupId = (service: Partial<Service>): string => {
  return service.subgroupId || service.category || 'other';
};

export const findCatalogGroup = (config: ServiceCatalogConfig, groupId?: string) =>
  config.groups.find((group) => group.id === groupId);

export const findCatalogSubgroup = (
  config: ServiceCatalogConfig,
  groupId?: string,
  subgroupId?: string
) => findCatalogGroup(config, groupId)?.subgroups.find((subgroup) => subgroup.id === subgroupId);

export const getServiceGroupLabel = (
  service: Partial<Service>,
  config: ServiceCatalogConfig,
  language: 'en' | 'es'
): string => {
  const groupId = getServiceGroupId(service);
  const group = findCatalogGroup(config, groupId);
  return group
    ? getCatalogGroupLabel(group, language)
    : getServiceMainGroupLabel(groupId as any, language);
};

export const getServiceSubgroupLabel = (
  service: Partial<Service>,
  config: ServiceCatalogConfig,
  language: 'en' | 'es'
): string => {
  const subgroup = findCatalogSubgroup(config, getServiceGroupId(service), getServiceSubgroupId(service));
  if (subgroup) return getCatalogSubgroupLabel(subgroup, language);
  return getMissingCatalogSubgroupLabel(getServiceSubgroupId(service), language);
};

export const compareServicesByDisplayOrder = (a: Partial<Service>, b: Partial<Service>): number => {
  const aOrder = typeof a.displayOrder === 'number' ? a.displayOrder : Number.POSITIVE_INFINITY;
  const bOrder = typeof b.displayOrder === 'number' ? b.displayOrder : Number.POSITIVE_INFINITY;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return (a.serviceName || '').localeCompare(b.serviceName || '');
};

export const getNextServiceDisplayOrder = (
  services: Partial<Service>[],
  groupId?: string,
  subgroupId?: string
): number => {
  const relevantOrders = services
    .filter((service) => getServiceGroupId(service) === groupId && getServiceSubgroupId(service) === subgroupId)
    .map((service) => service.displayOrder)
    .filter((value): value is number => typeof value === 'number');

  if (relevantOrders.length === 0) return 0;
  return Math.max(...relevantOrders) + 1;
};

export const slugifyCatalogId = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
