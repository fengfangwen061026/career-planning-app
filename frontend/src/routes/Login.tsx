import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

export const ADMIN_AUTH_KEY = 'zhiyin_admin_authenticated';

export function isAdminAuthenticated() {
  return localStorage.getItem(ADMIN_AUTH_KEY) === 'true';
}

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (isAdminAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (username === 'admin' && password === '123456') {
      localStorage.setItem(ADMIN_AUTH_KEY, 'true');
      navigate('/', { replace: true });
      return;
    }
    setError('账号或密码错误');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F7F3EA 0%, #EEF3F8 100%)',
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 380,
          padding: '36px 32px',
          borderRadius: 24,
          background: 'rgba(255,255,255,0.88)',
          boxShadow: '0 24px 80px rgba(17,24,39,0.12)',
          border: '1px solid rgba(229,231,235,0.8)',
        }}
      >
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #E07B6A, #7C6DC8)',
              margin: '0 auto 14px',
            }}
          />
          <h1 style={{ margin: 0, fontSize: 24, color: '#111827', fontWeight: 800 }}>
            管理端登录
          </h1>
          <p style={{ margin: '8px 0 0', color: '#6B7280', fontSize: 14 }}>
            请输入管理员账号密码
          </p>
        </div>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', marginBottom: 8, color: '#374151', fontSize: 13, fontWeight: 600 }}>
            账号
          </span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoFocus
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid #D1D5DB',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 18 }}>
          <span style={{ display: 'block', marginBottom: 8, color: '#374151', fontSize: 13, fontWeight: 600 }}>
            密码
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid #D1D5DB',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </label>

        {error && (
          <div style={{ marginBottom: 16, color: '#DC2626', fontSize: 13, textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 12,
            padding: '12px 16px',
            color: 'white',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #5B6FD4, #7C6DC8)',
          }}
        >
          登录
        </button>
      </form>
    </div>
  );
}
