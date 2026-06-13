import { NextResponse } from 'next/server';
import { verifyAuth, getAdminDb } from '@/lib/firebase-admin';

export const runtime = "nodejs";

export async function GET(request) {
  const authResult = await verifyAuth(request);
  if (authResult.status !== 200) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const email = authResult.user.email;
  if (!email) {
    return NextResponse.json({ role: 'USER' });
  }

  try {
    const db = getAdminDb();
    const docRef = await db.collection('user_roles').doc(email).get();
    
    if (docRef.exists) {
      return NextResponse.json({ role: docRef.data().role || 'USER' });
    } else {
      return NextResponse.json({ role: 'USER' });
    }
  } catch (error) {
    console.error('Error fetching user role:', error);
    return NextResponse.json({ role: 'USER', error: 'Failed to fetch role' });
  }
}
