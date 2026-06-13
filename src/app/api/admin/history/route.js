import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import path from 'path';
import fs from 'fs';

// Initialize Firebase Admin
if (!getApps().length) {
  try {
    const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      initializeApp(); // Fallback to App Hosting default credentials
    }
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

const db = getFirestore();

export async function GET(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    
    // Only allow admin email
    if (decodedToken.email !== 'admin@test.com') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
  }

  try {
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
