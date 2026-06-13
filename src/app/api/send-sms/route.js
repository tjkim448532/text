import { NextResponse } from 'next/server';
import { SolapiMessageService } from 'solapi';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import path from 'path';
import fs from 'fs';

export const runtime = "nodejs";

const apiKey = process.env.SOLAPI_API_KEY;
const apiSecret = process.env.SOLAPI_API_SECRET;
const fromNumber = process.env.SOLAPI_FROM_NUMBER;

let messageService = null;
if (apiKey && apiSecret) {
  messageService = new SolapiMessageService(apiKey, apiSecret);
} else {
  console.error("Solapi SMS service is not configured. Please check SOLAPI_API_KEY and SOLAPI_API_SECRET environment variables.");
}

// Firebase Admin Initialization (For logging)
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

export async function POST(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const token = authHeader.split('Bearer ')[1];
    await getAuth().verifyIdToken(token);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid Token' }, { status: 401 });
  }

  if (!messageService || !fromNumber) {
    console.error("Solapi SMS service is not configured. Please check environment variables (SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_FROM_NUMBER).");
    return NextResponse.json({ success: false, error: 'SMS service is not configured on the server.' }, { status: 500 });
  }

  try {
    const { to, text, customerName, question, employeeEmail } = await request.json();

    if (!to || !text) {
      return NextResponse.json({ success: false, error: '수신 번호와 내용을 모두 입력해주세요.' }, { status: 400 });
    }
    
    // 전화번호 숫자만 추출
    const cleanTo = String(to).replace(/[^0-9]/g, '');
    
    // 길이는 최소 8자리 (예: 1588-1234) 최대 11자리
    if (cleanTo.length < 8 || cleanTo.length > 11) {
        return NextResponse.json({ success: false, error: '올바른 전화번호 형식이 아닙니다.' }, { status: 400 });
    }

    if (String(text).length > 2000) {
        return NextResponse.json({ success: false, error: '문자 내용이 너무 깁니다.' }, { status: 400 });
    }

    // 1. 쏠라피를 통한 실제 문자 발송
    const result = await messageService.send({
        to: cleanTo,
        from: fromNumber,
        text: text,
    });

    // 2. 발송 성공 시 Firestore DB에 저장 (sms_history 컬렉션)
    try {
      if (getApps().length) {
        const db = getFirestore();
        await db.collection('sms_history').add({
          phoneNumber: cleanTo,
          customerName: customerName || '미상',
          question: question || '미입력',
          answer: text,
          employeeEmail: employeeEmail || '알수없음',
          sentAt: FieldValue.serverTimestamp()
        });
      }
    } catch (dbError) {
      console.warn("Firestore 기록 실패 (권한 또는 비활성화 상태):", dbError.message);
      // DB 저장이 실패해도 발송 자체는 성공했으므로 에러로 처리하지 않음
    }

    return NextResponse.json({ success: true, result });
  } catch (e) {
    console.error("Error sending SMS via Solapi: ", e);
    const errorMessage = e instanceof Error ? e.message : '알 수 없는 문자 발송 오류가 발생했습니다.';
    return NextResponse.json({ success: false, error: errorMessage || '문자 발송에 실패했습니다.' }, { status: 500 });
  }
}
