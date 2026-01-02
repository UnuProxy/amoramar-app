'use client';

import React, { useState, useEffect } from 'react';
import { getEmployees } from '@/shared/lib/firestore';
import { Button } from '@/shared/components/Button';
import { Loading } from '@/shared/components/Loading';
import Link from 'next/link';
import type { Employee } from '@/shared/lib/types';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await getEmployees();
        setEmployees(data);
      } catch (error) {
        console.error('Error fetching employees:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="sm" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 pb-12">
      {/* Header - Bold Premium */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
        <div>
          <h1 className="text-6xl font-black text-neutral-900 tracking-tighter uppercase leading-none">
            Equipo
          </h1>
          <p className="text-neutral-400 text-sm font-black uppercase tracking-[0.3em] mt-4">
            Gestión de Profesionales y Talento
          </p>
        </div>
        <Link href="/dashboard/employees/new">
          <button
            className="px-10 py-5 rounded-[20px] bg-neutral-900 text-white text-sm font-black shadow-2xl hover:bg-rose-600 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
            Añadir Miembro
          </button>
        </Link>
      </div>

      {/* Team Grid/Table - High End */}
      <div className="bg-white border border-neutral-100 rounded-[48px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50/50">
                <th className="px-10 py-8 text-left text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Profesional</th>
                <th className="px-10 py-8 text-center text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Estado</th>
                <th className="px-10 py-8 text-center text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Incorporación</th>
                <th className="px-10 py-8 text-right text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-10 py-20 text-center">
                    <div className="w-20 h-20 bg-neutral-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <svg className="w-10 h-10 text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-xl font-black text-neutral-900 uppercase tracking-widest">No hay miembros registrados</p>
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-neutral-50 transition-all group">
                    <td className="px-10 py-10">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[24px] bg-neutral-900 flex items-center justify-center text-white text-2xl font-black uppercase group-hover:scale-110 transition-transform">
                          {employee.profileImage ? (
                            <img src={employee.profileImage} alt="" className="w-full h-full object-cover rounded-[24px]" />
                          ) : (
                            <span>{employee.firstName[0]}{employee.lastName[0]}</span>
                          )}
                        </div>
                        <div>
                          <div className="text-2xl font-black text-neutral-900 uppercase tracking-tighter leading-none">
                            {employee.firstName} {employee.lastName}
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">{employee.position || 'ESPECIALISTA'}</span>
                            <span className="text-neutral-200">•</span>
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">{employee.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-10 text-center">
                      <span className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] ${
                        employee.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-400'
                      }`}>
                        {employee.status === 'active' ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td className="px-10 py-10 text-center">
                      <p className="text-lg font-black text-neutral-900 tabular-nums">
                        {new Date(employee.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase()}
                      </p>
                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">
                        {new Date(employee.createdAt).getFullYear()}
                      </p>
                    </td>
                    <td className="px-10 py-10 text-right">
                      <Link href={`/dashboard/employees/${employee.id}`}>
                        <button
                          className="px-8 py-4 rounded-2xl border-2 border-neutral-100 text-[10px] font-black text-neutral-400 hover:border-neutral-900 hover:text-neutral-900 transition-all uppercase tracking-[0.2em]"
                        >
                          Gestionar
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
