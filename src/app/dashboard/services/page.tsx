'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getServices, getEmployees, getEmployeeServices, updateService, createService } from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import Link from 'next/link';
import { formatCurrency, cn } from '@/shared/lib/utils';
import { formatServiceCategory } from '@/shared/lib/serviceCategories';
import type { Service, Employee, EmployeeService } from '@/shared/lib/types';
import { DEFAULT_SERVICES } from '@/shared/lib/defaultServices';
import { useLanguage } from '@/shared/context/LanguageContext';
import { getLocalizedServiceDescription, getServiceDescriptionSearchText, normalizeServiceDescriptions } from '@/shared/lib/serviceLocalization';

type MajorGroupKey = 'manicure' | 'pedicure-care' | 'combinations' | 'hair';

type ServiceSubgroup = {
  key: string;
  label: string;
  services: Service[];
};

const MAJOR_GROUP_ORDER: MajorGroupKey[] = ['manicure', 'pedicure-care', 'combinations', 'hair'];

const MAJOR_GROUP_LABELS: Record<MajorGroupKey, string> = {
  manicure: '1. Manicura / Nails',
  'pedicure-care': '2. Pedicura & Care',
  combinations: '3. Manicura & Pedicura — Combinaciones / Combinations',
  hair: '4. Hair',
};

const getMajorGroupForService = (service: Service): MajorGroupKey => {
  const category = service.category || 'other';
  const serviceName = service.serviceName.toLowerCase();

  if (category === 'manicure' || category === 'nail-art-care-manicure') return 'manicure';
  if (category === 'pedicure-care' || category === 'professional-foot-services' || category === 'foot-sole-treatments') return 'pedicure-care';
  if (category === 'nail-art-care-combinations') return 'combinations';
  if (String(category).startsWith('hair-')) return 'hair';

  if (serviceName.includes('pedicure') || serviceName.includes('planta') || serviceName.includes('sole') || serviceName.includes('foot')) return 'pedicure-care';
  if (serviceName.includes('combo') || serviceName.includes('combin')) return 'combinations';
  if (serviceName.includes('manicure') || serviceName.includes('gel') || serviceName.includes('nail')) return 'manicure';
  return 'hair';
};

const getServiceSubgroup = (service: Service): { key: string; label: string } => {
  const category = service.category || 'other';
  const name = service.serviceName.toLowerCase();

  if (category === 'manicure' || category === 'nail-art-care-manicure') {
    if (name.includes('relleno') || name.includes('refill')) return { key: 'gel-refill', label: 'Gel refill / Relleno con gel' };
    if (name.includes('extension')) return { key: 'extensions', label: 'Extensions / Extensiones' };
    if (name.includes('french glass') || name.includes('french interior')) return { key: 'special-techniques', label: 'Special techniques / Tecnicas especiales' };
    if (name.includes('retirada') || name.includes('removal')) return { key: 'removal', label: 'Removal / Retirada' };
    if (name.includes('higien')) return { key: 'hygienic', label: 'Hygienic manicure / Manicura higienica' };
    return { key: 'semi-permanent', label: 'Semi-permanent gel polish / Esmaltado semipermanente' };
  }

  if (category === 'pedicure-care' || category === 'professional-foot-services' || category === 'foot-sole-treatments') {
    if (name.includes('planta') || name.includes('sole') || name.includes('peeling') || name.includes('queratol') || name.includes('cleaning')) {
      return { key: 'sole-treatments', label: 'Sole treatments / Planta del pie' };
    }
    return { key: 'pedicure-nails', label: 'Pedicure nails / Pedicura unas' };
  }

  if (category === 'nail-art-care-combinations') {
    if (name.includes('sin limpieza') || name.includes('without cleaning')) {
      return { key: 'without-cleaning', label: 'Combinations without sole cleaning' };
    }
    return { key: 'with-cleaning', label: 'Combinations with sole cleaning' };
  }

  if (String(category).startsWith('hair-')) {
    if (category === 'hair-haircuts-styling') return { key: 'haircuts-styling', label: 'Haircuts & Styling' };
    if (category === 'hair-color') return { key: 'color', label: 'Color' };
    if (category === 'hair-bleach-highlights') return { key: 'bleach-highlights', label: 'Bleach & Highlights / Decoloracion y mechas' };
    if (category === 'hair-treatments-signature') return { key: 'treatments-signature', label: 'Treatments & Signature' };
    if (category === 'hair-men') return { key: 'mens-services', label: "Men's Services" };
    if (category === 'hair-kids') return { key: 'kids-cuts', label: 'Kids Cuts' };
    if (category === 'hair-extensions') return { key: 'extensions', label: 'Extensions' };
  }

  return { key: 'general', label: 'General services' };
};

