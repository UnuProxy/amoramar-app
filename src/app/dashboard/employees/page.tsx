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
      {/* Header - Clean Professional */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-primary-800 tracking-tight">
            Team
          </h1>
          <p className="text-primary-400 text-sm font-medium mt-2">
            Staff & Talent Management
          </p>
        </div>
        <Link href="/dashboard/employees/new">
          <button
            className="px-6 py-2.5 rounded-lg bg-primary-800 text-white text-sm font-semibold hover:bg-accent-600 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Member
          </button>
        </Link>
      </div>

      {/* Team Grid/Table - Clean Professional */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-600 uppercase">Professional</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-600 uppercase">Status</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-600 uppercase">Joined</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-neutral-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-lg font-semibold text-neutral-700">No members registered</p>
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-neutral-50 transition-all group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary-800 flex items-center justify-center text-white text-sm font-semibold uppercase">
                          {employee.profileImage ? (
                            <img src={employee.profileImage} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <span>{employee.firstName[0]}{employee.lastName[0]}</span>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-neutral-900">
                            {employee.firstName} {employee.lastName}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-medium text-accent-600">{employee.position || 'Specialist'}</span>
                            <span className="text-neutral-300">•</span>
                            <span className="text-xs text-neutral-500">{employee.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] ${
                        employee.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-400'
                      }`}>
                        {employee.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-10 py-10 text-center">
                      <p className="text-sm font-medium text-neutral-600">
                        {new Date(employee.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/dashboard/employees/${employee.id}`}>
                        <button
                          className="px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-600 hover:border-accent-500 hover:text-accent-600 hover:bg-accent-50 transition-all"
                        >
                          Manage
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
