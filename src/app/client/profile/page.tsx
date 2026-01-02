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
    <div className="max-w-[1200px] mx-auto space-y-12 pb-12">
      {/* Header - Bold Premium */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
        <div>
          <h1 className="text-6xl font-black text-neutral-900 tracking-tighter uppercase leading-none">
            Mi Perfil
          </h1>
          <p className="text-neutral-400 text-sm font-black uppercase tracking-[0.3em] mt-4">
            Gestión de Datos y Preferencias
          </p>
        </div>
      </div>

      {/* Profile Form - High End */}
      <form onSubmit={handleSubmit} className="space-y-10">
        <div className="bg-white border border-neutral-100 rounded-[48px] p-12 shadow-sm space-y-12">
          <div className="space-y-8">
            <h2 className="text-sm font-black text-neutral-900 uppercase tracking-[0.3em] border-b border-neutral-100 pb-4">Datos Personales</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Nombre</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-8 py-6 bg-neutral-50 border-2 border-neutral-100 rounded-[24px] text-neutral-900 font-bold focus:border-rose-500 transition-all outline-none uppercase"
                  placeholder="TU NOMBRE"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Apellidos</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-8 py-6 bg-neutral-50 border-2 border-neutral-100 rounded-[24px] text-neutral-900 font-bold focus:border-rose-500 transition-all outline-none uppercase"
                  placeholder="TUS APELLIDOS"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Email (No Editable)</label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-8 py-6 bg-neutral-100 border-2 border-neutral-100 rounded-[24px] text-neutral-400 font-bold outline-none uppercase cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Teléfono</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-8 py-6 bg-neutral-50 border-2 border-neutral-100 rounded-[24px] text-neutral-900 font-bold focus:border-rose-500 transition-all outline-none uppercase"
                  placeholder="+34 000 000 000"
                />
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <h2 className="text-sm font-black text-neutral-900 uppercase tracking-[0.3em] border-b border-neutral-100 pb-4">Ubicación</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">Dirección</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-8 py-6 bg-neutral-50 border-2 border-neutral-100 rounded-[24px] text-neutral-900 font-bold focus:border-rose-500 transition-all outline-none uppercase"
                  placeholder="CALLE, NÚMERO..."
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">C.P.</label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="w-full px-8 py-6 bg-neutral-50 border-2 border-neutral-100 rounded-[24px] text-neutral-900 font-bold focus:border-rose-500 transition-all outline-none uppercase"
                  placeholder="07800"
                />
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <h2 className="text-sm font-black text-neutral-900 uppercase tracking-[0.3em] border-b border-neutral-100 pb-4">Notificaciones</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                    "p-8 rounded-[32px] border-2 transition-all flex flex-col items-center gap-4 group",
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

          <div className="flex justify-end pt-10 border-t border-neutral-100">
            <button
              type="submit"
              className="px-12 py-6 bg-neutral-900 text-white text-xs font-black uppercase tracking-[0.3em] rounded-[24px] hover:bg-rose-600 transition-all shadow-2xl shadow-rose-200"
            >
              Guardar Perfil
            </button>
          </div>
        </div>

        {/* Danger Zone - Premium Style */}
        <div className="bg-amber-50 rounded-[48px] p-12 border-2 border-amber-100">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-2">
              <h2 className="text-xl font-black text-amber-900 uppercase tracking-tighter">Zona de Seguridad</h2>
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">La eliminación de la cuenta es permanente</p>
            </div>
            <button className="px-10 py-5 bg-amber-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-[20px] hover:bg-amber-700 transition-all shadow-xl shadow-amber-100">
              Cerrar Cuenta Definitivamente
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

