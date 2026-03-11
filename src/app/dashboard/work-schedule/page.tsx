'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getEmployees } from '@/shared/lib/firestore';
import { Loading } from '@/shared/components/Loading';
import { EmployeeScheduleManager } from '@/back-office/dashboard/components/EmployeeScheduleManager';
import { useLanguage } from '@/shared/context/LanguageContext';
import type { Employee } from '@/shared/lib/types';

export default function WorkSchedulePage() {
  const { language } = useLanguage();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const copy =
    language === 'es'
      ? {
          noActive: 'No se encontraron empleados activos',
          addEmployeesFirst: 'Anade empleados primero para configurar horarios.',
          selectEmployee: 'Seleccionar empleado',
          specialist: 'Especialista',
          selectEmployeeHint: 'Selecciona un empleado para gestionar su horario.',
        }
      : {
          noActive: 'No active employees found',
          addEmployeesFirst: 'Add employees first to configure schedules.',
          selectEmployee: 'Select Employee',
          specialist: 'Specialist',
          selectEmployeeHint: 'Select an employee to manage their schedule.',
        };

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const all = await getEmployees();
        const active = all.filter((employee) => employee.status === 'active');
        setEmployees(active);
        if (active.length > 0) {
          setSelectedEmployeeId(active[0].id);
        }
      } catch (error) {
        console.error('Error fetching employees for work schedule:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="sm" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-10">
      {employees.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-lg font-semibold text-slate-700">{copy.noActive}</p>
          <p className="text-slate-500 text-sm mt-2">{copy.addEmployeesFirst}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <aside className="bg-white border border-slate-200 rounded-2xl p-4 lg:p-5 h-fit">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">{copy.selectEmployee}</h2>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {employees.map((employee) => {
                const active = employee.id === selectedEmployeeId;
                return (
                  <button
                    key={employee.id}
                    onClick={() => setSelectedEmployeeId(employee.id)}
                    className={`w-full text-left rounded-xl border px-3 py-3 transition-all ${
                      active
                        ? 'border-sky-300 bg-sky-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {employee.firstName} {employee.lastName}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{employee.position || copy.specialist}</p>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-w-0">
            {selectedEmployee ? (
              <EmployeeScheduleManager
                employeeId={selectedEmployee.id}
                employeeName={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`.trim()}
              />
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-8">
                <p className="text-slate-600">{copy.selectEmployeeHint}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
