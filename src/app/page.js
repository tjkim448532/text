'use client';

import { useState } from 'react';

export default function Home() {
  const [notes, setNotes] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!notes.trim()) {
      setError('고객에게 보낼 내용을 메모 형식으로 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/generate-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
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

  const handleReset = () => {
    setNotes('');
    setGeneratedMessage('');
    setError('');
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Blackstone Belle Foret</h1>
        <p>AI 고객 안내 문자 생성기</p>
      </header>

      <main className="main-grid">
        {/* Left Side: Input Area */}
        <section className="glass-card">
          <h2 className="card-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            직원 메모 입력
          </h2>
          
          <textarea 
            className="input-area"
            placeholder="고객 안내에 필요한 내용을 간단히 입력하세요. (예: 101호 고객, 수건 2장 추가 요청, 프론트에서 5분 내로 전달 예정)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
                생성 중...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                AI 문자 생성하기
              </>
            )}
          </button>
        </section>

        {/* Right Side: Output Preview (iMessage style) */}
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
                메모를 입력하고 생성 버튼을 누르면<br/>여기에 완성된 문자가 표시됩니다.
              </div>
            ) : (
              <>
                {/* Simulated Customer Message (Optional) */}
                <div className="bubble bubble-received">
                  {notes.substring(0, 50)}{notes.length > 50 ? '...' : ''}
                </div>
                
                {/* AI Generated Message */}
                <div className="bubble bubble-sent">
                  {generatedMessage.split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      <br/>
                    </span>
                  ))}
                </div>
                <div className="timestamp">방금 전 생성됨</div>

                <div className="actions">
                  <button className="btn-secondary" onClick={handleCopy}>
                    복사하기
                  </button>
                  <button className="btn-secondary" onClick={handleReset}>
                    새로 고침
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
