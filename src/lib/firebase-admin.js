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
    // 1. Vercel 환경 변수 우선 확인
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Vercel에서 개행문자(\n)가 일반 문자열로 들어오는 것을 방지
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        })
      });
      isInitialized = true;
      return;
    }

    // 2. 로컬 개발 환경용 파일 확인
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
