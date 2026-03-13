'use client';

import React from 'react';
import { ServiceForm } from '@/back-office/dashboard/components/ServiceForm';
import { useLanguage } from '@/shared/context/LanguageContext';

export default function NewServicePage() {
  const { language } = useLanguage();
  const copy =
    language === 'es'
      ? {
          title: 'Nuevo servicio',
          subtitle: 'Crea el servicio',
        }
      : {
          title: 'New service',
          subtitle: 'Create the service',
        };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">{copy.title}</h1>
        <p className="text-slate-600 text-sm mt-2">{copy.subtitle}</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
        <ServiceForm />
      </div>
    </div>
  );
}



