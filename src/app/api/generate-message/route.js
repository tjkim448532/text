import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';

// 1. Firebase Admin Initialization (For logging)
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

// 2. AI & Pinecone Initialization
const location = 'us-central1';
const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'text-7d7c6';

// 2. AI Initialization is moved inside POST handler to ensure env vars are loaded.

export async function POST(request) {
  try {
    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || 'MISSING_KEY'
    });
    
    // Use Gemini API Key if available, otherwise fallback to Vertex AI ADC
    const ai = new GoogleGenAI(
      process.env.GEMINI_API_KEY 
        ? { apiKey: process.env.GEMINI_API_KEY } 
        : { vertexai: { project: projectId, location: 'us-central1' } }
    );
    const { question, customerName, phoneNumber } = await request.json();

    if (!question) {
      return NextResponse.json({ error: '고객 질문 내용을 입력해주세요.' }, { status: 400 });
    }

    // [RAG 1단계] 질문 텍스트를 벡터로 변환 (Embedding)
    const embedResponse = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: question,
    });
    
    const vector = embedResponse.embeddings[0].values;

    // [RAG 2단계] Pinecone에서 관련 FAQ 검색
    const index = pc.index(process.env.PINECONE_INDEX_NAME || 'belleforet-cs');
    const queryRes = await index.query({
      topK: 3,
      vector: vector,
      includeMetadata: true
    });

    // 검색된 FAQ 내용 추출
    const retrievedContexts = queryRes.matches
      .map(match => match.metadata?.text || '')
      .filter(text => text.length > 0)
      .join('\n\n---\n\n');

    // [RAG 3단계] Gemini에게 전달할 프롬프트 구성
    const greeting = customerName ? `고객 이름은 '${customerName}' 입니다. 문자에 자연스럽게 이름을 넣어주세요.` : '고객 이름은 알 수 없습니다. 자연스럽게 인사말을 작성해주세요.';
    
    const systemPrompt = `당신은 블랙스톤 벨포레 리조트의 전문 고객 서비스 담당자입니다.
아래에 제공된 [FAQ 및 시설 규정 자료]를 바탕으로, 직원이 전달한 [고객 질문]에 대한 정중하고 친절한 안내 문자를 작성해 주세요.

규칙:
1. 반드시 제공된 [FAQ 및 시설 규정 자료]의 사실에만 기반해서 답변하세요. 자료에 없는 내용은 임의로 지어내지 마세요.
2. 글자 수는 SMS/LMS 기준에 맞게 간결하고 읽기 쉽게 작성하세요.
3. ${greeting}

[FAQ 및 시설 규정 자료]
${retrievedContexts || '검색된 관련 규정이 없습니다.'}
`;

    // 답변 생성
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: question,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3, // RAG를 위해 온도를 낮춰 사실 기반 답변 유도
      }
    });

    const generatedMessage = response.text;

    // Optional: Save to Firestore (에러 발생해도 API는 정상 응답하도록 처리)
    try {
      if (getApps().length) {
        const db = getFirestore();
        await db.collection('generated_messages').add({
          customerName: customerName || '미상',
          phoneNumber: phoneNumber || '미입력',
          question: question,
          generatedMessage: generatedMessage,
          createdAt: FieldValue.serverTimestamp()
        });
      }
    } catch (dbError) {
      console.warn("Firestore 저장 실패 (기능 비활성화 상태일 수 있음):", dbError.message);
    }

    return NextResponse.json({ result: generatedMessage });
  } catch (error) {
    console.error('Error generating message:', error);
    
    if (error.message && error.message.includes('Vertex AI API has not been used')) {
      return NextResponse.json({ 
        error: 'Vertex AI API가 활성화되지 않았습니다. Google Cloud Console에서 활성화해주세요.',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      error: 'AI 답변 생성에 실패했습니다. 관리자에게 문의하세요.',
      details: error.message 
    }, { status: 500 });
  }
}
