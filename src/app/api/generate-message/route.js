import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import path from 'path';

// Set credentials for Vertex AI
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.cwd(), 'service-account.json');

// Initialize Firebase Admin
if (!getApps().length) {
  try {
    const serviceAccount = require('../../../../service-account.json');
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (error) {
    console.error("Firebase Admin Initialization Error:", error);
  }
}

export async function POST(request) {
  try {
    const { notes } = await request.json();

    if (!notes) {
      return NextResponse.json({ error: '직원 메모를 입력해주세요.' }, { status: 400 });
    }

    // Initialize Gemini API via Vertex AI
    const ai = new GoogleGenAI({
      vertexai: {
        project: 'text-7d7c6',
        location: 'us-central1',
      }
    });

    const systemPrompt = `당신은 블랙스톤 벨포레 리조트의 전문 고객 서비스 담당자입니다.
직원이 입력한 메모를 바탕으로, 리조트 고객에게 발송할 정중하고 친절한 안내 문자를 작성해 주세요.
글자 수는 SMS/LMS 기준에 맞게 간결하게 작성하고, 필요한 경우 인사말과 맺음말을 자연스럽게 추가하세요.`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: notes,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });

    const generatedMessage = response.text;

    // Optional: Save to Firestore
    try {
      if (getApps().length) {
        const db = getFirestore();
        await db.collection('generated_messages').add({
          originalNotes: notes,
          generatedMessage: generatedMessage,
          createdAt: FieldValue.serverTimestamp()
        });
      }
    } catch (dbError) {
      console.error("Error saving to Firestore:", dbError);
    }

    return NextResponse.json({ result: generatedMessage });
  } catch (error) {
    console.error('Error generating message:', error);
    
    // Check if error is related to Vertex AI not being enabled
    if (error.message && error.message.includes('Vertex AI API has not been used')) {
      return NextResponse.json({ 
        error: 'Vertex AI API가 활성화되지 않았습니다. Google Cloud Console에서 프로젝트(text-7d7c6)의 Vertex AI API를 활성화해주세요.',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      error: '문자 생성에 실패했습니다. 관리자에게 문의하세요.',
      details: error.message 
    }, { status: 500 });
  }
}
