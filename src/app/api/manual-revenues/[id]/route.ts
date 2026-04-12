import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/shared/lib/firebaseAdmin';

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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner(request);
    const { id } = await context.params;
    await getAdminDb().collection('manualRevenue').doc(id).delete();

    return NextResponse.json({
      success: true,
      message: 'Manual revenue deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting manual revenue:', error);
    const status = error?.message === 'Permission denied.' || error?.message === 'Missing authorization token.' ? 403 : 500;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete manual revenue',
      },
      { status }
    );
  }
}
