'use client';

import { useState, useEffect } from 'react';
import { app, auth } from '../lib/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword } from 'firebase/auth';

export default function Home() {
  // === Auth State ===
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('USER');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Password Change State
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordChangeStatus, setPasswordChangeStatus] = useState({ type: '', message: '' });

  // === App State ===
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

  // 가이드 모달 상태
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // === Effects ===
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          
          // Fetch fromNumber
          fetch('/api/config', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => setFromNumber(data.fromNumber || '미등록'))
            .catch(() => setFromNumber('불러오기 실패'));

          // Fetch user role
          fetch('/api/auth/role', { 
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store'
          })
            .then(res => res.json())
            .then(data => {
              setUserRole(data.role || 'USER');
              setIsAuthLoading(false);
            })
            .catch(() => {
              setUserRole('USER');
              setIsAuthLoading(false);
            });
            
        } catch (e) {
          setFromNumber('불러오기 실패');
          setIsAuthLoading(false);
        }
      } else {
        setIsAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 전화번호가 변경될 때마다 10자리 이상이면 자동 조회 (Debounce 적용)
  useEffect(() => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 10) {
      const timer = setTimeout(() => {
        fetchCustomerHistory(cleanPhone);
      }, 500); // 500ms 디바운스
      return () => clearTimeout(timer);
    } else {
      setCustomerHistory([]);
      setHistoryError('');
    }
  }, [phoneNumber]);

  // === Auth Handlers ===
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (err) {
      setLoginError(`로그인 실패: ${err.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordChangeStatus({ type: 'error', message: '비밀번호는 최소 6자리 이상이어야 합니다.' });
      return;
    }
    setPasswordChangeStatus({ type: '', message: '' });
    try {
      await updatePassword(auth.currentUser, newPassword);
      setPasswordChangeStatus({ type: 'success', message: '비밀번호가 성공적으로 변경되었습니다!' });
      setNewPassword('');
      setTimeout(() => {
        setIsPasswordChangeOpen(false);
        setPasswordChangeStatus({ type: '', message: '' });
      }, 2000);
    } catch (err) {
      setPasswordChangeStatus({ type: 'error', message: '오류가 발생했습니다. (최근에 로그인한 상태여야 합니다. 로그아웃 후 다시 시도해보세요.)' });
    }
  };

  // === App Handlers ===
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
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/generate-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ 
          question, 
          customerName, 
          phoneNumber,
          employeeEmail: user?.email // 담당자 기록용
        }),
      });

      if (!response.ok) {
        let errorMsg = '문자 생성에 실패했습니다.';
        try {
          const data = await response.json();
          errorMsg = data.error || errorMsg;
        } catch(e) {}
        throw new Error(errorMsg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedMessage = '';
      
      setGeneratedMessage(''); // 초기화
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunkText = decoder.decode(value, { stream: true });
        accumulatedMessage += chunkText;
        setGeneratedMessage(accumulatedMessage);
      }
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
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          to: phoneNumber,
          text: generatedMessage,
          customerName: customerName,
          question: question,
          employeeEmail: user?.email // 담당자 기록용
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
    setPhoneNumber('');
    setCustomerName('');
    setQuestion('');
    setGeneratedMessage('');
    setSendStatus({ type: '', message: '' });
    setError('');
  };

  // === Renders ===
  if (isAuthLoading) {
    return <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}><div className="spinner"></div></div>;
  }

  if (!user) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '40px 30px' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '10px' }}>문자 발송 TEST</h1>
            <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>직원 로그인</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', opacity: 0.7 }}>사내 이메일</label>
              <input 
                type="email" 
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="input-field" 
                placeholder="test@example.com"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', opacity: 0.7 }}>비밀번호</label>
              <input 
                type="password" 
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="input-field" 
                placeholder="비밀번호 입력"
                required
              />
            </div>
            {loginError && <div style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>{loginError}</div>}
            <button type="submit" className="btn-primary" disabled={isLoggingIn} style={{ padding: '12px', marginTop: '10px' }}>
              {isLoggingIn ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>문자 발송 TEST</h1>
          <p>AI CS 통합 센터</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.7, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '10px' }}>
            <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{user.email} <span style={{fontSize:'0.7rem', color:'gray'}}>({userRole})</span></span>
            <span style={{ cursor: 'pointer', color: '#3498db', marginTop: '4px' }} onClick={() => setIsPasswordChangeOpen(true)}>비밀번호 변경</span>
          </div>
          {userRole === 'SUPER' && (
            <button 
              onClick={() => router.push('/admin')}
              style={{
                background: 'rgba(231, 76, 60, 0.2)',
                border: '1px solid rgba(231, 76, 60, 0.5)',
                color: '#ffbeb8',
                padding: '8px 16px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              👑 관리자
            </button>
          )}
          <button 
            onClick={() => setIsGuideOpen(true)}
            style={{
              background: 'transparent',
              border: '1px solid var(--card-border)',
              color: 'var(--foreground)',
              padding: '8px 16px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backdropFilter: 'blur(10px)'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            사용 방법
          </button>
          <button 
            onClick={handleLogout}
            style={{
              background: 'none', border: '1px solid var(--card-border)', color: 'var(--foreground)', opacity: 0.8, padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 비밀번호 변경 모달 */}
      {isPasswordChangeOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
        }}>
          <div style={{ background: 'var(--background)', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '30px', position: 'relative', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--card-border)' }}>
            <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', color: 'var(--foreground)' }}>🔒 비밀번호 변경</h2>
            <form onSubmit={handleChangePassword}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', opacity: 0.7 }}>새 비밀번호 (6자리 이상)</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field" 
                placeholder="새로운 비밀번호 입력"
                required
                style={{ marginBottom: '15px' }}
              />
              {passwordChangeStatus.message && (
                <div style={{ color: passwordChangeStatus.type === 'error' ? '#ff6b6b' : '#51cf66', fontSize: '0.85rem', marginBottom: '15px' }}>
                  {passwordChangeStatus.message}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '10px' }}>변경하기</button>
                <button type="button" onClick={() => { setIsPasswordChangeOpen(false); setPasswordChangeStatus({type:'', message:''}); setNewPassword(''); }} className="btn-secondary" style={{ flex: 1, padding: '10px' }}>취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 사용 가이드 모달 */}
      {isGuideOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(5px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #2c3e50, #3498db)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflowY: 'auto',
            padding: '30px',
            position: 'relative',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <button 
              onClick={() => setIsGuideOpen(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--foreground)', cursor: 'pointer', fontSize: '1.5rem' }}
            >
              &times;
            </button>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🛎️ TEST 문자 발송 시스템 가이드
            </h2>
            <div style={{ lineHeight: '1.6', fontSize: '0.95rem', color: 'var(--foreground)' }}>
              <p>초보자도 클릭 몇 번이면 베테랑처럼 고객 문의에 답변할 수 있습니다. 아래의 3단계 흐름만 기억하세요!</p>
              
              <h3 style={{ marginTop: '20px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '5px' }}>🚀 1분 컷 핵심 요약</h3>
              <ol style={{ paddingLeft: '20px', marginTop: '10px' }}>
                <li style={{ marginBottom: '5px' }}><strong>입력:</strong> 고객 정보(전화번호/이름)를 적습니다.</li>
                <li style={{ marginBottom: '5px' }}><strong>생성:</strong> 고객의 질문을 키워드로 적고 [AI 답변 생성] 버튼을 누릅니다.</li>
                <li style={{ marginBottom: '5px' }}><strong>발송:</strong> AI가 만들어준 내용을 확인하고 [최종 발송]을 누릅니다.</li>
              </ol>

              <h3 style={{ marginTop: '20px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '5px' }}>🎬 상황별 실전 시나리오</h3>
              
              <div style={{ background: 'transparent', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
                <strong style={{ color: '#ffbeb8' }}>💡 [상황 1] 고객이 처음 전화로 문의했을 때</strong>
                <ul style={{ paddingLeft: '20px', marginTop: '5px', listStyleType: 'circle' }}>
                  <li><strong>입력:</strong> <code>010-1234-5678</code> / <code>홍길동</code></li>
                  <li><strong>질문 요약:</strong> "루지 키 제한이랑 가격 어떻게 돼?"</li>
                  <li><strong>생성:</strong> AI가 TEST 데이터베이스를 검색해 정중한 답변을 자동 완성합니다.</li>
                  <li><strong>발송:</strong> 내용을 확인하고 [최종 발송]을 누르면 끝!</li>
                </ul>
              </div>

              <div style={{ background: 'transparent', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
                <strong style={{ color: '#ffd43b' }}>💡 [상황 2] 예전에 전화했던 단골 고객일 때</strong>
                <ul style={{ paddingLeft: '20px', marginTop: '5px', listStyleType: 'circle' }}>
                  <li>고객 전화번호를 치는 순간 우측에 <strong>과거 상담 기록</strong>이 주르륵 뜹니다.</li>
                  <li><em>"아~ 고객님 저번에 문의하신 건은 잘 해결되셨나요?"</em> 라며 센스 있게 먼저 응대해 보세요!</li>
                </ul>
              </div>

              <div style={{ background: 'transparent', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
                <strong style={{ color: '#69db7c' }}>💡 [상황 3] 기상 악화 등 정보 수정이 필요할 때</strong>
                <ul style={{ paddingLeft: '20px', marginTop: '5px', listStyleType: 'circle' }}>
                  <li>AI가 답변을 완성한 후에도 마우스로 클릭해 <strong>텍스트를 자유롭게 수정</strong>할 수 있습니다.</li>
                  <li><em>"비가 와서 오늘은 루지가 휴장입니다"</em> 와 같이 추가/수정 후 발송하세요.</li>
                </ul>
              </div>
            </div>
            <button 
              onClick={() => setIsGuideOpen(false)}
              className="btn-primary"
              style={{ width: '100%', marginTop: '25px', padding: '12px', background: 'var(--bubble-ai)' }}
            >
              가이드 닫기
            </button>
          </div>
        </div>
      )}

      <main className="main-grid">
        {/* Step 1: 고객 정보 카드 */}
        <section className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 className="card-title">
            <span style={{ background: 'var(--bubble-ai)', color: 'var(--foreground)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.9rem', marginRight: '8px' }}>1</span>
            고객 정보 조회 및 등록
          </h2>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', opacity: 0.7 }}>수신자 전화번호 (필수)</label>
            <input
              type="tel"
              className="input-field"
              placeholder="- 없이 숫자만 입력"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--foreground)', fontSize: '1rem', outline: 'none' }}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', opacity: 0.7 }}>고객명 (선택)</label>
            <input
              type="text"
              className="input-field"
              placeholder="예: 홍길동"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--foreground)', fontSize: '1rem', outline: 'none' }}
            />
          </div>

          <div style={{ flex: 1, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '10px', color: 'var(--foreground)' }}>과거 문의 내역</h3>
            {isFetchingHistory && <div className="spinner" style={{ margin: '0 auto' }}></div>}
            {historyError && <div style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>{historyError}</div>}
            
            {!isFetchingHistory && !historyError && customerHistory.length === 0 && phoneNumber.length >= 10 && (
              <div style={{ fontSize: '0.85rem', color: '#888', textAlign: 'center', marginTop: '20px' }}>과거 문의 내역이 없습니다.</div>
            )}
            
            {!isFetchingHistory && customerHistory.map((item) => (
              <div key={item.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', marginBottom: '10px', fontSize: '0.85rem' }}>
                <div style={{ opacity: 0.6, marginBottom: '4px', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{new Date(item.sentAt).toLocaleString()}</span>
                  {item.employeeEmail && <span style={{ background: 'rgba(52, 152, 219, 0.2)', color: '#3498db', padding: '2px 6px', borderRadius: '4px' }}>담당: {item.employeeEmail.split('@')[0]}</span>}
                </div>
                <div style={{ color: 'var(--foreground)', marginBottom: '6px' }}><strong>Q:</strong> {item.question}</div>
                <div style={{ color: '#8ab4f8' }}><strong>A:</strong> {item.answer.substring(0, 50)}...</div>
              </div>
            ))}
          </div>
        </section>

        {/* Step 2: 문자 생성 카드 */}
        <section className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 className="card-title">
            <span style={{ background: 'var(--bubble-ai)', color: 'var(--foreground)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.9rem', marginRight: '8px' }}>2</span>
            AI 답변 생성
          </h2>

          <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '15px' }}>
            고객의 질문 내용을 간략히 입력하시면, AI가 사내 규정을 검색하여 최적의 답변을 생성합니다.
          </p>
          
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', opacity: 0.7 }}>고객 질문 내용 (필수)</label>
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
            <span style={{ background: 'var(--bubble-ai)', color: 'var(--foreground)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.9rem', marginRight: '8px' }}>3</span>
            검토 및 발송
          </h2>
          
          <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginBottom: '15px' }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.7, display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>수신자: {customerName ? `${customerName} 님` : '이름 미상'}</span>
              <span>{phoneNumber || '연락처 미입력'}</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#888', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
              발신 번호: {fromNumber}
            </div>
          </div>

          <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', opacity: 0.7 }}>발송할 내용 (수정 가능)</label>
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
              background: 'transparent',
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
              disabled={isSending || !generatedMessage || sendStatus.type === 'success'}
              style={{ flex: 2, padding: '18px 24px', background: (!generatedMessage || sendStatus.type === 'success') ? 'rgba(255,255,255,0.1)' : '#34c759' }}
            >
              {isSending ? '발송 처리 중...' : (sendStatus.type === 'success' ? '✔ 발송 완료' : '🚀 최종 발송하기')}
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
