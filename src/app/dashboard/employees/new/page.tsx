'use client';

import React from 'react';
import { EmployeeForm } from '@/back-office/dashboard/components/EmployeeForm';
import { useLanguage } from '@/shared/context/LanguageContext';

export default function NewEmployeePage() {
  const { language } = useLanguage();
  const copy =
    language === 'es'
      ? {
          title: 'Anadir Nuevo Empleado',
          subtitle: 'Crear una nueva cuenta de empleado',
        }
      : {
          title: 'Add New Employee',
          subtitle: 'Create a new employee account',
        };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-light tracking-wide text-slate-900">{copy.title}</h1>
        <p className="text-slate-600 text-sm mt-2 font-light">{copy.subtitle}</p>
      </div>
      <div className="bg-slate-800/30 border border-slate-700 rounded-sm backdrop-blur-sm p-4 sm:p-6">
        <EmployeeForm />
      </div>
    </div>
  );
}



