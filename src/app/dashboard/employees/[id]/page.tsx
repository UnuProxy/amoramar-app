'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getEmployee } from '@/shared/lib/firestore';
import { EmployeeForm } from '@/back-office/dashboard/components/EmployeeForm';
import { Loading } from '@/shared/components/Loading';
import type { Employee } from '@/shared/lib/types';

export default function EditEmployeePage() {
  const params = useParams();
  const employeeId = params.id as string;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

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
    return <div>Employee not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Edit Employee</h1>
        <p className="text-gray-600 mt-1">Update employee information</p>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <EmployeeForm employee={employee} />
      </div>
    </div>
  );
}





