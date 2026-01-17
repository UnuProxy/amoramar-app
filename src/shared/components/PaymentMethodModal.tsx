'use client';

import React, { useState } from 'react';
import { Button } from './Button';
import { cn } from '@/shared/lib/utils';
import type { PaymentMethod } from '@/shared/lib/types';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, adjustedAmount?: number, notes?: string) => void;
  amount?: number;
  mode: 'deposit' | 'final';
  title?: string;
  description?: string;
  isProcessing?: boolean;
  isSelfEmployed?: boolean;
}

export function PaymentMethodModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
  mode,
  title,
  description,
  isProcessing = false,
  isSelfEmployed = false,
}: PaymentMethodModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [adjustedAmount, setAdjustedAmount] = useState<string>('0.00');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Reset state when modal opens or amount changes
  React.useEffect(() => {
    if (isOpen) {
      setAdjustedAmount(amount?.toFixed(2) || '0.00');
      setSelectedMethod('cash');
      setPaymentNotes('');
    }
  }, [isOpen, amount]);

  if (!isOpen) return null;

  const handleConfirm = (isNoDeposit: boolean = false) => {
    if (isNoDeposit) {
      onConfirm('cash', 0, 'No se cobró depósito al crear la reserva');
    } else {
      const finalAmount = parseFloat(adjustedAmount);
      onConfirm(selectedMethod, finalAmount, paymentNotes);
    }
  };

  const defaultTitle = mode === 'deposit' ? 'Registrar Depósito (50%)' : 'Cerrar Venta / Pago Final';
  const defaultDescription = mode === 'deposit' 
    ? 'Registrar el depósito inicial del cliente' 
    : 'Registrar el pago restante y cerrar la sesión';

  const hasAmountChanged = amount !== undefined && Math.abs(parseFloat(adjustedAmount) - amount) > 0.01;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-neutral-900/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden border-2 border-white/20 flex flex-col max-h-[95vh]">
        {/* Header - Fixed */}
        <div className="px-6 py-5 md:px-8 md:py-6 border-b border-neutral-100 shrink-0">
          <div className="flex items-start justify-between gap-4 text-left">
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-black text-neutral-900 uppercase tracking-tight leading-tight">
                {title || defaultTitle}
              </h2>
              {!isSelfEmployed && (
                <p className="text-[10px] md:text-xs text-neutral-500 mt-1.5 md:mt-2 font-medium">{description || defaultDescription}</p>
              )}
            </div>
            {mode === 'final' && (
              <span className="px-3 py-1 bg-rose-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full flex-shrink-0">
                Cobro Final
              </span>
            )}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="overflow-y-auto p-6 md:p-8 space-y-6 md:space-y-8 custom-scrollbar">
          {/* Amount Display/Input */}
          <div className="space-y-2 md:space-y-3">
            <label className="block text-[9px] md:text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] text-left">
              {mode === 'deposit' ? 'Monto a cobrar' : 'Pendiente de Pago'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-neutral-400">€</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={adjustedAmount}
                onChange={(e) => setAdjustedAmount(e.target.value)}
                disabled={isProcessing}
                className="w-full pl-10 pr-4 py-4 md:py-5 text-2xl md:text-3xl font-black text-neutral-900 bg-neutral-50 border-2 border-neutral-200 rounded-2xl focus:border-neutral-900 focus:outline-none disabled:opacity-50 tabular-nums transition-all no-spinner"
              />
            </div>
            <p className="text-[10px] md:text-xs text-neutral-400 font-medium text-left italic">
              {mode === 'deposit' 
                ? "Monto sugerido (50%). Edita si es necesario." 
                : "Ajusta el monto final si hubo cambios en el servicio."}
            </p>
          </div>

          {/* Payment Notes */}
          {(mode === 'final' || hasAmountChanged) && (
            <div className="space-y-2 md:space-y-3">
              <label className="block text-[9px] md:text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] text-left">
                {hasAmountChanged ? 'Motivo del cambio' : 'Notas del Pago'}
              </label>
              <textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder={mode === 'final' ? "Ej. Se agregó servicio extra..." : "Explica por qué cambió el depósito..."}
                className={cn(
                  "w-full px-4 py-3 bg-neutral-50 border-2 rounded-2xl text-neutral-900 text-base md:text-sm font-medium focus:border-neutral-900 focus:outline-none transition-all resize-none h-20 md:h-24",
                  hasAmountChanged && !paymentNotes.trim() ? "border-amber-300 ring-4 ring-amber-50" : "border-neutral-200"
                )}
              />
              {hasAmountChanged && !paymentNotes.trim() && (
                <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Nota obligatoria por ajuste
                </p>
              )}
            </div>
          )}

          {/* Payment Methods */}
          <div className="space-y-3 md:space-y-4">
            <label className="block text-[9px] md:text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] text-left">
              Método de Pago
            </label>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedMethod('cash')}
                disabled={isProcessing}
                className={cn(
                  "py-5 md:py-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2",
                  selectedMethod === 'cash'
                    ? "bg-neutral-900 border-neutral-900 text-white shadow-xl"
                    : "bg-white border-neutral-100 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-xl md:text-2xl font-light border transition-colors",
                  selectedMethod === 'cash' ? "border-white/20 bg-white/10" : "border-neutral-100 bg-neutral-50"
                )}>
                  €
                </div>
                <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Cash</p>
              </button>
              
              <button
                onClick={() => setSelectedMethod('pos')}
                disabled={isProcessing}
                className={cn(
                  "py-5 md:py-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2",
                  selectedMethod === 'pos'
                    ? "bg-neutral-900 border-neutral-900 text-white shadow-xl"
                    : "bg-white border-neutral-100 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
                  isProcessing && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border transition-colors",
                  selectedMethod === 'pos' ? "border-white/20 bg-white/10" : "border-neutral-100 bg-neutral-50"
                )}>
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect width="20" height="14" x="2" y="5" rx="2" strokeWidth={1.5} />
                    <path d="M2 10h20" strokeWidth={1.5} />
                  </svg>
                </div>
                <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Card Terminal</p>
              </button>
            </div>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 py-5 md:px-8 md:py-6 bg-neutral-50 border-t border-neutral-100 flex flex-col gap-3 shrink-0">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-[10px] md:text-xs font-black text-neutral-400 uppercase tracking-widest hover:text-neutral-900 transition-colors"
            >
              Cancelar
            </button>
            <Button
              variant="primary"
              onClick={() => handleConfirm(false)}
              disabled={isProcessing || (hasAmountChanged && !paymentNotes.trim())}
              className="flex-1 py-4 md:py-5 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-neutral-200"
            >
              {isProcessing ? 'Procesando...' : 'Confirmar'}
            </Button>
          </div>

          {/* Special skip button ONLY for deposits */}
          {mode === 'deposit' && (
            <button
              onClick={() => handleConfirm(true)}
              disabled={isProcessing}
              className="w-full py-3.5 md:py-4 text-[8px] md:text-[9px] font-black text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-all uppercase tracking-[0.2em] border border-amber-100/50"
            >
              Registrar sin cobrar depósito
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


