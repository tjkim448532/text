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
    
    // 전화번호 일치 조건만으로 조회 (복합 색인 요구 에러 방지)
    const snapshot = await historyRef
      .where('phoneNumber', '==', cleanPhone)
      .get();

    let history = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      history.push({
        id: doc.id,
        customerName: data.customerName,
        question: data.question,
        answer: data.answer,
        employeeEmail: data.employeeEmail, // 발송 담당자
        sentAt: data.sentAt ? data.sentAt.toDate().getTime() : 0, // 밀리초로 변환하여 정렬용으로 사용
        sentAtString: data.sentAt ? data.sentAt.toDate().toISOString() : null
      });
    });

    // 메모리 상에서 최신순 정렬 후 10개 자르기
    history.sort((a, b) => b.sentAt - a.sentAt);
    history = history.slice(0, 10).map(item => ({
      id: item.id,
      customerName: item.customerName,
      question: item.question,
      answer: item.answer,
      employeeEmail: item.employeeEmail,
      sentAt: item.sentAtString
    }));

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
