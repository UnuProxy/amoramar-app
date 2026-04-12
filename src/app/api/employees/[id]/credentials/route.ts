import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
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

const generateTemporaryPassword = (): string => {
  const randomPart = Math.random().toString(36).slice(-10);
  return `${randomPart}Aa1!`;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner(request);
    const { id } = await context.params;
    const body = await request.json();

    const employeeRef = getAdminDb().collection('employees').doc(id);
    const employeeSnap = await employeeRef.get();
    if (!employeeSnap.exists) {
      return NextResponse.json(
        {
          success: false,
          error: 'Employee not found',
        },
        { status: 404 }
      );
    }

    const employee = employeeSnap.data() || {};
    const email = String(body?.email || employee.email || '').trim().toLowerCase();
    const firstName = String(body?.firstName || employee.firstName || '').trim();
    const lastName = String(body?.lastName || employee.lastName || '').trim();
    const phone = String(body?.phone || employee.phone || '').trim();

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email is required to generate credentials.',
        },
        { status: 400 }
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    let userId = typeof employee.userId === 'string' && employee.userId.trim() ? employee.userId.trim() : '';

    if (userId) {
      const linkedUserDoc = await getAdminDb().collection('users').doc(userId).get();
      const linkedRole = linkedUserDoc.data()?.role;
      if (linkedRole && linkedRole !== 'employee') {
        return NextResponse.json(
          {
            success: false,
            error: 'This team member is linked to a non-employee account and cannot receive employee credentials here.',
          },
          { status: 400 }
        );
      }
    }

    let authUserExists = false;
    if (userId) {
      try {
        await getAdminAuth().getUser(userId);
        authUserExists = true;
      } catch (error: any) {
        if (error?.code !== 'auth/user-not-found') {
          throw error;
        }
      }
    }

    if (userId && authUserExists) {
      await getAdminAuth().updateUser(userId, {
        email,
        password: temporaryPassword,
        displayName: `${firstName} ${lastName}`.trim() || undefined,
        disabled: employee.status === 'inactive',
      });
    } else {
      const userRecord = userId
        ? await getAdminAuth().createUser({
            uid: userId,
            email,
            password: temporaryPassword,
            displayName: `${firstName} ${lastName}`.trim() || undefined,
            disabled: employee.status === 'inactive',
          })
        : await getAdminAuth().createUser({
            email,
            password: temporaryPassword,
            displayName: `${firstName} ${lastName}`.trim() || undefined,
            disabled: employee.status === 'inactive',
          });

      userId = userRecord.uid;
    }

    const userRef = getAdminDb().collection('users').doc(userId);
    const existingUserSnap = await userRef.get();
    await userRef.set(
      {
        email,
        role: 'employee',
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || undefined,
        mustChangePassword: true,
        isActive: employee.status !== 'inactive',
        createdAt: existingUserSnap.exists ? existingUserSnap.data()?.createdAt || Timestamp.now() : FieldValue.serverTimestamp(),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

    await employeeRef.set(
      {
        userId,
        email,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      data: {
        userId,
        email,
        temporaryPassword,
      },
    });
  } catch (error: any) {
    console.error('Error generating employee credentials:', error);
    const status =
      error?.message === 'Permission denied.' || error?.message === 'Missing authorization token.'
        ? 403
        : 500;

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate employee credentials',
      },
      { status }
    );
  }
}
