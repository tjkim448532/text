import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';

export const runtime = "nodejs";

// Firebase Admin Initialization
const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
if (fs.existsSync(serviceAccountPath)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;
}

if (!getApps().length) {
  try {
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      initializeApp();
    }
  } catch (error) {
    console.error("Firebase Admin Initialization Error:", error);
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ success: false, error: '전화번호가 제공되지 않았습니다.' }, { status: 400 });
    }

    const cleanPhone = String(phone).replace(/[^0-9]/g, '');

    if (!getApps().length) {
      return NextResponse.json({ success: false, error: 'DB 서비스가 준비되지 않았습니다.' }, { status: 500 });
    }

    const db = getFirestore();
    const historyRef = db.collection('sms_history');
    
    // 전화번호 일치 조건, 최신순 정렬, 최대 10개
    const snapshot = await historyRef
      .where('phoneNumber', '==', cleanPhone)
      .orderBy('sentAt', 'desc')
      .limit(10)
      .get();

    const history = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      history.push({
        id: doc.id,
        customerName: data.customerName,
        question: data.question,
        answer: data.answer,
        sentAt: data.sentAt ? data.sentAt.toDate().toISOString() : null
      });
    });

    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching customer history:', error);
    
    // index 오류일 경우 (Firestore 색인 생성 필요)
    if (error.message && error.message.includes('index')) {
       return NextResponse.json({ 
         success: false, 
         error: 'Firestore 색인 생성이 필요합니다. (파이어베이스 콘솔 확인)',
         needsIndex: true
       }, { status: 500 });
    }

    return NextResponse.json({ success: false, error: '내역을 불러오는 중 오류가 발생했습니다.', details: error.message }, { status: 500 });
  }
}
