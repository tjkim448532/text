import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/firebase-admin';

export async function GET(request) {
  const authResult = await verifyAuth(request);
  if (authResult.status !== 200) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  return NextResponse.json({
    fromNumber: process.env.SOLAPI_FROM_NUMBER || '미등록'
  });
}
