import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getVertexAI } from 'firebase-admin/vertexai';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = require('../../../../service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
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

    // Initialize Vertex AI using Firebase Admin SDK
    const vertexAI = getVertexAI(admin.app());
    const model = vertexAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
      },
      systemInstruction: `당신은 블랙스톤 벨포레 리조트의 전문 고객 서비스 담당자입니다.
직원이 입력한 메모를 바탕으로, 리조트 고객에게 발송할 정중하고 친절한 안내 문자를 작성해 주세요.
글자 수는 SMS/LMS 기준에 맞게 간결하게 작성하고, 필요한 경우 인사말과 맺음말을 자연스럽게 추가하세요.`
    });

    const result = await model.generateContent(notes);
    const response = result.response;
    const generatedMessage = response.text();

    // Optional: Save to Firestore
    try {
      if (admin.apps.length) {
        const db = admin.firestore();
        await db.collection('generated_messages').add({
          originalNotes: notes,
          generatedMessage: generatedMessage,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (dbError) {
      console.error("Error saving to Firestore:", dbError);
    }

    return NextResponse.json({ result: generatedMessage });
  } catch (error) {
    console.error('Error generating message:', error);
    
    return NextResponse.json({ 
      error: '문자 생성에 실패했습니다. Firebase 설정(또는 Vertex AI API 활성화)을 확인해 주세요.',
      details: error.message 
    }, { status: 500 });
  }
}
