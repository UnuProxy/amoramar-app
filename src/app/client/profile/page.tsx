'use client';

import React, { useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { cn } from '@/shared/lib/utils';

export default function ClientProfilePage() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: user?.email || '',
    phone: '',
    birthday: '',
    address: '',
    city: '',
    postalCode: '',
  });

  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    promotions: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement profile update
    alert('Funcionalidad de actualización próximamente');
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 pb-8 sm:space-y-10 sm:pb-10 lg:space-y-12 lg:pb-12">
      {/* Header - Bold Premium */}
      <div className="flex flex-col gap-5 sm:gap-6 md:flex-row md:items-end md:justify-between md:gap-8">
        <div>
          <h1 className="text-4xl font-black uppercase leading-none tracking-tighter text-neutral-900 sm:text-5xl lg:text-6xl">
            My Profile
          </h1>
          <p className="mt-3 text-[11px] font-black uppercase tracking-[0.22em] text-neutral-400 sm:mt-4 sm:text-sm sm:tracking-[0.3em]">
            Gestión de Datos y Preferencias
          </p>
        </div>
      </div>

      {/* Profile Form - High End */}
      <form onSubmit={handleSubmit} className="space-y-8 sm:space-y-10">
        <div className="space-y-8 rounded-[28px] border border-neutral-100 bg-white p-5 shadow-sm sm:space-y-10 sm:rounded-[40px] sm:p-8 lg:space-y-12 lg:rounded-[48px] lg:p-12">
          <div className="space-y-6 sm:space-y-8">
            <h2 className="text-sm font-black text-neutral-900 uppercase tracking-[0.3em] border-b border-neutral-100 pb-4">Datos Personales</h2>
            
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-8">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full rounded-[20px] border-2 border-neutral-100 bg-neutral-50 px-5 py-4 font-bold uppercase text-neutral-900 outline-none transition-all focus:border-rose-500 sm:rounded-[24px] sm:px-8 sm:py-6"
                  placeholder="TU NOMBRE"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Apellidos</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full rounded-[20px] border-2 border-neutral-100 bg-neutral-50 px-5 py-4 font-bold uppercase text-neutral-900 outline-none transition-all focus:border-rose-500 sm:rounded-[24px] sm:px-8 sm:py-6"
                  placeholder="TUS APELLIDOS"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Email (No Editable)</label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full cursor-not-allowed rounded-[20px] border-2 border-neutral-100 bg-neutral-100 px-5 py-4 font-bold uppercase text-neutral-400 outline-none sm:rounded-[24px] sm:px-8 sm:py-6"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-[20px] border-2 border-neutral-100 bg-neutral-50 px-5 py-4 font-bold uppercase text-neutral-900 outline-none transition-all focus:border-rose-500 sm:rounded-[24px] sm:px-8 sm:py-6"
                  placeholder="+34 000 000 000"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6 sm:space-y-8">
            <h2 className="text-sm font-black text-neutral-900 uppercase tracking-[0.3em] border-b border-neutral-100 pb-4">Ubicación</h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-8">
              <div className="md:col-span-2 space-y-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Dirección</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full rounded-[20px] border-2 border-neutral-100 bg-neutral-50 px-5 py-4 font-bold uppercase text-neutral-900 outline-none transition-all focus:border-rose-500 sm:rounded-[24px] sm:px-8 sm:py-6"
                  placeholder="CALLE, NÚMERO..."
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">C.P.</label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="w-full rounded-[20px] border-2 border-neutral-100 bg-neutral-50 px-5 py-4 font-bold uppercase text-neutral-900 outline-none transition-all focus:border-rose-500 sm:rounded-[24px] sm:px-8 sm:py-6"
                  placeholder="07800"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6 sm:space-y-8">
            <h2 className="text-sm font-black text-neutral-900 uppercase tracking-[0.3em] border-b border-neutral-100 pb-4">Notificaciones</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
              {[
                { id: 'email', label: 'EMAIL', active: notifications.email },
                { id: 'sms', label: 'SMS', active: notifications.sms },
                { id: 'promotions', label: 'OFERTAS', active: notifications.promotions },
              ].map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => setNotifications({ ...notifications, [notif.id]: !notif.active } as any)}
                  className={cn(
                    "group flex flex-col items-center gap-4 rounded-[24px] border-2 p-5 transition-all sm:rounded-[32px] sm:p-8",
                    notif.active ? "bg-neutral-900 border-neutral-900 text-white shadow-xl" : "bg-white border-neutral-100 text-neutral-400 hover:border-neutral-900"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                    notif.active ? "bg-rose-600 text-white" : "bg-neutral-50 group-hover:bg-neutral-900 group-hover:text-white"
                  )}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-black tracking-[0.2em]">{notif.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-stretch border-t border-neutral-100 pt-8 sm:justify-end sm:pt-10">
            <button
              type="submit"
              className="w-full rounded-[20px] bg-neutral-900 px-8 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-white shadow-2xl shadow-rose-200 transition-all hover:bg-rose-600 sm:w-auto sm:rounded-[24px] sm:px-12 sm:py-6 sm:text-xs sm:tracking-[0.3em]"
            >
              Save Profile
            </button>
          </div>
        </div>

        {/* Danger Zone - Premium Style */}
        <div className="rounded-[28px] border-2 border-amber-100 bg-amber-50 p-5 sm:rounded-[40px] sm:p-8 lg:rounded-[48px] lg:p-12">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center md:gap-8">
            <div className="space-y-2">
              <h2 className="text-xl font-black text-amber-900 uppercase tracking-tighter">Zona de Seguridad</h2>
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">La eliminación de la cuenta es permanente</p>
            </div>
            <button className="w-full rounded-[18px] bg-amber-600 px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-amber-100 transition-all hover:bg-amber-700 sm:w-auto sm:rounded-[20px] sm:px-10 sm:py-5">
              Cerrar Cuenta Definitivamente
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