export default function ServicesPage() {
  const { language } = useLanguage();
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeServices, setEmployeeServices] = useState<EmployeeService[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedGeneral, setCopiedGeneral] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ duration: string; price: string; category: string }>({
    duration: '',
    price: '',
    category: 'other',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden'>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const filteredServices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return services.filter((service) => {
      if (statusFilter === 'active' && !service.isActive) return false;
      if (statusFilter === 'hidden' && service.isActive) return false;
      if (!term) return true;

      const categoryLabel = formatServiceCategory(service.category || 'other').toLowerCase();
      const majorGroupLabel = MAJOR_GROUP_LABELS[getMajorGroupForService(service)].toLowerCase();
      const subgroupLabel = getServiceSubgroup(service).label.toLowerCase();
      return (
        service.serviceName.toLowerCase().includes(term) ||
        getServiceDescriptionSearchText(service).includes(term) ||
        categoryLabel.includes(term) ||
        majorGroupLabel.includes(term) ||
        subgroupLabel.includes(term)
      );
    });
  }, [services, searchTerm, statusFilter]);

  const servicesByMajorGroup = useMemo(() => {
    return MAJOR_GROUP_ORDER.map((groupKey) => {
      const groupServices = filteredServices
        .filter((service) => getMajorGroupForService(service) === groupKey)
        .sort((a, b) => a.serviceName.localeCompare(b.serviceName));

      const subgroupMap = groupServices.reduce<Record<string, ServiceSubgroup>>((acc, service) => {
        const subgroup = getServiceSubgroup(service);
        if (!acc[subgroup.key]) {
          acc[subgroup.key] = { key: subgroup.key, label: subgroup.label, services: [] };
        }
        acc[subgroup.key].services.push(service);
        return acc;
      }, {});

      const subgroups = Object.values(subgroupMap);
      subgroups.forEach((subgroup) => subgroup.services.sort((a, b) => a.serviceName.localeCompare(b.serviceName)));

      return {
        key: groupKey,
        label: MAJOR_GROUP_LABELS[groupKey],
        services: groupServices,
        subgroups,
      };
    });
  }, [filteredServices]);

  const orderedCategories = useMemo(
    () => servicesByMajorGroup.map((group) => group.key),
    [servicesByMajorGroup]
  );
  const expandedCategoryCount = useMemo(
    () => orderedCategories.filter((category) => !(collapsedCategories[category] ?? false)).length,
    [orderedCategories, collapsedCategories]
  );
  const allExpanded = orderedCategories.length > 0 && expandedCategoryCount === orderedCategories.length;
  const allCollapsed = orderedCategories.length > 0 && expandedCategoryCount === 0;

  const fetchServices = async () => {
    setLoading(true);
    try {
      const [servicesData, employeesData, employeeServicesData] = await Promise.all([
        getServices(),
        getEmployees(),
        getEmployeeServices(),
      ]);
      setServices(servicesData);
      setEmployees(employeesData);
      setEmployeeServices(employeeServicesData);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const getServiceEmployees = (serviceId: string): Employee[] => {
    const serviceEmployeeIds = employeeServices
      .filter((es) => es.serviceId === serviceId && es.isOffered)
      .map((es) => es.employeeId);
    
    return employees.filter((emp) => serviceEmployeeIds.includes(emp.id));
  };

  const fallbackCopyText = (text: string) => {
    if (typeof document === 'undefined') return false;

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      console.error('Error copying link:', error);
    }

    document.body.removeChild(textarea);
    return copied;
  };

  const copyToClipboard = async (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.error('Error copying link:', error);
      }
    }

    return fallbackCopyText(text);
  };

  const copyBookingLink = async (serviceId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${baseUrl}/book/${serviceId}`;
    
    try {
      const didCopy = await copyToClipboard(link);
      if (!didCopy) return;
      setCopiedId(serviceId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Error copying link:', err);
    }
  };

  const startQuickEdit = (service: Service) => {
    setEditingServiceId(service.id);
    setEditValues({
      duration: String(service.duration ?? ''),
      price: String(service.price ?? ''),
      category: service.category || 'other',
    });
    setEditError(null);
  };

  const cancelQuickEdit = () => {
    setEditingServiceId(null);
    setEditValues({ duration: '', price: '', category: 'other' });
    setEditError(null);
  };

  const handleQuickSave = async (serviceId: string) => {
    const durationValue = Number.parseInt(editValues.duration, 10);
    const priceValue = Number.parseFloat(editValues.price);
    const categoryValue = editValues.category.trim();

    if (Number.isNaN(durationValue) || durationValue < 15) {
      setEditError('Duration must be at least 15 minutes.');
      return;
    }

    if (Number.isNaN(priceValue) || priceValue < 0) {
      setEditError('Price must be a valid number.');
      return;
    }

    if (!categoryValue) {
      setEditError('Category is required.');
      return;
    }

    setSavingId(serviceId);
    setEditError(null);

    try {
      await updateService(serviceId, {
        duration: durationValue,
        price: priceValue,
        category: categoryValue,
      });

      setServices((prev) =>
        prev.map((service) =>
          service.id === serviceId
            ? { ...service, duration: durationValue, price: priceValue, category: categoryValue }
            : service
        )
      );
      cancelQuickEdit();
    } catch (error: any) {
      setEditError(error?.message || 'Could not update service.');
    } finally {
      setSavingId(null);
    }
  };

  const importDefaultServices = async () => {
    const confirmed = window.confirm(
      'Sync the default service list? Missing services will be created, existing defaults updated, and services outside the default list will be hidden.'
    );
    if (!confirmed) return;

    setIsImporting(true);
    setImportMessage(null);

    try {
      const existingByKey = new Map(
        services.map((service) => [
          `${service.category}|${service.serviceName}`.toLowerCase(),
          service,
        ])
      );
      const defaultKeys = new Set(
        DEFAULT_SERVICES.map((seed) => `${seed.category}|${seed.serviceName}`.toLowerCase())
      );
      let createdCount = 0;
      let updatedCount = 0;
      let hiddenCount = 0;
      const salonId = 'default-salon-id';

      for (const seed of DEFAULT_SERVICES) {
        const key = `${seed.category}|${seed.serviceName}`.toLowerCase();
        const existing = existingByKey.get(key);

        if (existing) {
          const seedDescriptions = normalizeServiceDescriptions({ description: seed.description });
          const needsUpdate =
            existing.description !== seed.description ||
            (existing.descriptionEn ?? existing.description) !== seedDescriptions.descriptionEn ||
            (existing.descriptionEs ?? existing.description) !== seedDescriptions.descriptionEs ||
            existing.duration !== seed.duration ||
            existing.price !== seed.price ||
            existing.category !== seed.category ||
            existing.isActive !== true ||
            (existing.offersConsultation ?? false) !== (seed.offersConsultation ?? false) ||
            (existing.consultationDuration ?? 20) !== (seed.consultationDuration ?? 20);

          if (needsUpdate) {
            await updateService(existing.id, {
              ...seedDescriptions,
              duration: seed.duration,
              price: seed.price,
              category: seed.category,
              isActive: true,
              offersConsultation: seed.offersConsultation ?? false,
              consultationDuration: seed.consultationDuration ?? 20,
            });
            updatedCount += 1;
          }
          continue;
        }

        await createService({
          salonId,
          serviceName: seed.serviceName,
          ...normalizeServiceDescriptions({ description: seed.description }),
          duration: seed.duration,
          price: seed.price,
          category: seed.category,
          isActive: true,
          offersConsultation: seed.offersConsultation ?? false,
          consultationDuration: seed.consultationDuration ?? 20,
        });

        existingByKey.set(key, {} as Service);
        createdCount += 1;
      }

      for (const service of services) {
        const key = `${service.category}|${service.serviceName}`.toLowerCase();
        if (!defaultKeys.has(key) && service.isActive) {
          await updateService(service.id, { isActive: false });
          hiddenCount += 1;
        }
      }

      await fetchServices();
      setImportMessage(`Sync complete: ${createdCount} created, ${updatedCount} updated, ${hiddenCount} hidden.`);
    } catch (error: any) {
      setImportMessage(error?.message || 'Could not import services.');
    } finally {
      setIsImporting(false);
    }
  };

  const copyGeneralBookingLink = async () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${baseUrl}/book`;
    
    try {
      const didCopy = await copyToClipboard(link);
      if (!didCopy) return;
      setCopiedGeneral(true);
      setTimeout(() => setCopiedGeneral(false), 2000);
    } catch (err) {
      console.error('Error copying link:', err);
    }
  };

  const setAllCategoriesCollapsed = (collapsed: boolean) => {
    setCollapsedCategories(
      orderedCategories.reduce<Record<string, boolean>>((acc, category) => {
        acc[category] = collapsed;
        return acc;
      }, {})
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="sm" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 pb-12">
      {/* Header - Bold Premium */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800 tracking-tight">
            Services
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-2">
            Services & Treatments Catalog
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={fetchServices}
            className="px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center"
            title="Refresh list"
          >
            <svg className={cn("w-5 h-5", loading && "animate-spin")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={importDefaultServices}
            className={cn(
              "px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 border",
              isImporting
                ? "bg-slate-100 text-slate-400 border-slate-200"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
            disabled={isImporting}
          >
            {isImporting ? 'Importing...' : 'Import List'}
          </button>
          <button
            onClick={copyGeneralBookingLink}
            className={cn(
              "px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 border",
              copiedGeneral
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            )}
          >
            {copiedGeneral ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Link Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share Bookings
              </>
            )}
          </button>
          <Link href="/dashboard/services/new">
            <button
              className="px-6 py-2.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Service
            </button>
          </Link>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-sky-50 rounded-2xl p-6 border border-sky-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-1">Booking Link for Clients</p>
              <p className="text-sm text-slate-600">Share this link on your website, Instagram or WhatsApp. Clients will see all services and can book directly.</p>
            </div>
          </div>
          <button
            onClick={copyGeneralBookingLink}
            className={cn(
              "px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border",
              copiedGeneral
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            )}
          >
            {copiedGeneral ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
      {importMessage && (
        <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm text-slate-700">
          {importMessage}
        </div>
      )}

      {/* Search + Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 lg:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 tracking-wide mb-2">
              Search Services
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, description, or group"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
            />
          </div>
          <div className="w-full lg:w-56">
            <label className="block text-xs font-medium text-slate-500 tracking-wide mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'hidden')}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 focus:border-emerald-300 focus:outline-none"
            >
              <option value="all">All services</option>
              <option value="active">Only active</option>
              <option value="hidden">Only hidden</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500 tracking-wide">
            <span className="px-3 py-2 rounded-full bg-slate-50 border border-slate-200 text-slate-600">
              {filteredServices.length} total
            </span>
            <span className="px-3 py-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              {filteredServices.filter((s) => s.isActive).length} active
            </span>
            <span className="px-3 py-2 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
              {filteredServices.filter((s) => !s.isActive).length} hidden
            </span>
          </div>
        </div>
      </div>

      {/* Services List - Grouped */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-slate-700">Grouped by category</p>
            <span className="text-xs text-slate-500">
              {orderedCategories.length} groups · {expandedCategoryCount} expanded
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAllCategoriesCollapsed(false)}
              disabled={allExpanded}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                allExpanded
                  ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              Expand all
            </button>
            <button
              onClick={() => setAllCategoriesCollapsed(true)}
              disabled={allCollapsed}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                allCollapsed
                  ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              Collapse all
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-left text-[11px] font-medium text-slate-500 tracking-wide">Service</th>
                <th className="px-6 py-4 text-left text-[11px] font-medium text-slate-500 tracking-wide">Assigned to</th>
                <th className="px-6 py-4 text-center text-[11px] font-medium text-slate-500 tracking-wide">Time</th>
                <th className="px-6 py-4 text-center text-[11px] font-medium text-slate-500 tracking-wide">Price</th>
                <th className="px-6 py-4 text-center text-[11px] font-medium text-slate-500 tracking-wide">Status</th>
                <th className="px-6 py-4 text-right text-[11px] font-medium text-slate-500 tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-lg font-semibold text-slate-700">Empty Catalog</p>
                  </td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-lg font-semibold text-slate-700">No services match your filters</p>
                    <p className="text-sm text-slate-400 mt-2">Try clearing the search or status filter.</p>
                  </td>
                </tr>
              ) : (
                servicesByMajorGroup.map((group) => {
                  const isCollapsed = collapsedCategories[group.key] ?? false;
                  const activeCount = group.services.filter((service) => service.isActive).length;
                  const hiddenCount = group.services.length - activeCount;
                  const therapistCount = new Set(
                    group.services.flatMap((service) => getServiceEmployees(service.id).map((employee) => employee.id))
                  ).size;

                  return (
                    <React.Fragment key={group.key}>
                      <tr className="bg-slate-50 border-y border-slate-200">
                        <td colSpan={6} className="px-6 py-4">
                          <button
                            onClick={() =>
                              setCollapsedCategories((prev) => ({
                                ...prev,
                                [group.key]: !isCollapsed,
                              }))
                            }
                            className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left"
                          >
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 w-6 h-6 rounded-full border border-slate-300 bg-white text-slate-500 flex items-center justify-center">
                                <svg
                                  className={cn("w-3.5 h-3.5 transition-transform", isCollapsed && "-rotate-90")}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </span>
                              <div className="space-y-1">
                                <span className="block text-sm font-semibold text-slate-700">
                                  {group.label}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {group.services.length} services · {group.subgroups.length} subgroups · {therapistCount} therapists · {activeCount} active · {hiddenCount} hidden
                                </span>
                              </div>
                            </div>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                                isCollapsed
                                  ? "border-slate-300 text-slate-500 bg-white"
                                  : "border-emerald-200 text-emerald-700 bg-emerald-50"
                              )}
                            >
                              {isCollapsed ? 'Collapsed' : 'Expanded'}
                            </span>
                          </button>
                        </td>
                      </tr>
                      {!isCollapsed && group.services.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-8 py-6 text-sm text-slate-400">
                            No services in this group.
                          </td>
                        </tr>
                      )}
                      {!isCollapsed &&
                        group.subgroups.map((subgroup) => (
                          <React.Fragment key={`${group.key}-${subgroup.key}`}>
                            <tr className="bg-slate-50/60 border-y border-slate-100">
                              <td colSpan={6} className="px-8 py-3">
                                <span className="text-xs font-semibold tracking-wide text-slate-600">
                                  Subgroup: {subgroup.label} ({subgroup.services.length})
                                </span>
                              </td>
                            </tr>
                            {subgroup.services.map((service) => {
                              const serviceEmployees = getServiceEmployees(service.id);
                              const isEditing = editingServiceId === service.id;
                              return (
                                <tr key={service.id} className="hover:bg-slate-50/80 transition-all group">
                              <td className="px-10 py-6">
                                <div className="space-y-1">
                                  <p className="text-base font-semibold text-slate-800 leading-snug">{service.serviceName}</p>
                                  {getLocalizedServiceDescription(service, language) && (
                                    <p className="text-xs text-slate-400 truncate max-w-xs">
                                      {getLocalizedServiceDescription(service, language)}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-10 py-6">
                                {serviceEmployees.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {serviceEmployees.map((emp) => (
                                      <span
                                        key={emp.id}
                                        className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium"
                                      >
                                        {emp.firstName}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                                    Needs therapist
                                  </span>
                                )}
                              </td>
                              <td className="px-10 py-6 text-center">
                                {isEditing ? (
                                  <div className="flex flex-col items-center gap-2">
                                    <input
                                      type="number"
                                      min={15}
                                      value={editValues.duration}
                                      onChange={(event) =>
                                        setEditValues((prev) => ({ ...prev, duration: event.target.value }))
                                      }
                                      className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700 focus:border-emerald-300 focus:outline-none"
                                    />
                                    <span className="text-xs text-slate-400">min</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center">
                                    <span className="text-lg font-semibold text-slate-700 tabular-nums leading-none">{service.duration}</span>
                                    <span className="text-xs text-slate-400 mt-1">min</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-10 py-6 text-center">
                                {isEditing ? (
                                  <div className="flex flex-col items-center gap-2">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={editValues.price}
                                      onChange={(event) =>
                                        setEditValues((prev) => ({ ...prev, price: event.target.value }))
                                      }
                                      className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700 focus:border-emerald-300 focus:outline-none"
                                    />
                                    <span className="text-xs text-slate-400">EUR</span>
                                  </div>
                                ) : (
                                  <p className="text-lg font-semibold text-emerald-700 tabular-nums leading-none">{formatCurrency(service.price)}</p>
                                )}
                              </td>
                              <td className="px-10 py-6 text-center">
                                <span className={`px-4 py-2 rounded-full text-xs font-medium ${
                                  service.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {service.isActive ? 'Activo' : 'Oculto'}
                                </span>
                              </td>
                              <td className="px-10 py-6 text-right">
                                <div className="flex flex-col items-end gap-2">
                                  <div className="flex items-center justify-end gap-3">
                                    <button
                                      onClick={() => copyBookingLink(service.id)}
                                      className={cn(
                                        "px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-2",
                                        copiedId === service.id
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                      )}
                                      title="Copiar enlace de reserva directa"
                                    >
                                      {copiedId === service.id ? (
                                        <>
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                          ¡Copiado!
                                        </>
                                      ) : (
                                        <>
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                          </svg>
                                          Link
                                        </>
                                      )}
                                    </button>
                                    {isEditing ? (
                                      <>
                                        <button
                                          onClick={() => handleQuickSave(service.id)}
                                          className="px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-medium hover:bg-emerald-200 transition-all"
                                          disabled={savingId === service.id}
                                        >
                                          {savingId === service.id ? 'Saving' : 'Save'}
                                        </button>
                                        <button
                                          onClick={cancelQuickEdit}
                                          className="px-4 py-2 rounded-full border border-slate-200 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-all"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => startQuickEdit(service)}
                                          className="px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium hover:bg-emerald-100 transition-all"
                                        >
                                          Quick
                                        </button>
                                        <Link href={`/dashboard/services/${service.id}`}>
                                          <button
                                            className="px-4 py-2 rounded-full border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all"
                                          >
                                            Edit
                                          </button>
                                        </Link>
                                      </>
                                    )}
                                  </div>
                                  {isEditing && editError && (
                                    <span className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider">{editError}</span>
                                  )}
                                </div>
                              </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
