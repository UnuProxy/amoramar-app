import { NextRequest, NextResponse } from 'next/server';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/shared/lib/firebase';
import { getUser } from '@/shared/lib/firestore';
import type { ApiResponse } from '@/shared/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!auth) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Auth not configured' },
        { status: 500 }
      );
    }

    if (!email || !password) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Email and password are required',
        },
        { status: 400 }
      );
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = await getUser(userCredential.user.uid);

    if (!user) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<typeof user>>({
      success: true,
      data: user,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to login',
      },
      { status: 401 }
    );
  }
}














