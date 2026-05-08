import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../../api/client'
import { session } from '../../store/session'

const screens = [
  {
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ marginBottom: 16 }}>
        <rect width="80" height="80" rx="20" fill="#EEF2FF" />
        <rect x="18" y="22" width="44" height="36" rx="4" fill="#C7D2FE" stroke="#4F46E5" strokeWidth="1.5" />
        <rect x="24" y="30" width="32" height="3" rx="1.5" fill="#4F46E5" opacity="0.6" />
        <rect x="24" y="36" width="24" height="3" rx="1.5" fill="#4F46E5" opacity="0.4" />
        <rect x="24" y="42" width="28" height="3" rx="1.5" fill="#4F46E5" opacity="0.4" />
        <circle cx="56" cy="52" r="12" fill="#4F46E5" />
        <path d="M51 52l3 3 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: <>上传简历<br />一键解析</>,
    desc: <>支持 PDF/Word，AI 自动提取<br />教育、技能、项目、证书等信息</>,
  },
  {
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ marginBottom: 16 }}>
        <rect width="80" height="80" rx="20" fill="#D1FAE5" />
        <circle cx="40" cy="36" r="16" fill="#6EE7B7" stroke="#10B981" strokeWidth="1.5" />
        <circle cx="40" cy="36" r="8" fill="#10B981" />
        <path d="M36 36l2.5 2.5 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="22" y="56" width="36" height="4" rx="2" fill="#10B981" opacity="0.3" />
        <rect x="28" y="56" width="24" height="4" rx="2" fill="#10B981" opacity="0.5" />
      </svg>
    ),
    title: <>智能匹配<br />找准方向</>,
    desc: <>四维评分精准分析<br />差距一目了然，路径清晰可见</>,
  },
]

interface SessionResponse {
  student: {
    id: string
    name: string | null
    email: string
  }
  created: boolean
  has_profile: boolean
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [account, setAccount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isLoginScreen = step === 2

  const handleNext = () => {
    if (step < 1) {
      setStep(step + 1)
      return
    }
    setStep(2)
  }

  const handleLogin = async () => {
    if (!account.trim()) {
      setError('请输入手机号或邮箱')
      return
    }

    setLoading(true)
    setError('')

    try {
      const isEmail = account.includes('@')
      const payload = isEmail
        ? { email: account.trim() }
        : { phone: account.trim() }

      const res = await api.post<SessionResponse>('/student-app/session', payload)

      session.clear()
      session.setStudentId(res.student.id)
      session.setEmail(res.student.email)
      session.setName(res.student.name || '同学')
      session.setHasProfile(res.has_profile)

      navigate('/upload')
    } catch {
      setError('登录失败，请检查网络连接')
    } finally {
      setLoading(false)
    }
  }

  const handleDemo = () => {
    session.clear()
    session.setStudentId(session.DEMO_STUDENT_ID)
    session.setEmail(session.DEMO_EMAIL)
    session.setName(session.DEMO_NAME)
    session.setHasProfile(true)
    navigate('/upload')
  }

  if (isLoginScreen) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px', background: 'white',
      }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: '#4F46E5', background: '#EEF2FF', padding: '4px 10px', borderRadius: 999, marginBottom: 12 }}>
          智引鸿图
        </div>
        <svg width="80" height="80" viewBox="0 0 80 80" style={{ marginBottom: 16 }}>
          <rect width="80" height="80" rx="20" fill="#EEF2FF" />
          <rect x="16" y="28" width="48" height="32" rx="6" fill="#C7D2FE" stroke="#4F46E5" strokeWidth="1.5" />
          <rect x="24" y="36" width="32" height="3" rx="1.5" fill="#4F46E5" opacity="0.5" />
          <rect x="24" y="42" width="20" height="3" rx="1.5" fill="#4F46E5" opacity="0.35" />
          <circle cx="40" cy="22" r="8" fill="#818CF8" stroke="#4F46E5" strokeWidth="1.5" />
          <circle cx="40" cy="20" r="3" fill="#4F46E5" />
          <path d="M33 28c0-3.9 3.1-7 7-7s7 3.1 7 7" fill="#818CF8" />
        </svg>
        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.6px', color: '#0A0A0A', marginBottom: 4, textAlign: 'center' }}>
          开始规划你的<br />职业之路
        </div>
        <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 20, textAlign: 'center' }}>
          数据安全存储，随时续用
        </div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: i === 2 ? 18 : 6,
              height: 4, borderRadius: 2,
              background: i === 2 ? '#4F46E5' : '#E5E7EB',
            }} />
          ))}
        </div>
        <div style={{ width: '100%', marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 4 }}>手机号 / 邮箱</div>
          <div style={{ height: 32, border: '0.5px solid #D1D5DB', borderRadius: 8, padding: '0 10px', display: 'flex', alignItems: 'center', background: '#FFFFFF' }}>
            <input
              value={account}
              onChange={e => setAccount(e.target.value)}
              placeholder="请输入账号"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 10, color: '#0A0A0A', width: '100%', fontFamily: 'inherit' }}
            />
          </div>
          {error && (
            <div style={{ fontSize: 9, color: '#EF4444', marginTop: 4 }}>
              {error}
            </div>
          )}
        </div>
        <button
          onClick={() => { void handleLogin() }}
          className="btn-primary"
          style={{ marginTop: 0, background: loading ? '#9CA3AF' : '#4F46E5' }}
          disabled={loading}
        >
          {loading ? '登录中...' : '登录 / 注册'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0', width: '100%' }}>
          <div style={{ flex: 1, height: '0.5px', background: '#E5E7EB' }} />
          <span style={{ fontSize: 9, color: '#9CA3AF' }}>或</span>
          <div style={{ flex: 1, height: '0.5px', background: '#E5E7EB' }} />
        </div>
        <button
          onClick={handleDemo}
          style={{ width: '100%', padding: '7px', background: 'transparent', border: '0.5px solid #E5E7EB', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#6B7280' }}
        >
          使用 Demo 账号体验
        </button>
      </div>
    )
  }

  const s = screens[step]
  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px', textAlign: 'center', background: 'white',
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: '#4F46E5', background: '#EEF2FF', padding: '4px 10px', borderRadius: 999, marginBottom: 12 }}>
        智引鸿图
      </div>
      {s.icon}
      <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.6px', color: '#0A0A0A', marginBottom: 8 }}>
        {s.title}
      </div>
      <div style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.7, marginBottom: 20 }}>
        {s.desc}
      </div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: i === step ? 18 : 6,
            height: 4, borderRadius: 2,
            background: i === step ? '#4F46E5' : '#E5E7EB',
            transition: 'all 0.2s',
          }} />
        ))}
      </div>
      <button onClick={handleNext} className="btn-primary" style={{ marginTop: 0 }}>下一步</button>
      <div
        onClick={() => setStep(2)}
        style={{ fontSize: 9, color: '#9CA3AF', marginTop: 10, cursor: 'pointer' }}
      >
        跳过引导
      </div>
    </div>
  )
}
