'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getEmployee } from '@/shared/lib/firestore';
import { EmployeeForm } from '@/back-office/dashboard/components/EmployeeForm';
import { Loading } from '@/shared/components/Loading';
import { Button } from '@/shared/components/Button';
import { useLanguage } from '@/shared/context/LanguageContext';
import type { Employee } from '@/shared/lib/types';

export default function EditEmployeePage() {
  const params = useParams();
  const router = useRouter();
  const { language } = useLanguage();
  const employeeId = params.id as string;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const copy =
    language === 'es'
      ? {
          notFound: 'Empleado no encontrado',
          title: 'Editar Empleado',
          subtitle: 'Actualizar informacion del empleado',
          back: 'Volver a equipo',
        }
      : {
          notFound: 'Employee not found',
          title: 'Edit Employee',
          subtitle: 'Update employee information',
          back: 'Back to team',
        };

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const data = await getEmployee(employeeId);
        setEmployee(data);
      } catch (error) {
        console.error('Error fetching employee:', error);
      } finally {
        setLoading(false);
      }
    };

    if (employeeId) {
      fetchEmployee();
    }
  }, [employeeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="sm" />
      </div>
    );
  }

  if (!employee) {
    return <div>{copy.notFound}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{copy.title}</h1>
          <p className="text-gray-600 mt-1">{copy.subtitle}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => router.push('/dashboard/employees')}>
          {copy.back}
        </Button>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <EmployeeForm employee={employee} />
      </div>
    </div>
  );
}



