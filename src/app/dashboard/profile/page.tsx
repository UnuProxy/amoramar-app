'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { Loading } from '@/shared/components/Loading';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  createEmployee,
  getEmployeeByUserId,
  getSalonByOwner,
  updateEmployee,
  updateUser,
} from '@/shared/lib/firestore';
import { deleteEmployeeProfileImage, uploadEmployeeProfileImage } from '@/shared/lib/storage';
import type { Employee, EmploymentType } from '@/shared/lib/types';

const OWNER_POSITION_OPTIONS = [
  'Brows, Lashes, Permanent Makeup & Makeup',
  'Manicure, Pedicure & Combinations',
  'Hair',
  'Estetica',
  'Receptionist',
] as const;

const toTitleCase = (value: string) =>
  value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

export default function OwnerProfilePage() {
  const router = useRouter();
  const { user, patchUser } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    nationalId: '',
    position: 'Receptionist',
    employmentType: 'self-employed' as EmploymentType,
    addressLine1: '',
    city: '',
    province: '',
    postalCode: '',
    bio: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      if (!user || user.role !== 'owner') {
        setLoading(false);
        return;
      }

      try {
        const ownerEmployee = await getEmployeeByUserId(user.id);
        setEmployee(ownerEmployee);
        setFormData({
          firstName: ownerEmployee?.firstName || user.firstName || '',
          lastName: ownerEmployee?.lastName || user.lastName || '',
          phone: ownerEmployee?.phone || user.phone || '',
          nationalId: ownerEmployee?.nationalId || '',
          position: ownerEmployee?.position || 'Receptionist',
          employmentType: ownerEmployee?.employmentType || 'self-employed',
          addressLine1: ownerEmployee?.addressLine1 || '',
          city: ownerEmployee?.city || '',
          province: ownerEmployee?.province || '',
          postalCode: ownerEmployee?.postalCode || '',
          bio: ownerEmployee?.bio || '',
        });
        setProfileImagePreview(ownerEmployee?.profileImage);
      } catch (loadError) {
        console.error('Error loading owner profile:', loadError);
        setError('Failed to load owner profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setProfileImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setProfileImageFile(null);
    setProfileImagePreview(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const salon = await getSalonByOwner(user.id);
      const salonId = salon?.id || employee?.salonId || 'default-salon-id';

      let profileImageUrl = employee?.profileImage;

      if (profileImageFile) {
        setUploadingImage(true);
        if (employee?.profileImage) {
          await deleteEmployeeProfileImage(employee.profileImage).catch(console.error);
        }
        profileImageUrl = await uploadEmployeeProfileImage(profileImageFile, employee?.id || user.id);
        setUploadingImage(false);
      } else if (profileImagePreview === undefined && employee?.profileImage) {
        await deleteEmployeeProfileImage(employee.profileImage).catch(console.error);
        profileImageUrl = undefined;
      }

      const normalizedFirstName = toTitleCase(formData.firstName.trim());
      const normalizedLastName = toTitleCase(formData.lastName.trim());

      await updateUser(user.id, {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        phone: formData.phone.trim(),
      });
      patchUser({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        phone: formData.phone.trim(),
      });

      const employeePayload = {
        userId: user.id,
        salonId,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: user.email,
        phone: formData.phone.trim(),
        profileImage: profileImageUrl,
        bio: formData.bio.trim() || undefined,
        nationalId: formData.nationalId.trim() || undefined,
        position: formData.position,
        addressLine1: formData.addressLine1.trim() || undefined,
        city: formData.city.trim() || undefined,
        province: formData.province.trim() || undefined,
        postalCode: formData.postalCode.trim() || undefined,
        status: 'active' as const,
        employmentType: formData.employmentType,
      };

      if (employee) {
        await updateEmployee(employee.id, employeePayload);
        setEmployee({ ...employee, ...employeePayload, profileImage: profileImageUrl });
      } else {
        const employeeId = await createEmployee(employeePayload);
        setEmployee({
          id: employeeId,
          ...employeePayload,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      setSuccess('Profile saved');
    } catch (submitError: any) {
      console.error('Error saving owner profile:', submitError);
      setError(submitError.message || 'Failed to save profile');
    } finally {
      setUploadingImage(false);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loading size="sm" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <div className="overflow-hidden rounded-[32px] border border-stone-200 bg-[linear-gradient(135deg,#1f1a17_0%,#3b3028_45%,#d8c7b4_100%)] p-8 text-white shadow-[0_28px_80px_rgba(28,25,23,0.28)]">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-stone-200/80">Owner Profile</p>
        <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              {formData.firstName || formData.lastName
                ? `${toTitleCase(formData.firstName)} ${toTitleCase(formData.lastName)}`.trim()
                : 'Your Salon Identity'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-stone-200/85">
              Update your profile, image, and business details. Once saved, your owner profile is also available in Employees for service assignment.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-stone-100 backdrop-blur">
            <div className="font-medium">{user?.email}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-300">Salon Owner</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_18px_48px_rgba(28,25,23,0.06)] sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-stone-900">Personal Details</h2>
            <p className="mt-1 text-sm text-stone-500">These details are used across the dashboard and booking flow.</p>
          </div>

          {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {success && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="FIRST NAME" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required />
            <Input label="LAST NAME" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input label="PHONE" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
            <Input label="NATIONAL ID" value={formData.nationalId} onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-light uppercase tracking-wide text-slate-600">Position</label>
              <select
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full rounded-sm border border-slate-300 bg-white px-4 py-3 font-light text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {OWNER_POSITION_OPTIONS.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-light uppercase tracking-wide text-slate-600">Employment Type</label>
              <select
                value={formData.employmentType}
                onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as EmploymentType })}
                className="w-full rounded-sm border border-slate-300 bg-white px-4 py-3 font-light text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="self-employed">Self-Employed</option>
                <option value="employee">Regular Employee</option>
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input label="ADDRESS" value={formData.addressLine1} onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })} />
            <Input label="CITY" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input label="PROVINCE" value={formData.province} onChange={(e) => setFormData({ ...formData, province: e.target.value })} />
            <Input label="POSTAL CODE" value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} />
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-xs font-light uppercase tracking-wide text-slate-600">Biography</label>
            <textarea
              rows={6}
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full rounded-sm border border-slate-300 bg-white px-4 py-3 text-sm font-light text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_18px_48px_rgba(28,25,23,0.06)]">
            <h2 className="text-2xl font-semibold text-stone-900">Profile Image</h2>
            <p className="mt-1 text-sm text-stone-500">Use a polished portrait. This image appears in the team directory and booking flow.</p>
            <div className="mt-6 flex flex-col items-center gap-4">
              {profileImagePreview ? (
                <div className="relative h-40 w-40 overflow-hidden rounded-[28px] border border-stone-200 shadow-sm">
                  <img src={profileImagePreview} alt="Owner profile preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow-sm"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex h-40 w-40 items-center justify-center rounded-[28px] border border-dashed border-stone-300 bg-stone-50 text-4xl font-semibold text-stone-400">
                  {(formData.firstName[0] || user?.email?.[0] || 'A').toUpperCase()}
                </div>
              )}

              <input id="ownerProfileImage" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              <label
                htmlFor="ownerProfileImage"
                className="cursor-pointer rounded-2xl bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-700"
              >
                {profileImagePreview ? 'Change Image' : 'Upload Image'}
              </label>
              <p className="text-xs text-stone-500">JPG, PNG or GIF. Maximum 5MB.</p>
              {uploadingImage && <p className="text-xs text-stone-500">Uploading image...</p>}
            </div>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-[linear-gradient(180deg,#fff,#faf7f2)] p-6 shadow-[0_18px_48px_rgba(28,25,23,0.06)]">
            <h2 className="text-xl font-semibold text-stone-900">Connected Employee Record</h2>
            <p className="mt-2 text-sm text-stone-600">
              Saving this profile also {employee ? 'updates' : 'creates'} your employee record, so you can appear in Employees and be assigned your own services.
            </p>
            <div className="mt-5 flex gap-3">
              <Button type="submit" isLoading={saving} className="w-full">
                Save Profile
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard')} className="w-full">
                Cancel
              </Button>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
