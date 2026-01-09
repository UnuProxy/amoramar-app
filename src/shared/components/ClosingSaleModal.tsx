'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { cn, formatCurrency } from '@/shared/lib/utils';
import { calculateBookingTotals } from '@/shared/lib/booking-utils';
import type { Booking, Service, PaymentMethod, Employee } from '@/shared/lib/types';

interface ClosingSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  services: Service[];
  employees?: Employee[]; // Optional: only shown in admin mode
  onConfirm: (method: PaymentMethod, amount: number, notes: string, closedByEmployeeId?: string) => void;
  isProcessing?: boolean;
}

export function ClosingSaleModal({
  isOpen,
  onClose,
  booking,
  services,
  employees = [],
  onConfirm,
  isProcessing = false
}: ClosingSaleModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [finalAmount, setFinalAmount] = useState<string>('0.00');
  const [notes, setNotes] = useState('');
  const [closedByEmployeeId, setClosedByEmployeeId] = useState<string>('auto');

  const service = booking ? services.find(s => s.id === booking.serviceId) : null;
  
  // Use shared utility for precise calculations
  const { 
    basePrice, 
    extrasTotal, 
    totalPrice, 
    depositPaidValue, 
    outstanding 
  } = calculateBookingTotals(booking || ({} as Booking), service);

  const extras = booking?.additionalServices || [];

  useEffect(() => {
    if (isOpen && booking) {
      setFinalAmount(outstanding.toFixed(2));
      setNotes(booking.paymentNotes || '');
      setSelectedMethod('cash');
      // Default to the employee assigned to this booking
      setClosedByEmployeeId(booking.employeeId || 'auto');
    }
  }, [isOpen, booking, outstanding]);

  if (!isOpen || !booking) return null;

  const handleConfirm = () => {
    const employeeId = closedByEmployeeId === 'auto' ? undefined : closedByEmployeeId;
    onConfirm(selectedMethod, parseFloat(finalAmount), notes, employeeId);
  };

  const isAdjusted = Math.abs(parseFloat(finalAmount) - outstanding) > 0.01;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-neutral-900/80 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-2xl border-2 border-white/20 overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]">
        {/* Header - Fixed */}
        <div className="px-6 py-5 md:px-10 md:py-6 bg-neutral-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight italic leading-none">Cerrar Venta</h2>
            <p className="text-neutral-400 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] mt-1">Finalización y cobro</p>
          </div>
          <div className="px-3 py-1.5 bg-rose-600 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest">
            Cobro Final
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="overflow-y-auto overflow-x-hidden p-6 md:p-10 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {/* Left Column: Summary */}
            <div className="space-y-6">
              <div>
                <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Cliente</label>
                <p className="text-lg font-black text-neutral-900 uppercase leading-tight">{booking.clientName}</p>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Detalle</label>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm py-1.5 border-b border-neutral-50">
                    <span className="font-bold text-neutral-600 truncate mr-2">{service?.serviceName || 'Servicio'}</span>
                    <span className="font-black text-neutral-900 shrink-0">{formatCurrency(basePrice)}</span>
                  </div>
                  {extras.map(extra => (
                    <div key={extra.id} className="flex justify-between text-xs py-1.5 border-b border-neutral-50">
                      <span className="font-bold text-neutral-500 truncate mr-2 italic">+ {extra.serviceName}</span>
                      <span className="font-black text-neutral-900 shrink-0">{formatCurrency(extra.price)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  <span>Subtotal</span>
                  <span>{formatCurrency(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  <span>Anticipo</span>
                  <span>- {formatCurrency(depositPaidValue)}</span>
                </div>
                <div className="flex justify-between pt-3 border-t-2 border-neutral-900 mt-2">
                  <span className="text-xs font-black uppercase tracking-widest text-neutral-900">A cobrar</span>
                  <span className="text-lg font-black text-neutral-900">{formatCurrency(outstanding)}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Payment & Adjustments */}
            <div className="space-y-6 bg-neutral-50 p-6 md:p-8 rounded-[24px] md:rounded-[32px] border border-neutral-100">
              {/* Final Amount Adjustment */}
              <div className="space-y-2">
                <label className="block text-[9px] font-black text-neutral-800 uppercase tracking-[0.2em]">
                  Monto percibido
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-neutral-400">€</span>
                  <input
                    type="number"
                    step="0.01"
                    value={finalAmount}
                    onChange={(e) => setFinalAmount(e.target.value)}
                    className={cn(
                      "w-full pl-10 pr-4 py-4 text-2xl font-black text-neutral-900 bg-white border-2 rounded-xl focus:outline-none transition-all tabular-nums no-spinner",
                      isAdjusted ? "border-amber-500 ring-4 ring-amber-50" : "border-neutral-200 focus:border-neutral-900"
                    )}
                  />
                </div>
                {isAdjusted && (
                  <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest italic flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Monto ajustado manualmente
                  </p>
                )}
              </div>

              {/* Adjustment Notes */}
              <div className="space-y-2">
                <label className="block text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                  Nota administrativa
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Explica el cambio si aplica..."
                  className={cn(
                    "w-full px-4 py-3 bg-white border-2 rounded-xl text-base md:text-sm font-medium focus:border-neutral-900 focus:outline-none transition-all resize-none h-20",
                    isAdjusted && !notes.trim() ? "border-amber-300 ring-4 ring-amber-50" : "border-neutral-200"
                  )}
                />
              </div>

              {/* Who Closed This Sale (Admin Only) */}
              {employees.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-[9px] font-black text-rose-600 uppercase tracking-[0.2em] flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    ¿Quién cerró esta venta?
                  </label>
                  <select
                    value={closedByEmployeeId}
                    onChange={(e) => setClosedByEmployeeId(e.target.value)}
                    className="w-full px-4 py-4 bg-white border-2 border-neutral-200 rounded-xl text-sm font-black uppercase focus:border-rose-600 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="auto">Yo mismo (Admin)</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                  <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider italic">
                    Selecciona quién atendió y cobró al cliente
                  </p>
                </div>
              )}

              {/* Payment Methods */}
              <div className="space-y-3">
                <label className="block text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Método de Pago</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedMethod('cash')}
                    className={cn(
                      "py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1",
                      selectedMethod === 'cash' ? "bg-neutral-900 border-neutral-900 text-white shadow-lg" : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-400"
                    )}
                  >
                    <span className="text-xl leading-none">€</span>
                    <span className="text-[8px] font-black uppercase tracking-widest">Efectivo</span>
                  </button>
                  <button
                    onClick={() => setSelectedMethod('pos')}
                    className={cn(
                      "py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1",
                      selectedMethod === 'pos' ? "bg-neutral-900 border-neutral-900 text-white shadow-lg" : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-400"
                    )}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect width="20" height="14" x="2" y="5" rx="2" strokeWidth={1.5} />
                      <path d="M2 10h20" strokeWidth={1.5} />
                    </svg>
                    <span className="text-[8px] font-black uppercase tracking-widest">Datáfono</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 py-5 md:px-10 md:py-6 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between gap-4 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] hover:text-neutral-900 transition-colors"
          >
            Volver
          </button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={isProcessing || (isAdjusted && !notes.trim())}
            className="px-8 py-4 md:px-12 md:py-5 text-xs md:text-sm font-black uppercase tracking-[0.2em] shadow-xl md:shadow-2xl shadow-rose-200 flex-1 md:flex-none"
          >
            {isProcessing ? 'Procesando...' : 'Cerrar Venta'}
          </Button>
        </div>
      </div>
    </div>
  );
}

