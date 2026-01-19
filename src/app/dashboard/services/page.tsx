'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getServices, getEmployees, getEmployeeServices, updateService, createService } from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import Link from 'next/link';
import { formatCurrency, cn } from '@/shared/lib/utils';
import { formatServiceCategory, getOrderedServiceCategories } from '@/shared/lib/serviceCategories';
import type { Service, Employee, EmployeeService } from '@/shared/lib/types';
import { DEFAULT_SERVICES } from '@/shared/lib/defaultServices';

export default function ServicesPage() {
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

  const categoryOptions = useMemo(
    () => getOrderedServiceCategories(services, { includeEmptyDefaults: true }),
    [services]
  );

  const filteredServices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return services.filter((service) => {
      if (statusFilter === 'active' && !service.isActive) return false;
      if (statusFilter === 'hidden' && service.isActive) return false;
      if (!term) return true;

      const categoryLabel = formatServiceCategory(service.category || 'other').toLowerCase();
      return (
        service.serviceName.toLowerCase().includes(term) ||
        (service.description || '').toLowerCase().includes(term) ||
        categoryLabel.includes(term)
      );
    });
  }, [services, searchTerm, statusFilter]);

  const servicesByCategory = useMemo(() => {
    const grouped = filteredServices.reduce<Record<string, Service[]>>((acc, service) => {
      const category = service.category || 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(service);
      return acc;
    }, {});

    Object.values(grouped).forEach((items) => {
      items.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
    });

    return grouped;
  }, [filteredServices]);

  const orderedCategories = useMemo(
    () => getOrderedServiceCategories(filteredServices),
    [filteredServices]
  );

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
      'Import the default service list? Existing services with the same name and category will be skipped.'
    );
    if (!confirmed) return;

    setIsImporting(true);
    setImportMessage(null);

    try {
      const existingKeys = new Set(
        services.map((service) => `${service.category}|${service.serviceName}`.toLowerCase())
      );
      let createdCount = 0;
      const salonId = 'default-salon-id';

      for (const seed of DEFAULT_SERVICES) {
        const key = `${seed.category}|${seed.serviceName}`.toLowerCase();
        if (existingKeys.has(key)) continue;

        await createService({
          salonId,
          serviceName: seed.serviceName,
          description: seed.description,
          duration: seed.duration,
          price: seed.price,
          category: seed.category,
          isActive: true,
          offersConsultation: false,
          consultationDuration: 20,
        });

        existingKeys.add(key);
        createdCount += 1;
      }

      await fetchServices();
      setImportMessage(
        createdCount > 0
          ? `${createdCount} services imported.`
          : 'All default services already exist.'
      );
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
          <h1 className="text-3xl font-semibold text-stone-800 tracking-tight">
            Services
          </h1>
          <p className="text-stone-500 text-sm font-medium mt-2">
            Services & Treatments Catalog
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={fetchServices}
            className="px-4 py-2.5 rounded-full bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 transition-all flex items-center justify-center"
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
                ? "bg-stone-100 text-stone-400 border-stone-200"
                : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
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
      <div className="bg-accent-50 rounded-2xl p-6 border border-accent-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-accent-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-primary-800 mb-1">Booking Link for Clients</p>
              <p className="text-sm text-primary-600">Share this link on your website, Instagram or WhatsApp. Clients will see all services and can book directly.</p>
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
        <div className="bg-white border border-neutral-200 rounded-2xl px-6 py-4 text-sm text-neutral-700">
          {importMessage}
        </div>
      )}

      {/* Search + Filters */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 lg:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-stone-500 tracking-wide mb-2">
              Search Services
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, description, or group"
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 focus:border-emerald-300 focus:outline-none"
            />
          </div>
          <div className="w-full lg:w-56">
            <label className="block text-xs font-medium text-stone-500 tracking-wide mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'hidden')}
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-medium text-stone-700 focus:border-emerald-300 focus:outline-none"
            >
              <option value="all">All services</option>
              <option value="active">Only active</option>
              <option value="hidden">Only hidden</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-stone-500 tracking-wide">
            <span className="px-3 py-2 rounded-full bg-stone-50 border border-stone-200 text-stone-600">
              {filteredServices.length} total
            </span>
            <span className="px-3 py-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              {filteredServices.filter((s) => s.isActive).length} active
            </span>
            <span className="px-3 py-2 rounded-full bg-stone-100 text-stone-500 border border-stone-200">
              {filteredServices.filter((s) => !s.isActive).length} hidden
            </span>
          </div>
        </div>
      </div>

      {/* Services List - Grouped */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-6 py-4 text-left text-[11px] font-medium text-stone-500 tracking-wide">Treatment</th>
                <th className="px-6 py-4 text-left text-[11px] font-medium text-stone-500 tracking-wide">Therapists</th>
                <th className="px-6 py-4 text-center text-[11px] font-medium text-stone-500 tracking-wide">Group</th>
                <th className="px-6 py-4 text-center text-[11px] font-medium text-stone-500 tracking-wide">Duration</th>
                <th className="px-6 py-4 text-center text-[11px] font-medium text-stone-500 tracking-wide">Price</th>
                <th className="px-6 py-4 text-center text-[11px] font-medium text-stone-500 tracking-wide">Status</th>
                <th className="px-6 py-4 text-right text-[11px] font-medium text-stone-500 tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-neutral-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-lg font-semibold text-neutral-700">Empty Catalog</p>
                  </td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-neutral-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-lg font-semibold text-neutral-700">No services match your filters</p>
                    <p className="text-sm text-neutral-400 mt-2">Try clearing the search or status filter.</p>
                  </td>
                </tr>
              ) : (
                orderedCategories.map((category) => {
                  const grouped = servicesByCategory[category] || [];
                  if (!grouped.length) return null;
                  const isCollapsed = collapsedCategories[category] ?? false;
                  const activeCount = grouped.filter((service) => service.isActive).length;
                  const hiddenCount = grouped.length - activeCount;

                  return (
                    <React.Fragment key={category}>
                      <tr className="bg-stone-50 border-y border-stone-200">
                        <td colSpan={7} className="px-6 py-4">
                          <button
                            onClick={() =>
                              setCollapsedCategories((prev) => ({
                                ...prev,
                                [category]: !isCollapsed,
                              }))
                            }
                            className="w-full flex items-center gap-4 text-left"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-stone-700">
                                {formatServiceCategory(category)}
                              </span>
                              <span className="text-xs text-stone-400">
                                {grouped.length} total · {activeCount} active · {hiddenCount} hidden
                              </span>
                            </div>
                            <span className="ml-auto flex items-center gap-2 text-xs font-medium text-stone-400">
                              {isCollapsed ? 'Expand' : 'Collapse'}
                              <svg
                                className={cn("w-4 h-4 transition-transform", isCollapsed && "rotate-180")}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </span>
                          </button>
                        </td>
                      </tr>
                      {!isCollapsed &&
                        grouped.map((service) => {
                          const serviceEmployees = getServiceEmployees(service.id);
                          const isEditing = editingServiceId === service.id;
                          return (
                            <tr key={service.id} className="hover:bg-neutral-50 transition-all group">
                              <td className="px-10 py-10">
                                <div className="space-y-1">
                                  <p className="text-lg font-semibold text-stone-800 leading-snug">{service.serviceName}</p>
                                  {service.description && (
                                    <p className="text-xs text-stone-400 truncate max-w-xs">{service.description}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-10 py-10">
                                {serviceEmployees.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {serviceEmployees.map((emp) => (
                                      <span
                                        key={emp.id}
                                        className="px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-xs font-medium"
                                      >
                                        {emp.firstName}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-stone-400">Sin asignar</span>
                                )}
                              </td>
                              <td className="px-10 py-10 text-center">
                                {isEditing ? (
                                  <select
                                    value={editValues.category}
                                    onChange={(event) =>
                                      setEditValues((prev) => ({ ...prev, category: event.target.value }))
                                    }
                                    className="w-56 rounded-xl border border-stone-200 bg-white px-3 py-2 text-center text-sm font-medium text-stone-700 focus:border-emerald-300 focus:outline-none"
                                  >
                                    {categoryOptions.map((cat) => (
                                      <option key={cat} value={cat}>
                                        {formatServiceCategory(cat)}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="px-4 py-2 rounded-full bg-stone-100 text-stone-600 text-xs font-medium">
                                    {formatServiceCategory(service.category || 'other')}
                                  </span>
                                )}
                              </td>
                              <td className="px-10 py-10 text-center">
                                {isEditing ? (
                                  <div className="flex flex-col items-center gap-2">
                                    <input
                                      type="number"
                                      min={15}
                                      value={editValues.duration}
                                      onChange={(event) =>
                                        setEditValues((prev) => ({ ...prev, duration: event.target.value }))
                                      }
                                      className="w-24 rounded-xl border border-stone-200 bg-white px-3 py-2 text-center text-sm font-medium text-stone-700 focus:border-emerald-300 focus:outline-none"
                                    />
                                    <span className="text-xs text-stone-400">min</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center">
                                    <span className="text-lg font-semibold text-stone-700 tabular-nums leading-none">{service.duration}</span>
                                    <span className="text-xs text-stone-400 mt-1">min</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-10 py-10 text-center">
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
                                      className="w-28 rounded-xl border border-stone-200 bg-white px-3 py-2 text-center text-sm font-medium text-stone-700 focus:border-emerald-300 focus:outline-none"
                                    />
                                    <span className="text-xs text-stone-400">EUR</span>
                                  </div>
                                ) : (
                                  <p className="text-lg font-semibold text-emerald-700 tabular-nums leading-none">{formatCurrency(service.price)}</p>
                                )}
                              </td>
                              <td className="px-10 py-10 text-center">
                                <span className={`px-4 py-2 rounded-full text-xs font-medium ${
                                  service.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                                }`}>
                                  {service.isActive ? 'Activo' : 'Oculto'}
                                </span>
                              </td>
                              <td className="px-10 py-10 text-right">
                                <div className="flex flex-col items-end gap-2">
                                  <div className="flex items-center justify-end gap-3">
                                    <button
                                      onClick={() => copyBookingLink(service.id)}
                                      className={cn(
                                        "px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-2",
                                        copiedId === service.id
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                          : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
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
                                          className="px-4 py-2 rounded-full border border-stone-200 text-xs font-medium text-stone-500 hover:bg-stone-50 transition-all"
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
                                            className="px-4 py-2 rounded-full border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-all"
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
