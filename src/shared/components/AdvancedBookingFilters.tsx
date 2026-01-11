'use client';

import React, { useState } from 'react';
import { Button } from './Button';
import { cn } from '@/shared/lib/utils';
import type { Employee, Service, BookingStatus, PaymentMethod } from '@/shared/lib/types';

export interface AdvancedFilters {
  search: string;
  employeeId: string;
  serviceId: string;
  status: 'all' | BookingStatus;
  paymentStatus: 'all' | 'paid' | 'unpaid' | 'partial';
  createdBy: 'all' | 'client' | 'staff';
  paymentMethod: 'all' | PaymentMethod;
  dateFrom: string;
  dateTo: string;
}

interface AdvancedBookingFiltersProps {
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
  employees: Employee[];
  services: Service[];
}

export function AdvancedBookingFilters({
  filters,
  onFiltersChange,
  employees,
  services,
}: AdvancedBookingFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = <K extends keyof AdvancedFilters>(
    key: K,
    value: AdvancedFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    onFiltersChange({
      search: '',
      employeeId: 'all',
      serviceId: 'all',
      status: 'all',
      paymentStatus: 'all',
      createdBy: 'all',
      paymentMethod: 'all',
      dateFrom: '',
      dateTo: '',
    });
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'search') return value.length > 0;
    if (key === 'dateFrom' || key === 'dateTo') return value.length > 0;
    return value !== 'all';
  }).length;

  return (
    <div className="bg-white border border-neutral-100 rounded-3xl shadow-md overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-base font-black text-neutral-900 uppercase tracking-tight">
              Filtros Avanzados
            </h3>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">
              {activeFilterCount > 0 ? `${activeFilterCount} filtros activos` : 'Ningún filtro aplicado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black">
              {activeFilterCount}
            </span>
          )}
          <svg
            className={cn(
              'w-5 h-5 text-neutral-400 transition-transform',
              isExpanded && 'rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Filter Controls */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-neutral-100 pt-6 space-y-6">
          {/* Search */}
          <div>
            <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">
              Buscar
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder="Nombre, email o teléfono..."
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">
                Desde
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter('dateFrom', e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">
                Hasta
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Employee & Service */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">
                Terapeuta
              </label>
              <select
                value={filters.employeeId}
                onChange={(e) => updateFilter('employeeId', e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="all">Todos los terapeutas</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">
                Servicio
              </label>
              <select
                value={filters.serviceId}
                onChange={(e) => updateFilter('serviceId', e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="all">Todos los servicios</option>
                {services.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.serviceName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">
                Estado de Reserva
              </label>
              <select
                value={filters.status}
                onChange={(e) => updateFilter('status', e.target.value as any)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendiente</option>
                <option value="confirmed">Confirmada</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
                <option value="no-show">No Presentado</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">
                Estado de Pago
              </label>
              <select
                value={filters.paymentStatus}
                onChange={(e) => updateFilter('paymentStatus', e.target.value as any)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="all">Todos</option>
                <option value="paid">Pagado</option>
                <option value="unpaid">Sin Pagar</option>
                <option value="partial">Pago Parcial</option>
              </select>
            </div>
          </div>

          {/* Created By & Payment Method */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">
                Creada Por
              </label>
              <select
                value={filters.createdBy}
                onChange={(e) => updateFilter('createdBy', e.target.value as any)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="all">Todos</option>
                <option value="client">Cliente (Online)</option>
                <option value="staff">Personal (Walk-in)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">
                Método de Pago
              </label>
              <select
                value={filters.paymentMethod}
                onChange={(e) => updateFilter('paymentMethod', e.target.value as any)}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium focus:border-blue-500 focus:outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="all">Todos</option>
                <option value="cash">Efectivo</option>
                <option value="pos">Datáfono</option>
                <option value="online">Online</option>
                <option value="stripe">Stripe</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-neutral-100">
            <Button
              variant="outline"
              onClick={resetFilters}
              className="flex-1 text-sm"
            >
              Limpiar Filtros
            </Button>
            <Button
              variant="primary"
              onClick={() => setIsExpanded(false)}
              className="flex-1 text-sm"
            >
              Aplicar ({activeFilterCount})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
