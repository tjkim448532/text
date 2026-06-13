import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';
import { verifyAuth, getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = "nodejs";

export async function POST(request) {
  const authResult = await verifyAuth(request);
  if (authResult.status !== 200) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || 'MISSING_KEY'
    });
    
    const ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY || 'MISSING_KEY'
    });

    const { question, customerName, phoneNumber } = await request.json();

    if (!question) {
      return NextResponse.json({ error: '고객 질문 내용을 입력해주세요.' }, { status: 400 });
    }

    // [RAG 1단계] 질문 텍스트를 벡터로 변환 (기존 카카오톡 앱과 완벽히 동일한 모델과 차원 사용)
    const embedResponse = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: question,
    });
    
    // Pinecone 인덱스가 768차원이므로, 768차원으로 잘라서 반환 (MRL)
    const vector = embedResponse.embeddings[0].values.slice(0, 768);

    // [RAG 2단계] Pinecone에서 관련 FAQ 검색
    const indexName = process.env.PINECONE_INDEX_NAME;
    if (!indexName) {
      throw new Error('PINECONE_INDEX_NAME 환경 변수가 설정되지 않았습니다.');
    }
    const index = pc.index(indexName);
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

    // 클라이언트가 스트리밍을 지원하는지 확인 (캐시된 구버전 프론트엔드 호환성)
    const acceptHeader = request.headers.get('accept') || '';
    const supportsStreaming = acceptHeader.includes('text/event-stream');

    if (!supportsStreaming) {
      // [구버전 호환] 전체 답변 대기 후 JSON 반환
      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: question,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
        }
      });
      
      const generatedMessage = response.text;
      
      try {
        const db = getAdminDb();
        db.collection('generated_messages').add({
          customerName: customerName || '미상',
          phoneNumber: phoneNumber || '미입력',
          question: question,
          generatedMessage: generatedMessage,
          createdAt: FieldValue.serverTimestamp()
        }).catch(dbError => console.warn("Firestore 기록 실패:", dbError.message));
      } catch (error) {}

      return NextResponse.json({ result: generatedMessage });
    }

    // [신버전] 문장 생성 (스트리밍)
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-flash-latest',
      contents: question,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
      }
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullText = '';
        try {
          for await (const chunk of responseStream) {
            if (chunk.text) {
              fullText += chunk.text;
              controller.enqueue(encoder.encode(chunk.text));
            }
          }

          // 스트리밍이 완료된 후 백그라운드에서 Firestore 기록
          try {
            const db = getAdminDb();
            db.collection('generated_messages').add({
              customerName: customerName || '미상',
              phoneNumber: phoneNumber || '미입력',
              question: question,
              generatedMessage: fullText,
              createdAt: FieldValue.serverTimestamp()
            }).catch(dbError => console.warn("Firestore 기록 실패:", dbError.message));
          } catch (error) {
            // 무시
          }
          
        } catch (err) {
          console.error("Stream error:", err);
          controller.error(err);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error generating message:', error);
    
    return NextResponse.json({ 
      error: 'AI 답변 생성에 실패했습니다. 관리자에게 문의하세요.',
      details: error.message 
    }, { status: 500 });
  }
}
