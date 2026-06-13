import { NextResponse } from 'next/server';
import { verifyAuth, getAdminDb } from '@/lib/firebase-admin';

export const runtime = "nodejs";

export async function GET(request) {
  const authResult = await verifyAuth(request);
  if (authResult.status !== 200) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ success: false, error: '전화번호가 제공되지 않았습니다.' }, { status: 400 });
    }

    const cleanPhone = String(phone).replace(/[^0-9]/g, '');

    const db = getAdminDb();
    const historyRef = db.collection('sms_history');
    
    // 복합 색인이 생성되었으므로 DB 레벨에서 정렬 및 제한(Limit) 처리하여 과금 방지
    const snapshot = await historyRef
      .where('phoneNumber', '==', cleanPhone)
      .orderBy('sentAt', 'desc')
      .limit(10)
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
