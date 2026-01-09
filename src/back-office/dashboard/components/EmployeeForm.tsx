'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { createEmployee, updateEmployee, createUser } from '@/shared/lib/firestore';
import { uploadEmployeeProfileImage, deleteEmployeeProfileImage } from '@/shared/lib/storage';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getSecondaryAuth } from '@/shared/lib/firebase';
import type { Employee, EmployeeFormData, EmploymentType } from '@/shared/lib/types';

interface EmployeeFormProps {
  employee?: Employee;
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({ employee }) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | undefined>(employee?.profileImage || undefined);
  const [uploadingImage, setUploadingImage] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmployeeFormData>({
    defaultValues: employee
      ? {
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email || '',
          phone: employee.phone || '',
          bio: employee.bio || '',
          nationalId: employee.nationalId || '',
          position: employee.position || '',
          employmentType: employee.employmentType || 'employee',
          addressLine1: employee.addressLine1 || '',
          city: employee.city || '',
          province: employee.province || '',
          postalCode: employee.postalCode || '',
        }
      : {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          bio: '',
          nationalId: '',
          position: '',
          employmentType: 'employee' as EmploymentType,
          addressLine1: '',
          city: '',
          province: '',
          postalCode: '',
        },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setProfileImageFile(null);
    setProfileImagePreview(undefined);
  };

  const onSubmit = async (data: EmployeeFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      // For now, we'll use a placeholder salonId - in production, get from context
      const salonId = 'default-salon-id';
      
      let profileImageUrl = employee?.profileImage;

      if (employee) {
        // Upload new image if selected
        if (profileImageFile) {
          setUploadingImage(true);
          // Delete old image if exists
          if (employee.profileImage) {
            await deleteEmployeeProfileImage(employee.profileImage).catch(console.error);
          }
          profileImageUrl = await uploadEmployeeProfileImage(profileImageFile, employee.id);
          setUploadingImage(false);
        } else if (profileImagePreview === undefined && employee.profileImage) {
          // Image was removed
          await deleteEmployeeProfileImage(employee.profileImage).catch(console.error);
          profileImageUrl = null;
        }

        // Update existing employee
        await updateEmployee(employee.id, {
          firstName: data.firstName,
          lastName: data.lastName,
          bio: data.bio || null,
          profileImage: profileImageUrl,
          phone: data.phone,
          nationalId: data.nationalId,
          position: data.position,
          employmentType: data.employmentType,
          addressLine1: data.addressLine1,
          city: data.city,
          province: data.province,
          postalCode: data.postalCode,
        });
      } else {
        // Create new employee with user account
        const tempPassword = Math.random().toString(36).slice(-10) + 'Aa1!';

        const secondaryAuth = getSecondaryAuth();
        if (!secondaryAuth) {
          throw new Error('Firebase no está configurado para crear usuarios. Verifica tu .env.local');
        }

        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth,
          data.email,
          tempPassword
        );

        // Create user record
        await createUser(
          {
            email: data.email,
            role: 'employee',
            phone: data.phone,
            mustChangePassword: true,
            isActive: true,
          },
          userCredential.user.uid
        );

        // Sign out from the secondary auth instance so the owner session stays active
        await signOut(secondaryAuth).catch(() => {});

        // Create employee record first
        const employeeId = await createEmployee({
          userId: userCredential.user.uid,
          salonId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          bio: data.bio || null,
          profileImage: null, // Will update after upload if image exists
          nationalId: data.nationalId,
          position: data.position,
          employmentType: data.employmentType,
          addressLine1: data.addressLine1,
          city: data.city,
          province: data.province,
          postalCode: data.postalCode,
          status: 'active',
        });

        // Upload profile image if selected
        if (profileImageFile) {
          setUploadingImage(true);
          const imageUrl = await uploadEmployeeProfileImage(profileImageFile, employeeId);
          await updateEmployee(employeeId, { profileImage: imageUrl });
          setUploadingImage(false);
        }

        setGeneratedPassword(tempPassword);
        setIsLoading(false);

        return;
      }

      if (!employee) {
        router.refresh();
      }
      router.push('/dashboard/employees');
    } catch (err: any) {
      const code = err?.code || err?.message || '';
      if (code.includes('auth/email-already-in-use')) {
        setError('Ese correo ya está registrado. Usa un correo diferente para este empleado.');
      } else if (code.includes('auth/invalid-email')) {
        setError('El correo no es válido. Verifícalo e inténtalo de nuevo.');
      } else if (code.includes('auth/weak-password')) {
        setError('La contraseña generada no cumple los requisitos. Inténtalo nuevamente.');
      } else {
        setError(err.message || 'Error al guardar el empleado');
      }
    } finally {
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

      {generatedPassword && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
          <p className="text-sm font-semibold mb-2">Cuenta creada</p>
          <p className="text-sm">Entrega esta contraseña temporal al empleado. Se le pedirá cambiarla en su primer acceso.</p>
          <div className="mt-3 flex items-center gap-3">
            <code className="px-3 py-2 rounded-md bg-white border border-emerald-200 text-emerald-800 font-semibold">
              {generatedPassword}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigator.clipboard?.writeText(generatedPassword)}
            >
              Copiar
            </Button>
            <Button type="button" size="sm" onClick={() => router.push('/dashboard/employees')}>
              Ir a empleados
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nombre"
          {...register('firstName', { required: 'El nombre es obligatorio' })}
          error={errors.firstName?.message}
        />
        <Input
          label="Apellidos"
          {...register('lastName', { required: 'Los apellidos son obligatorios' })}
          error={errors.lastName?.message}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Correo Electrónico"
          type="email"
          disabled={!!employee}
          {...register('email', {
            required: 'El correo electrónico es obligatorio',
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Dirección de correo electrónico no válida',
            },
          })}
          error={errors.email?.message}
        />
        <Input
          label="Teléfono"
          type="tel"
          {...register('phone', { required: 'El teléfono es obligatorio' })}
          error={errors.phone?.message}
        />
      </div>

