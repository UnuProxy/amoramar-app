'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/shared/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import type { LoginFormData } from '@/shared/lib/types';

export const LoginForm: React.FC = () => {
  const { login, user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect after successful login
  useEffect(() => {
    if (user && !isLoading) {
      setIsLoading(false); // Ensure loading is reset
      if (user.role === 'owner') {
        router.push('/dashboard');
      } else if (user.role === 'employee') {
        if (user.mustChangePassword) {
          router.push('/change-password');
        } else {
          router.push('/employee');
        }
      }
    }
  }, [user, isLoading, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      await login(data.email, data.password);
      // User state will update via AuthContext, triggering useEffect above
      // Set a timeout to reset loading if redirect doesn't happen
      setTimeout(() => {
        setIsLoading(false);
      }, 3000);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="p-4 text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-sm font-light">
          {error}
        </div>
      )}

      <Input
        label="Correo electrónico"
        type="email"
        {...register('email', {
          required: 'El correo electrónico es obligatorio',
          pattern: {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Dirección de correo electrónico no válida',
          },
        })}
        error={errors.email?.message}
      />

      <div>
        <Input
          label="Contraseña"
          type="password"
          showPasswordToggle={true}
          {...register('password', {
            required: 'La contraseña es obligatoria',
            minLength: {
              value: 6,
              message: 'La contraseña debe tener al menos 6 caracteres',
            },
          })}
          error={errors.password?.message}
        />
        <p className="mt-2 text-xs text-primary-500 font-light">
          Haz clic en el icono del ojo para mostrar/ocultar la contraseña
        </p>
      </div>

      <Button type="submit" isLoading={isLoading} className="w-full">
        Iniciar sesión
      </Button>
    </form>
  );
};
