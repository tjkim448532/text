'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [question, setQuestion] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fromNumber, setFromNumber] = useState('로딩 중...');
  
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // SMS 송신 상태
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    // 발신 번호 불러오기
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setFromNumber(data.fromNumber || '미등록'))
      .catch(() => setFromNumber('불러오기 실패'));
  }, []);

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
        headers: {
          'Content-Type': 'application/json',
        },
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

  const handleCopy = () => {
    if (generatedMessage) {
      navigator.clipboard.writeText(generatedMessage);
      alert('문자가 클립보드에 복사되었습니다.');
    }
  };

  const handleSendSms = async () => {
    if (!phoneNumber.trim()) {
      setSendStatus({ type: 'error', message: '수신자 전화번호를 좌측에 먼저 입력해주세요.' });
      return;
    }

    setIsSending(true);
    setSendStatus({ type: '', message: '' });

    try {
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
    } catch (err) {
      setSendStatus({ type: 'error', message: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    setQuestion('');
    setCustomerName('');
    setPhoneNumber('');
    setGeneratedMessage('');
    setError('');
    setSendStatus({ type: '', message: '' });
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Blackstone Belle Foret</h1>
        <p>AI CS 통합 문자 발송 시스템</p>
      </header>

      <main className="main-grid">
        {/* Left Side: Input Area */}
        <section className="glass-card">
          <h2 className="card-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            고객 및 질문 정보 입력
          </h2>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#ccc' }}>고객명 (선택)</label>
              <input
                type="text"
                className="input-field"
                placeholder="예: 홍길동"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.2)',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#ccc' }}>수신자 전화번호 (필수)</label>
              <input
                type="tel"
                className="input-field"
                placeholder="- 없이 숫자만"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.2)',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#ccc' }}>고객 질문 내용 (필수)</label>
          <textarea 
            className="input-area"
            style={{ minHeight: '120px' }}
            placeholder="고객이 문의한 내용이나 상황을 입력하세요.&#13;&#10;(예: 수영장 이용 시간과 복장이 어떻게 되나요?)"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          
          {error && <div className="error-message">{error}</div>}

          <button 
            className="btn-primary" 
            onClick={handleGenerate}
            disabled={isLoading}
            style={{ marginTop: 'auto' }}
          >
            {isLoading ? (
              <>
                <div className="spinner"></div>
                AI 답변 탐색 및 문자 생성 중...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                AI 문자 답변 생성
              </>
            )}
          </button>
        </section>

        {/* Right Side: Output Preview */}
        <section className="glass-card">
          <h2 className="card-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
            발송 미리보기
          </h2>
          
          <div className="chat-container">
            {!generatedMessage ? (
              <div className="placeholder-text">
                고객의 질문을 입력하고 생성 버튼을 누르면<br/>FAQ 규정에 맞는 완벽한 답변이 표시됩니다.
              </div>
            ) : (
              <>
                <div className="bubble bubble-received">
                  {question.substring(0, 50)}{question.length > 50 ? '...' : ''}
                </div>
                
                <div className="bubble bubble-sent">
                  {generatedMessage.split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      <br/>
                    </span>
                  ))}
                </div>
                <div className="timestamp">방금 전 AI(FAQ 기반)가 생성함</div>

                <div className="sms-send-form" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '0.9rem',
                    color: '#ddd'
                  }}>
                    <strong>발신 번호:</strong> {fromNumber}
                  </div>
                  
                  {sendStatus.message && (
                    <div style={{
                      color: sendStatus.type === 'error' ? '#ff6b6b' : '#51cf66',
                      fontSize: '0.9rem',
                      padding: '8px',
                      borderRadius: '4px',
                      background: 'rgba(0,0,0,0.2)'
                    }}>
                      {sendStatus.message}
                    </div>
                  )}

                  <div className="actions" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button 
                      className="btn-primary" 
                      onClick={handleSendSms}
                      disabled={isSending}
                      style={{ flex: 2 }}
                    >
                      {isSending ? '발송 중...' : '🚀 고객에게 바로 발송하기'}
                    </button>
                    <button className="btn-secondary" onClick={handleCopy} style={{ flex: 1 }}>
                      복사
                    </button>
                    <button className="btn-secondary" onClick={handleReset} style={{ flex: 1 }}>
                      초기화
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
