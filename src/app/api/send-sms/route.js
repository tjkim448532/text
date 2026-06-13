import { NextResponse } from 'next/server';
import { SolapiMessageService } from 'solapi';

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

export async function POST(request) {
  if (!messageService || !fromNumber) {
    console.error("Solapi SMS service is not configured. Please check environment variables (SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_FROM_NUMBER).");
    return NextResponse.json({ success: false, error: 'SMS service is not configured on the server.' }, { status: 500 });
  }

  try {
    const { to, text } = await request.json();

    if (!to || !text) {
      return NextResponse.json({ success: false, error: '수신 번호와 내용을 모두 입력해주세요.' }, { status: 400 });
    }
    
    // 전화번호 형식 검증 (숫자만 남김)
    const cleanTo = String(to).replace(/[^0-9]/g, '');
    const phoneRegex = /^01([0|1|6|7|8|9])([0-9]{3,4})([0-9]{4})$/;
    
    if (!phoneRegex.test(cleanTo)) {
        return NextResponse.json({ success: false, error: '올바른 휴대폰 번호 형식이 아닙니다.' }, { status: 400 });
    }

    if (String(text).length > 2000) {
        return NextResponse.json({ success: false, error: '문자 내용이 너무 깁니다.' }, { status: 400 });
    }

    // 솔라피를 통한 문자 발송
    const result = await messageService.send({
        to: cleanTo,
        from: fromNumber,
        text: text,
    });

    return NextResponse.json({ success: true, result });
  } catch (e) {
    console.error("Error sending SMS via Solapi: ", e);
    const errorMessage = e instanceof Error ? e.message : '알 수 없는 문자 발송 오류가 발생했습니다.';
    return NextResponse.json({ success: false, error: errorMessage || '문자 발송에 실패했습니다.' }, { status: 500 });
  }
}
