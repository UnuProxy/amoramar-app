import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/shared/lib/firebaseAdmin';

export const runtime = 'nodejs';

const getBearerToken = (request: NextRequest): string | null => {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
};

const requireOwner = async (request: NextRequest): Promise<void> => {
  const token = getBearerToken(request);
  if (!token) {
    throw new Error('Missing authorization token.');
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  const userDoc = await getAdminDb().collection('users').doc(decoded.uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'owner') {
    throw new Error('Permission denied.');
  }
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner(request);

    const { id } = await context.params;
    const body = await request.json();
    const newEmail = String(body?.email || '').trim().toLowerCase();

    if (!newEmail || !isValidEmail(newEmail)) {
      return NextResponse.json(
        { success: false, error: 'Email inválido.' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const auth = getAdminAuth();
    const clientRef = db.collection('clients').doc(id);
    const clientSnap = await clientRef.get();

    if (!clientSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado.' },
        { status: 404 }
      );
    }

    const client = clientSnap.data() || {};
    const previousEmail = String(client.email || body?.previousEmail || '').trim().toLowerCase();

    if (previousEmail === newEmail) {
      return NextResponse.json({
        success: true,
        data: { email: newEmail, updatedBookings: 0 },
      });
    }

    const duplicateClients = await db.collection('clients').where('email', '==', newEmail).get();
    const duplicateClient = duplicateClients.docs.find((doc) => doc.id !== id);
    if (duplicateClient) {
      return NextResponse.json(
        { success: false, error: 'Ya existe otro cliente con este email.' },
        { status: 409 }
      );
    }

    let linkedUserId = typeof client.userId === 'string' ? client.userId.trim() : '';
    if (!linkedUserId) {
      const sameIdUser = await db.collection('users').doc(id).get();
      if (sameIdUser.exists && sameIdUser.data()?.role === 'client') {
        linkedUserId = id;
      }
    }

    const profileBatch = db.batch();
    profileBatch.set(
      clientRef,
      {
        email: newEmail,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

    if (linkedUserId) {
      const userRef = db.collection('users').doc(linkedUserId);
      profileBatch.set(
        userRef,
        {
          email: newEmail,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      try {
        await auth.updateUser(linkedUserId, { email: newEmail });
      } catch (error: any) {
        if (error?.code !== 'auth/user-not-found') {
          throw error;
        }
      }
    }

    await profileBatch.commit();

    let updatedBookings = 0;
    if (previousEmail) {
      const bookingsSnap = await db.collection('bookings').where('clientEmail', '==', previousEmail).get();
      for (let index = 0; index < bookingsSnap.docs.length; index += 450) {
        const bookingBatch = db.batch();
        bookingsSnap.docs.slice(index, index + 450).forEach((bookingDoc) => {
          updatedBookings += 1;
          bookingBatch.set(
            bookingDoc.ref,
            {
              clientEmail: newEmail,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        });
        await bookingBatch.commit();
      }
    }

    return NextResponse.json({
      success: true,
      data: { email: newEmail, updatedBookings },
    });
  } catch (error: any) {
    console.error('Error updating client email:', error);
    const status =
      error?.message === 'Permission denied.' || error?.message === 'Missing authorization token.'
        ? 403
        : error?.code === 'auth/email-already-exists'
        ? 409
        : 500;

    return NextResponse.json(
      {
        success: false,
        error:
          error?.code === 'auth/email-already-exists'
            ? 'Ya existe una cuenta con este email.'
            : error.message || 'No se pudo actualizar el email.',
      },
      { status }
    );
  }
}
