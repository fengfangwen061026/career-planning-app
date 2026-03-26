import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const screens = [
  {
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ marginBottom: 16 }}>
        <rect width="80" height="80" rx="20" fill="#EEF2FF"/>
        <rect x="18" y="22" width="44" height="36" rx="4" fill="#C7D2FE" stroke="#4F46E5" strokeWidth="1.5"/>
        <rect x="24" y="30" width="32" height="3" rx="1.5" fill="#4F46E5" opacity="0.6"/>
        <rect x="24" y="36" width="24" height="3" rx="1.5" fill="#4F46E5" opacity="0.4"/>
        <rect x="24" y="42" width="28" height="3" rx="1.5" fill="#4F46E5" opacity="0.4"/>
        <circle cx="56" cy="52" r="12" fill="#4F46E5"/>
        <path d="M51 52l3 3 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'AI 简历解析',
    desc: '上传 PDF / DOCX 简历，AI 自动提取教育经历、技能、实习项目，生成专属学生画像。',
  },
  {
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ marginBottom: 16 }}>
        <rect width="80" height="80" rx="20" fill="#D1FAE5"/>
        <circle cx="40" cy="35" r="16" fill="#A7F3D0" stroke="#10B981" strokeWidth="1.5"/>
        <path d="M33 35l4 4 10-10" stroke="#065F46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="20" y="56" width="40" height="8" rx="4" fill="#10B981" opacity="0.3"/>
        <rect x="24" y="58" width="24" height="4" rx="2" fill="#10B981"/>
      </svg>
    ),
    title: '岗位精准匹配',
    desc: '基于四维评分体系（基础要求、技能匹配、职业素养、发展潜力），找到最适合你的岗位。',
  },
  {
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ marginBottom: 16 }}>
        <rect width="80" height="80" rx="20" fill="#FEF3C7"/>
        <rect x="16" y="20" width="48" height="40" rx="6" fill="#FDE68A" stroke="#D97706" strokeWidth="1.5"/>
        <rect x="22" y="28" width="36" height="3" rx="1.5" fill="#D97706" opacity="0.7"/>
        <rect x="22" y="34" width="28" height="3" rx="1.5" fill="#D97706" opacity="0.5"/>
        <rect x="22" y="40" width="32" height="3" rx="1.5" fill="#D97706" opacity="0.5"/>
        <rect x="22" y="46" width="20" height="3" rx="1.5" fill="#D97706" opacity="0.3"/>
        <path d="M56 54l8-8" stroke="#D97706" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    title: '生成职业规划报告',
    desc: '五章式 AI 报告：优势总结、岗位分析、差距清单、路径规划、评估周期，一键导出 PDF。',
  },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')

  const isLoginScreen = step === 3

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1)
    } else {
      setStep(3)
    }
  }

  const handleLogin = () => {
    navigate('/upload')
  }

  const handleDemo = () => {
    navigate('/upload')
  }

  if (isLoginScreen) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '20px 16px', textAlign: 'center', background: 'white',
      }}>
        <svg width="48" height="48" viewBox="0 0 48 48" style={{ marginBottom: 16 }}>
          <rect width="48" height="48" rx="12" fill="#EEF2FF"/>
          <circle cx="24" cy="20" r="8" fill="#C7D2FE" stroke="#4F46E5" strokeWidth="1.5"/>
          <path d="M10 40c0-7.7 6.3-14 14-14s14 6.3 14 14" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        </svg>
        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.6px', color: '#0A0A0A', marginBottom: 8 }}>
          开始使用
        </div>
        <div style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.7, marginBottom: 24 }}>
          输入学号登录或使用演示账号体验
        </div>
        <div style={{ width: '100%', textAlign: 'left', marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 4 }}>姓名</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="请输入姓名"
            style={{
              width: '100%', height: 32, border: '0.5px solid #D1D5DB',
              borderRadius: 8, padding: '0 10px', fontSize: 10,
              background: '#F9FAFB', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>
        <div style={{ width: '100%', textAlign: 'left', marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 4 }}>学号</div>
          <input
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            placeholder="请输入学号"
            style={{
              width: '100%', height: 32, border: '0.5px solid #D1D5DB',
              borderRadius: 8, padding: '0 10px', fontSize: 10,
              background: '#F9FAFB', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>
        <button onClick={handleLogin} className="btn-primary" style={{ marginTop: 0, marginBottom: 8 }}>
          登录
        </button>
        <button
          onClick={handleDemo}
          style={{
            width: '100%', border: '0.5px solid #E5E7EB', background: 'transparent',
            borderRadius: 8, padding: '8px 0', fontSize: 10, color: '#6B7280',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
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
      <button onClick={handleNext} className="btn-primary" style={{ marginTop: 0 }}>
        {step < 2 ? '下一步' : '开始使用'}
      </button>
      <div
        onClick={() => navigate('/upload')}
        style={{ fontSize: 9, color: '#9CA3AF', marginTop: 10, cursor: 'pointer' }}
      >
        跳过引导
      </div>
    </div>
  )
}
