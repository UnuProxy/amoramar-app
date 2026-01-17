'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { getEmployees, updateEmployee } from '@/shared/lib/firestore';
import { uploadEmployeeProfileImage, deleteEmployeeProfileImage } from '@/shared/lib/storage';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { Loading } from '@/shared/components/Loading';
import type { Employee } from '@/shared/lib/types';

export default function EmployeeProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | undefined>(undefined);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    bio: '',
    addressLine1: '',
    city: '',
    province: '',
    postalCode: '',
  });

  useEffect(() => {
    const fetchEmployee = async () => {
      if (!user || user.role !== 'employee') {
        setLoading(false);
        return;
      }

      try {
        const employees = await getEmployees();
        const currentEmployee = employees.find(emp => emp.userId === user.id);
        
        if (currentEmployee) {
          setEmployee(currentEmployee);
          setFormData({
            firstName: currentEmployee.firstName || '',
            lastName: currentEmployee.lastName || '',
            phone: currentEmployee.phone || '',
            bio: currentEmployee.bio || '',
            addressLine1: currentEmployee.addressLine1 || '',
            city: currentEmployee.city || '',
            province: currentEmployee.province || '',
            postalCode: currentEmployee.postalCode || '',
          });
          setProfileImagePreview(currentEmployee.profileImage);
        }
      } catch (error) {
        console.error('Error fetching employee:', error);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImageFile(file);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      let profileImageUrl = employee.profileImage;

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

      // Update employee
      await updateEmployee(employee.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        bio: formData.bio || undefined,
        profileImage: profileImageUrl,
        addressLine1: formData.addressLine1,
        city: formData.city,
        province: formData.province,
        postalCode: formData.postalCode,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="sm" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 text-center">
        <p className="text-neutral-600">Employee profile not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      <div className="px-4 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Update your personal information</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {error && (
            <div className="p-3 sm:p-4 text-xs sm:text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-sm font-light">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 sm:p-4 text-xs sm:text-sm text-emerald-400 bg-emerald-900/20 border border-emerald-800/50 rounded-sm font-light">
              Profile updated successfully!
            </div>
          )}

          {/* Read-only fields */}
          <div className="p-3 sm:p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
            <h3 className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-3">Account Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-light text-neutral-600 mb-1">Email</label>
                <p className="text-sm font-medium text-neutral-900">{employee.email}</p>
              </div>
              <div>
                <label className="block text-xs font-light text-neutral-600 mb-1">Position</label>
                <p className="text-sm font-medium text-neutral-900">{employee.position}</p>
              </div>
              <div>
                <label className="block text-xs font-light text-neutral-600 mb-1">Employment Type</label>
                <p className="text-sm font-medium text-neutral-900">
                  {employee.employmentType === 'self-employed' ? 'Self-Employed' : 'Regular Employee'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-light text-neutral-600 mb-1">National ID</label>
                <p className="text-sm font-medium text-neutral-900">{employee.nationalId}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="FIRST NAME"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
            <Input
              label="LAST NAME"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
          </div>

          <Input
            label="PHONE"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="ADDRESS"
              value={formData.addressLine1}
              onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
              required
            />
            <Input
              label="CITY"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="PROVINCE"
              value={formData.province}
              onChange={(e) => setFormData({ ...formData, province: e.target.value })}
              required
            />
            <Input
              label="POSTAL CODE"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-light tracking-wide text-primary-600 uppercase mb-2">
              Biography
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-primary-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-500 bg-white text-primary-900 font-light text-sm"
            />
          </div>

          {/* Profile Image Upload */}
          <div>
            <label className="block text-xs font-light tracking-wide text-primary-600 uppercase mb-2">
              Profile Picture
            </label>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
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
                  <p className="text-xs text-accent-600 mt-2 flex items-center justify-center sm:justify-start gap-2">
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

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button type="submit" isLoading={saving} className="w-full sm:w-auto">
              Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/employee')}
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
