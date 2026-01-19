'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { createUser } from '@/shared/lib/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getSecondaryAuth } from '@/shared/lib/firebase';

type AdminFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

export default function NewAdminPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminFormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    },
  });

  const onSubmit = async (data: AdminFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const tempPassword = Math.random().toString(36).slice(-10) + 'Aa1!';
      const secondaryAuth = getSecondaryAuth();

      if (!secondaryAuth) {
        throw new Error('Firebase is not configured. Check your .env.local');
      }

      const email = data.email.trim().toLowerCase();
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);

      await createUser(
        {
          email,
          role: 'owner',
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          phone: data.phone?.trim() || undefined,
          mustChangePassword: true,
          isActive: true,
        },
        userCredential.user.uid
      );

      await signOut(secondaryAuth).catch(() => {});
      setGeneratedPassword(tempPassword);
    } catch (err: any) {
      const code = err?.code || err?.message || '';
      if (code.includes('auth/email-already-in-use')) {
        setError('This email is already registered. Use a different email for this admin.');
      } else if (code.includes('auth/invalid-email')) {
        setError('The email is not valid. Please verify and try again.');
      } else if (code.includes('auth/weak-password')) {
        setError('The generated password does not meet requirements. Please try again.');
      } else {
        setError(err?.message || 'Error creating admin');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-light tracking-wide text-primary-900">Añadir Nuevo Admin</h1>
        <p className="text-primary-600 text-sm mt-2 font-light">Crear una nueva cuenta de administrador</p>
      </div>

      <div className="bg-primary-800/30 border border-primary-700 rounded-sm backdrop-blur-sm p-4 sm:p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6 px-4 sm:px-0">
          {error && (
            <div className="p-3 sm:p-4 text-xs sm:text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-sm font-light">
              {error}
            </div>
          )}

          {generatedPassword && (
            <div className="p-3 sm:p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
              <p className="text-xs sm:text-sm font-semibold mb-2">Admin Created</p>
              <p className="text-xs sm:text-sm">Share this temporary password. They will be asked to change it on first login.</p>
              <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                <code className="px-3 py-2 rounded-md bg-white border border-emerald-200 text-emerald-800 font-semibold text-xs sm:text-sm break-all">
                  {generatedPassword}
                </code>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => navigator.clipboard?.writeText(generatedPassword)}
                    className="flex-1 sm:flex-none"
                  >
                    Copy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => router.push('/dashboard')}
                    className="flex-1 sm:flex-none"
                  >
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="FIRST NAME"
              {...register('firstName', { required: 'First name is required' })}
              error={errors.firstName?.message}
            />
            <Input
              label="LAST NAME"
              {...register('lastName', { required: 'Last name is required' })}
              error={errors.lastName?.message}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="EMAIL"
              type="email"
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Invalid email address',
                },
              })}
              error={errors.email?.message}
            />
            <Input
              label="PHONE"
              type="tel"
              {...register('phone')}
              error={errors.phone?.message}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
            <Button type="submit" isLoading={isLoading} className="w-full sm:w-auto">
              Create Admin
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
