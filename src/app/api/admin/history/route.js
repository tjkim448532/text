import { NextResponse } from 'next/server';
import { verifyAuth, getAdminDb } from '@/lib/firebase-admin';

export const runtime = "nodejs";

export async function GET(request) {
  const authResult = await verifyAuth(request);
  if (authResult.status !== 200) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  
  if (authResult.user.email !== 'admin@test.com') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = getAdminDb();
    const snapshot = await db.collection('sms_history')
      .orderBy('sentAt', 'desc')
      .limit(200)
      .get();
      
    const history = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      history.push({ 
        id: doc.id, 
        ...data,
        sentAt: data.sentAt ? data.sentAt.toDate().toISOString() : null
      });
    });
    
    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error fetching admin history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history', details: error.message },
      { status: 500 }
    );
  }
}
