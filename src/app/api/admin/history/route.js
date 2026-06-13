import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
  try {
    const snapshot = await db.collection('sms_history')
      .orderBy('sentAt', 'desc')
      .limit(200)
      .get();
      
    const history = [];
    snapshot.forEach(doc => {
      history.push({ id: doc.id, ...doc.data() });
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
