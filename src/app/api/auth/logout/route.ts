import { NextRequest, NextResponse } from 'next/server';
import { signOut } from 'firebase/auth';
import { auth } from '@/shared/lib/firebase';
import type { ApiResponse } from '@/shared/lib/types';

export async function POST(request: NextRequest) {
  try {
    if (!auth) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Auth not configured' },
        { status: 500 }
      );
    }

    await signOut(auth);

    return NextResponse.json<ApiResponse<null>>({
      success: true,
      data: null,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to logout',
      },
      { status: 500 }
    );
  }
}



















