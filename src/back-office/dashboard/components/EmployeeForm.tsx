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
  const [isDeleting, setIsDeleting] = useState(false);
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
          profileImageUrl = undefined;
        }

        // Update existing employee
        await updateEmployee(employee.id, {
          firstName: data.firstName,
          lastName: data.lastName,
          bio: data.bio || undefined,
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
          throw new Error('Firebase is not configured to create users. Check your .env.local');
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
          bio: data.bio || undefined,
          profileImage: undefined, // Will update after upload if image exists
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
        setError('This email is already registered. Use a different email for this employee.');
      } else if (code.includes('auth/invalid-email')) {
        setError('The email is not valid. Please verify and try again.');
      } else if (code.includes('auth/weak-password')) {
        setError('The generated password does not meet requirements. Please try again.');
      } else {
        setError(err.message || 'Error saving employee');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!employee) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${employee.firstName} ${employee.lastName}? This action cannot be undone.\n\nThis will:\n- Remove their employee account\n- Remove their login access\n- Keep their booking history for records`
    );

    if (!confirmDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      console.log('Starting employee deletion for ID:', employee.id);
      
      // Delete profile image first if exists
      if (employee.profileImage) {
        try {
          console.log('Deleting profile image:', employee.profileImage);
          await deleteEmployeeProfileImage(employee.profileImage);
          console.log('Profile image deleted successfully');
        } catch (imgError) {
          console.error('Error deleting profile image (continuing):', imgError);
          // Continue with employee deletion even if image fails
        }
      }

      console.log('Sending DELETE request to API...');
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('DELETE response status:', response.status);
      
      const result = await response.json();
      console.log('DELETE response body:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete employee');
      }

      // Success - redirect to employees list
      console.log('Employee deleted successfully, redirecting...');
      router.push('/dashboard/employees');
      router.refresh();
    } catch (err: any) {
      console.error('Delete employee error:', err);
      
      // Check if it's a permission error
      if (err.message?.includes('PERMISSION_DENIED') || err.message?.includes('permission')) {
        setError('Permission denied. Please make sure you are logged in as the salon owner to delete employees.');
      } else {
        setError(err.message || 'Error deleting employee. Please try again.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {error && (
        <div className="p-3 sm:p-4 text-xs sm:text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-sm font-light">
          {error}
        </div>
      )}

      {generatedPassword && (
        <div className="p-3 sm:p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
          <p className="text-xs sm:text-sm font-semibold mb-2">Account Created</p>
          <p className="text-xs sm:text-sm">Give this temporary password to the employee. They will be asked to change it on first login.</p>
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
                onClick={() => router.push('/dashboard/employees')}
                className="flex-1 sm:flex-none"
              >
                Go to Employees
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
          disabled={!!employee}
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
          {...register('phone', { required: 'Phone is required' })}
          error={errors.phone?.message}
        />
      </div>

      <Input
        label="NATIONAL ID"
        {...register('nationalId', { required: 'National ID is required' })}
        error={errors.nationalId?.message}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-light tracking-wide text-primary-600 uppercase mb-2">
            Position
          </label>
          <select
            {...register('position', { required: 'Position is required' })}
            className="w-full px-4 py-3 border border-primary-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-500 bg-white text-primary-900 font-light"
            defaultValue={employee?.position || ''}
          >
            <option value="" disabled>Select a position</option>
            <option value="Hair Stylist">Hair Stylist</option>
            <option value="Barber">Barber</option>
            <option value="Manicure / Pedicure">Manicure / Pedicure</option>
            <option value="Esthetician">Esthetician</option>
            <option value="Colorist">Colorist</option>
            <option value="Receptionist">Receptionist</option>
            <option value="Makeup Artist">Makeup Artist</option>
            <option value="Other">Other</option>
          </select>
          {errors.position?.message && (
            <p className="mt-2 text-xs text-red-600 font-light">{errors.position.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-light tracking-wide text-primary-600 uppercase mb-2">
            Employment Type
          </label>
          <select
            {...register('employmentType', { required: 'Employment type is required' })}
            className="w-full px-4 py-3 border border-primary-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-500 bg-white text-primary-900 font-light"
            defaultValue={employee?.employmentType || 'employee'}
          >
            <option value="employee">Regular Employee</option>
            <option value="self-employed">Self-Employed</option>
          </select>
          {errors.employmentType?.message && (
            <p className="mt-2 text-xs text-red-600 font-light">{errors.employmentType.message}</p>
          )}
          <p className="mt-2 text-xs text-primary-400 italic">
            Self-employed manage their own schedule and payments (deposit only 50%)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="ADDRESS"
          {...register('addressLine1', { required: 'Address is required' })}
          error={errors.addressLine1?.message}
        />
        <Input
          label="CITY"
          {...register('city', { required: 'City is required' })}
          error={errors.city?.message}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="PROVINCE"
          {...register('province', { required: 'Province is required' })}
          error={errors.province?.message}
        />
        <Input
          label="POSTAL CODE"
          {...register('postalCode', { required: 'Postal code is required' })}
          error={errors.postalCode?.message}
        />
      </div>

      <div>
        <label className="block text-xs font-light tracking-wide text-primary-600 uppercase mb-2">
          Biography
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
          Profile Picture
        </label>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
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
          <div className="flex-1 w-full sm:w-auto">
            <input
              type="file"
              id="profileImage"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <label
              htmlFor="profileImage"
              className="block sm:inline-block w-full sm:w-auto text-center px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition cursor-pointer text-sm font-medium"
            >
              {profileImagePreview ? 'Change Photo' : 'Upload Photo'}
            </label>
            <p className="text-xs text-primary-600 mt-2 text-center sm:text-left">
              JPG, PNG or GIF. Maximum 5MB.
            </p>
            {uploadingImage && (
              <p className="text-xs text-accent-600 mt-2 flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Uploading image...
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
        <Button type="submit" isLoading={isLoading} className="w-full sm:w-auto">
          {employee ? 'Update Employee' : 'Create Employee'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/employees')}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        {employee && (
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            isLoading={isDeleting}
            className="w-full sm:w-auto sm:ml-auto"
          >
            Delete Employee
          </Button>
        )}
      </div>
    </form>
  );
};