      <Input
        label="DNI / NIE"
        {...register('nationalId', { required: 'El DNI/NIE es obligatorio' })}
        error={errors.nationalId?.message}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-light tracking-wide text-primary-600 uppercase mb-2">
            Puesto
          </label>
          <select
            {...register('position', { required: 'El puesto es obligatorio' })}
            className="w-full px-4 py-3 border border-primary-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-500 bg-white text-primary-900 font-light"
            defaultValue={employee?.position || ''}
          >
            <option value="" disabled>Selecciona un puesto</option>
            <option value="Peluquería">Peluquería</option>
            <option value="Barbería">Barbería</option>
            <option value="Manicura / Pedicura">Manicura / Pedicura</option>
            <option value="Estética">Estética</option>
            <option value="Colorista">Colorista</option>
            <option value="Recepción">Recepción</option>
            <option value="Maquillaje">Maquillaje</option>
            <option value="Otro">Otro</option>
          </select>
          {errors.position?.message && (
            <p className="mt-2 text-xs text-red-600 font-light">{errors.position.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-light tracking-wide text-primary-600 uppercase mb-2">
            Tipo de Contrato
          </label>
          <select
            {...register('employmentType', { required: 'El tipo de contrato es obligatorio' })}
            className="w-full px-4 py-3 border border-primary-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-500 bg-white text-primary-900 font-light"
            defaultValue={employee?.employmentType || 'employee'}
          >
            <option value="employee">Empleado Regular</option>
            <option value="self-employed">Autónomo</option>
          </select>
          {errors.employmentType?.message && (
            <p className="mt-2 text-xs text-red-600 font-light">{errors.employmentType.message}</p>
          )}
          <p className="mt-2 text-xs text-primary-400 italic">
            Autónomos gestionan su propia agenda y pagos (solo depósito 50%)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Dirección"
          {...register('addressLine1', { required: 'La dirección es obligatoria' })}
          error={errors.addressLine1?.message}
        />
        <Input
          label="Ciudad"
          {...register('city', { required: 'La ciudad es obligatoria' })}
          error={errors.city?.message}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Provincia"
          {...register('province', { required: 'La provincia es obligatoria' })}
          error={errors.province?.message}
        />
        <Input
          label="Código Postal"
          {...register('postalCode', { required: 'El código postal es obligatorio' })}
          error={errors.postalCode?.message}
        />
      </div>

      <div>
        <label className="block text-xs font-light tracking-wide text-primary-600 uppercase mb-2">
          Biografía
        </label>
        <textarea
          {...register('bio')}
          rows={4}
          className="w-full px-4 py-3 border border-primary-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-500 bg-white text-primary-900 font-light"
        />
      </div>

      {/* Profile Image Upload */}
      <div>
        <label className="block text-xs font-light tracking-wide text-primary-600 uppercase mb-2">
          Foto de Perfil
        </label>
        <div className="flex items-start gap-4">
          {/* Image Preview */}
          {profileImagePreview ? (
            <div className="relative">
              <img
                src={profileImagePreview}
                alt="Preview"
                className="w-32 h-32 object-cover rounded-lg border-2 border-primary-300"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 transition flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="w-32 h-32 border-2 border-dashed border-primary-300 rounded-lg flex items-center justify-center bg-primary-50">
              <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex-1">
            <input
              type="file"
              id="profileImage"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <label
              htmlFor="profileImage"
              className="inline-block px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition cursor-pointer text-sm font-medium"
            >
              {profileImagePreview ? 'Cambiar foto' : 'Subir foto'}
            </label>
            <p className="text-xs text-primary-600 mt-2">
              JPG, PNG o GIF. Máximo 5MB.
            </p>
            {uploadingImage && (
              <p className="text-xs text-accent-600 mt-2 flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Subiendo imagen...
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" isLoading={isLoading}>
          {employee ? 'Actualizar Empleado' : 'Crear Empleado'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/employees')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
};
