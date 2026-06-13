'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  // Step 1: 고객 정보
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerHistory, setCustomerHistory] = useState([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');

  // Step 2: 문자 생성
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Step 3: 발송
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [fromNumber, setFromNumber] = useState('로딩 중...');
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    // 발신 번호 불러오기
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setFromNumber(data.fromNumber || '미등록'))
      .catch(() => setFromNumber('불러오기 실패'));
  }, []);

  // 전화번호가 변경될 때마다 10자리 이상이면 자동 조회
  useEffect(() => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 10) {
      fetchCustomerHistory(cleanPhone);
    } else {
      setCustomerHistory([]);
      setHistoryError('');
    }
  }, [phoneNumber]);

  const fetchCustomerHistory = async (phone) => {
    setIsFetchingHistory(true);
    setHistoryError('');
    try {
      const res = await fetch(`/api/customer-history?phone=${phone}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '내역 조회 실패');
      setCustomerHistory(data.history || []);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const handleGenerate = async () => {
    if (!question.trim()) {
      setError('고객의 질문 내용을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSendStatus({ type: '', message: '' });
    
    try {
      const response = await fetch('/api/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, customerName, phoneNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '문자 생성에 실패했습니다.');
      }

      setGeneratedMessage(data.result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSms = async () => {
    if (!phoneNumber.trim()) {
      setSendStatus({ type: 'error', message: '수신자 전화번호를 입력해주세요.' });
      return;
    }
    if (!generatedMessage.trim()) {
      setSendStatus({ type: 'error', message: '발송할 문자 내용이 없습니다.' });
      return;
    }

    setIsSending(true);
    setSendStatus({ type: '', message: '' });

    try {
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phoneNumber,
          text: generatedMessage,
          customerName: customerName,
          question: question
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '문자 발송에 실패했습니다.');
      }

      setSendStatus({ type: 'success', message: '문자가 성공적으로 발송되었습니다!' });
      // 발송 성공 시 내역 새로고침
      fetchCustomerHistory(phoneNumber.replace(/[^0-9]/g, ''));
    } catch (err) {
      setSendStatus({ type: 'error', message: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    setQuestion('');
    setGeneratedMessage('');
    setError('');
    setSendStatus({ type: '', message: '' });
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Belleforet</h1>
        <p>AI CS 통합 센터</p>
      </header>

      <main className="main-grid">
        {/* Step 1: 고객 정보 카드 */}
        <section className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 className="card-title">
            <span style={{ background: 'var(--bubble-ai)', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.9rem', marginRight: '8px' }}>1</span>
            고객 정보 조회
          </h2>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#ccc' }}>수신자 전화번호 (필수)</label>
            <input
              type="tel"
              className="input-field"
              placeholder="- 없이 숫자만 입력"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem', outline: 'none' }}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#ccc' }}>고객명 (선택)</label>
            <input
              type="text"
              className="input-field"
              placeholder="예: 홍길동"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '1rem', outline: 'none' }}
            />
          </div>

          <div style={{ flex: 1, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '10px', color: '#fff' }}>과거 문의 내역</h3>
            {isFetchingHistory && <div className="spinner" style={{ margin: '0 auto' }}></div>}
            {historyError && <div style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>{historyError}</div>}
            
            {!isFetchingHistory && !historyError && customerHistory.length === 0 && phoneNumber.length >= 10 && (
              <div style={{ fontSize: '0.85rem', color: '#888', textAlign: 'center', marginTop: '20px' }}>과거 문의 내역이 없습니다.</div>
            )}
            
            {!isFetchingHistory && customerHistory.map((item, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', marginBottom: '10px', fontSize: '0.85rem' }}>
                <div style={{ color: '#aaa', marginBottom: '4px', fontSize: '0.75rem' }}>
                  {new Date(item.sentAt).toLocaleString()}
                </div>
                <div style={{ color: '#fff', marginBottom: '6px' }}><strong>Q:</strong> {item.question}</div>
                <div style={{ color: '#8ab4f8' }}><strong>A:</strong> {item.answer.substring(0, 50)}...</div>
              </div>
            ))}
          </div>
        </section>

        {/* Step 2: 문자 생성 카드 */}
        <section className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 className="card-title">
            <span style={{ background: 'var(--bubble-ai)', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.9rem', marginRight: '8px' }}>2</span>
            AI 답변 생성
          </h2>

          <p style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '15px' }}>
            고객의 질문 내용을 간략히 입력하시면, AI가 사내 규정을 검색하여 최적의 답변을 생성합니다.
          </p>
          
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#ccc' }}>고객 질문 내용 (필수)</label>
          <textarea 
            className="input-area"
            style={{ flex: 1, minHeight: '150px' }}
            placeholder="고객이 문의한 내용이나 상황을 입력하세요.&#13;&#10;(예: 수영장 이용 시간과 복장이 어떻게 되나요?)"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          
          {error && <div className="error-message">{error}</div>}

          <button 
            className="btn-primary" 
            onClick={handleGenerate}
            disabled={isLoading || !question.trim()}
            style={{ marginTop: '15px', padding: '18px 24px' }}
          >
            {isLoading ? (
              <>
                <div className="spinner"></div>
                답변 탐색 및 생성 중...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                AI 답변 만들어 발송함으로 넘기기
              </>
            )}
          </button>
        </section>

        {/* Step 3: 최종 발송 카드 */}
        <section className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 className="card-title">
            <span style={{ background: 'var(--bubble-ai)', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.9rem', marginRight: '8px' }}>3</span>
            검토 및 발송
          </h2>
          
          <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginBottom: '15px' }}>
            <div style={{ fontSize: '0.9rem', color: '#ccc', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>수신자: {customerName ? `${customerName} 님` : '이름 미상'}</span>
              <span>{phoneNumber || '연락처 미입력'}</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#888', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
              발신 번호: {fromNumber}
            </div>
          </div>

          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#ccc' }}>발송할 내용 (수정 가능)</label>
          <textarea 
            className="input-area"
            style={{ flex: 1, minHeight: '200px', borderColor: generatedMessage ? 'var(--bubble-ai)' : 'rgba(0,0,0,0.1)' }}
            placeholder="2단계에서 [생성] 버튼을 누르면 이 곳에 답변이 채워집니다."
            value={generatedMessage}
            onChange={(e) => setGeneratedMessage(e.target.value)}
          />

          {sendStatus.message && (
            <div style={{
              color: sendStatus.type === 'error' ? '#ff6b6b' : '#51cf66',
              fontSize: '0.9rem',
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.2)',
              marginBottom: '15px',
              textAlign: 'center'
            }}>
              {sendStatus.message}
            </div>
          )}

          <div className="actions" style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
            <button 
              className="btn-primary" 
              onClick={handleSendSms}
              disabled={isSending || !generatedMessage}
              style={{ flex: 2, padding: '18px 24px', background: !generatedMessage ? 'rgba(255,255,255,0.1)' : '#34c759' }}
            >
              {isSending ? '발송 처리 중...' : '🚀 최종 발송하기'}
            </button>
            <button className="btn-secondary" onClick={handleReset} style={{ flex: 1 }}>
              내용 초기화
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
