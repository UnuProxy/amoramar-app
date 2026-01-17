'use client';

import React, { useState, useEffect } from 'react';
import { getServices, getEmployees, getEmployeeServices } from '@/shared/lib/firestore';
import { Button } from '@/shared/components/Button';
import { Loading } from '@/shared/components/Loading';
import Link from 'next/link';
import { formatCurrency, cn } from '@/shared/lib/utils';
import type { Service, Employee, EmployeeService } from '@/shared/lib/types';

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeServices, setEmployeeServices] = useState<EmployeeService[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedGeneral, setCopiedGeneral] = useState(false);

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
          <h1 className="text-4xl font-bold text-primary-800 tracking-tight">
            Services
          </h1>
          <p className="text-primary-400 text-sm font-medium mt-2">
            Services & Treatments Catalog
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={fetchServices}
            className="px-4 py-2.5 rounded-lg bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-all flex items-center justify-center"
            title="Refresh list"
          >
            <svg className={cn("w-5 h-5", loading && "animate-spin")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={copyGeneralBookingLink}
            className={cn(
              "px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
              copiedGeneral
                ? "bg-success-500 text-white"
                : "bg-accent-50 text-accent-600 border border-accent-200 hover:bg-accent-500 hover:text-white"
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
              className="px-6 py-2.5 rounded-lg bg-primary-800 text-white text-sm font-semibold hover:bg-accent-600 transition-all flex items-center justify-center gap-2"
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
              "px-5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
              copiedGeneral
                ? "bg-success-500 text-white"
                : "bg-accent-500 text-white hover:bg-accent-600"
            )}
          >
            {copiedGeneral ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Services List - Clean Professional */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase">Treatment</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase">Therapists</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-600 uppercase">Category</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-600 uppercase">Duration</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-600 uppercase">Price</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-600 uppercase">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-600 uppercase">Action</th>
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
              ) : (
                services.map((service) => {
                  const serviceEmployees = getServiceEmployees(service.id);
                  return (
                    <tr key={service.id} className="hover:bg-neutral-50 transition-all group">
                      <td className="px-10 py-10">
                        <div className="space-y-1">
                          <p className="text-2xl font-black text-neutral-900 uppercase tracking-tighter leading-none">{service.serviceName}</p>
                          {service.description && (
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest truncate max-w-xs">{service.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-10 py-10">
                        {serviceEmployees.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {serviceEmployees.map((emp) => (
                              <span
                                key={emp.id}
                                className="px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 text-[10px] font-black uppercase tracking-wider"
                              >
                                {emp.firstName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest">Sin asignar</span>
                        )}
                      </td>
                      <td className="px-10 py-10 text-center">
                      <span className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em]">
                        {service.category || 'VARIOS'}
                      </span>
                    </td>
                    <td className="px-10 py-10 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-xl font-black text-neutral-900 tabular-nums leading-none">{service.duration}</span>
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">MIN</span>
                      </div>
                    </td>
                    <td className="px-10 py-10 text-center">
                      <p className="text-2xl font-black text-rose-600 tabular-nums leading-none">{formatCurrency(service.price)}</p>
                    </td>
                    <td className="px-10 py-10 text-center">
                      <span className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] ${
                        service.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-400'
                      }`}>
                        {service.isActive ? 'ACTIVO' : 'OCULTO'}
                      </span>
                    </td>
                    <td className="px-10 py-10 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => copyBookingLink(service.id)}
                          className={cn(
                            "px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2",
                            copiedId === service.id
                              ? "bg-emerald-50 text-emerald-600 border-2 border-emerald-200"
                              : "border-2 border-rose-100 text-rose-500 hover:border-rose-600 hover:bg-rose-50"
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
                        <Link href={`/dashboard/services/${service.id}`}>
                          <button
                            className="px-8 py-4 rounded-2xl border-2 border-neutral-100 text-[10px] font-black text-neutral-400 hover:border-neutral-900 hover:text-neutral-900 transition-all uppercase tracking-[0.2em]"
                          >
                            Edit
                          </button>
                        </Link>
                      </div>
                    </td>
                  </tr>
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
