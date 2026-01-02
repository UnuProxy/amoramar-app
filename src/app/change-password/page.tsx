'use client';

import React, { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';
import { useAuth } from '@/shared/hooks/useAuth';
import { updateUser } from '@/shared/lib/firestore';
import { Input } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const { firebaseUser, user, logout, refreshUser, patchUser } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!password || password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (!firebaseUser || !user) {
      setError('No se pudo validar la sesión. Intenta iniciar sesión nuevamente.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(firebaseUser, password);
      await updateUser(user.id, { mustChangePassword: false });
      // Update local auth context immediately to avoid redirect loops
      patchUser({ mustChangePassword: false });
      await refreshUser();
      setSuccess('Contraseña actualizada. Ahora puedes continuar.');
      // Route the user to their dashboard immediately
      if (user.role === 'owner') {
        router.replace('/dashboard');
      } else {
        router.replace('/employee');
      }
    } catch (err: any) {
      setError(err?.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute enforcePasswordReset={false}>
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Seguridad</p>
            <h1 className="text-2xl font-semibold text-slate-900">Actualiza tu contraseña</h1>
            <p className="text-sm text-slate-600">
              Por seguridad debes cambiar la contraseña temporal que recibiste.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
              {success}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{user?.email}</span>
            <button
              type="button"
              className="text-slate-600 hover:text-slate-900 font-semibold transition"
              onClick={async () => {
                try {
                  await logout();
                } catch {
                  // Ignore logout errors; still send user to login
                }
                router.push('/login');
              }}
            >
              Cambiar de cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nueva contraseña"
              type="password"
              showPasswordToggle
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <Input
              label="Confirma la nueva contraseña"
              type="password"
              showPasswordToggle
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
            <Button type="submit" isLoading={loading} className="w-full">
              Guardar y continuar
            </Button>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
