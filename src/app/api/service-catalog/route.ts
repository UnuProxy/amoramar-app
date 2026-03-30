import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/shared/lib/firebaseAdmin';
import { DEFAULT_SALON_ID, getDefaultServiceCatalogConfig } from '@/shared/lib/serviceCatalog';
import type { ApiResponse, ServiceCatalogConfig, ServiceCatalogMainGroup } from '@/shared/lib/types';

const toCatalogResponse = (
  salonId: string,
  docId: string,
  data?: Record<string, any>
): ServiceCatalogConfig => ({
  id: docId,
  salonId: data?.salonId || salonId,
  groups: (data?.groups as ServiceCatalogMainGroup[]) || getDefaultServiceCatalogConfig(salonId).groups,
  createdAt: data?.createdAt?.toDate?.() || new Date(0),
  updatedAt: data?.updatedAt?.toDate?.() || new Date(0),
});

const getBearerToken = (request: NextRequest): string | null => {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
};

const requireOwner = async (request: NextRequest): Promise<string> => {
  const token = getBearerToken(request);
  if (!token) {
    throw new Error('Missing authorization token.');
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  const userDoc = await getAdminDb().collection('users').doc(decoded.uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'owner') {
    throw new Error('Permission denied.');
  }

  return decoded.uid;
};

export async function GET(request: NextRequest) {
  try {
    const salonId = request.nextUrl.searchParams.get('salonId') || DEFAULT_SALON_ID;
    const docRef = getAdminDb().collection('serviceCatalogConfigs').doc(salonId);
    const docSnap = await docRef.get();

    const config = docSnap.exists
      ? toCatalogResponse(salonId, docSnap.id, docSnap.data())
      : getDefaultServiceCatalogConfig(salonId);

    return NextResponse.json<ApiResponse<ServiceCatalogConfig>>({
      success: true,
      data: config,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error?.message || 'Failed to fetch service catalog',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireOwner(request);
    const body = (await request.json()) as Omit<ServiceCatalogConfig, 'createdAt' | 'updatedAt'>;
    const salonId = body.salonId || body.id || DEFAULT_SALON_ID;
    const docRef = getAdminDb().collection('serviceCatalogConfigs').doc(body.id || salonId);
    const existing = await docRef.get();

    await docRef.set(
      {
        salonId,
        groups: body.groups || [],
        createdAt: existing.exists ? existing.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

    const persisted = await docRef.get();
    return NextResponse.json<ApiResponse<ServiceCatalogConfig>>({
      success: true,
      data: toCatalogResponse(salonId, persisted.id, persisted.data()),
    });
  } catch (error: any) {
    const message = error?.message || 'Failed to save service catalog';
    const status = message === 'Permission denied.' || message === 'Missing authorization token.' ? 403 : 500;
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
