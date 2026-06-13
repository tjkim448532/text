'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';



export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/');
        return;
      }
      
      try {
        const token = await currentUser.getIdToken();
        const roleRes = await fetch('/api/auth/role', { headers: { 'Authorization': `Bearer ${token}` } });
        const roleData = await roleRes.json();
        
        if (roleData.role !== 'SUPER') {
          alert('최고 관리자(SUPER) 권한이 없습니다.');
          router.push('/');
        } else {
          setUser(currentUser);
          fetchHistory();
        }
      } catch (e) {
        alert('권한 확인 중 오류가 발생했습니다.');
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/history', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        setHistory(data.history);
      } else {
        setError(data.error || '내역을 불러오는 데 실패했습니다.');
      }
    } catch (err) {
      setError('서버 통신 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || isLoading) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#fff' }}>로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '5px' }}>👑 관리자 대시보드</h1>
          <p style={{ color: '#ccc' }}>직원들의 전체 문자 발송 내역 모니터링</p>
        </div>
        <button 
          onClick={() => router.push('/')}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
        >
          메인으로 돌아가기
        </button>
      </header>

      {error && <div style={{ color: '#ff6b6b', marginBottom: '20px' }}>{error}</div>}

      <div className="glass-card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', textAlign: 'left', background: 'rgba(0,0,0,0.2)' }}>
              <th style={{ padding: '15px 10px' }}>발송 일시</th>
              <th style={{ padding: '15px 10px' }}>담당 직원</th>
              <th style={{ padding: '15px 10px' }}>수신자 (이름/번호)</th>
              <th style={{ padding: '15px 10px', width: '25%' }}>질문 내용</th>
              <th style={{ padding: '15px 10px', width: '35%' }}>발송된 답변</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#ccc' }}>
                  발송된 문자 내역이 없습니다.
                </td>
              </tr>
            ) : (
              history.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '15px 10px', color: '#aaa', fontSize: '0.8rem' }}>
                    {new Date(item.sentAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '15px 10px', color: '#3498db' }}>
                    {item.employeeEmail ? item.employeeEmail.split('@')[0] : '알 수 없음'}
                  </td>
                  <td style={{ padding: '15px 10px' }}>
                    <div>{item.customerName}</div>
                    <div style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '4px' }}>{item.phoneNumber}</div>
                  </td>
                  <td style={{ padding: '15px 10px', color: '#fff' }}>
                    {item.question}
                  </td>
                  <td style={{ padding: '15px 10px', color: '#8ab4f8', lineHeight: '1.4' }}>
                    {item.answer}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
