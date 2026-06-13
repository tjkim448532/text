import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import path from 'path';
import fs from 'fs';

let isInitialized = false;

export function initAdmin() {
  if (isInitialized || getApps().length > 0) {
    isInitialized = true;
    return;
  }
  
  try {
    const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      initializeApp();
    }
    isInitialized = true;
  } catch (error) {
    console.error("Firebase Admin Initialization Error:", error);
  }
}

export async function verifyAuth(request) {
  initAdmin();
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    return { user: decodedToken, status: 200 };
  } catch (error) {
    return { error: 'Invalid Token', status: 401 };
  }
}

export function getAdminDb() {
  initAdmin();
  return getFirestore();
}
