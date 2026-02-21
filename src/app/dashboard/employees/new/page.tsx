'use client';

import React from 'react';
import { EmployeeForm } from '@/back-office/dashboard/components/EmployeeForm';

export default function NewEmployeePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-light tracking-wide text-slate-900">Añadir Nuevo Empleado</h1>
        <p className="text-slate-600 text-sm mt-2 font-light">Crear una nueva cuenta de empleado</p>
      </div>
      <div className="bg-slate-800/30 border border-slate-700 rounded-sm backdrop-blur-sm p-4 sm:p-6">
        <EmployeeForm />
      </div>
    </div>
  );
}



