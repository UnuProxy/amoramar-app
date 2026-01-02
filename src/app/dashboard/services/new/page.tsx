'use client';

import React from 'react';
import { ServiceForm } from '@/back-office/dashboard/components/ServiceForm';

export default function NewServicePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-light tracking-wide text-primary-900">Añadir Nuevo Servicio</h1>
        <p className="text-primary-600 text-sm mt-2 font-light">Crear una nueva oferta de servicio</p>
      </div>
      <div className="bg-primary-800/30 border border-primary-700 rounded-sm backdrop-blur-sm p-4 sm:p-6">
        <ServiceForm />
      </div>
    </div>
  );
}



