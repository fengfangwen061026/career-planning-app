import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useMobileApp } from '../context/MobileAppContext'
import './OnboardingFlow.css'

function inferAccountPayload(account: string) {
  const value = account.trim()
  if (!value) return {}
  if (value.includes('@')) return { email: value.toLowerCase() }
  return { phone: value }
}

// SVG 插图 - S-01: 上传简历
const IllustrationUpload: React.FC = () => (
  <svg width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="20" fill="#EEF2FF" />
    <rect x="18" y="22" width="44" height="36" rx="4" fill="#C7D2FE" stroke="#4F46E5" strokeWidth="1.5" />
    <rect x="24" y="30" width="32" height="2" rx="1" fill="#4F46E5" opacity="0.6" />
    <rect x="24" y="36" width="24" height="2" rx="1" fill="#4F46E5" opacity="0.4" />
    <rect x="24" y="42" width="28" height="2" rx="1" fill="#4F46E5" opacity="0.4" />
    <circle cx="56" cy="52" r="12" fill="#4F46E5" />
    <path d="M51 52l3.5 3.5L61 48" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// SVG 插图 - S-02: 智能匹配
const IllustrationMatch: React.FC = () => (
  <svg width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="20" fill="#D1FAE5" />
    <circle cx="30" cy="40" r="12" fill="#A7F3D0" stroke="#10B981" strokeWidth="1.5" />
    <circle cx="50" cy="40" r="12" fill="#A7F3D0" stroke="#10B981" strokeWidth="1.5" />
    <ellipse cx="40" cy="40" rx="7" ry="12" fill="#10B981" opacity="0.5" />
    <path d="M37 40l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="58" cy="24" r="8" fill="#10B981" />
    <path d="M55 24l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// SVG 插图 - S-03: 开始规划
const IllustrationPlan: React.FC = () => (
  <svg width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="20" fill="#FEF3C7" />
    <path d="M20 60 Q30 30 40 40 Q50 50 60 20" stroke="#D97706" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <circle cx="20" cy="60" r="4" fill="#D97706" />
    <circle cx="40" cy="40" r="4" fill="#D97706" />
    <circle cx="60" cy="20" r="6" fill="#D97706" />
    <path d="M57 17l3 3-3 3M60 20h-8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="26" y="50" width="28" height="14" rx="4" fill="#FBBF24" opacity="0.7" />
    <rect x="30" y="54" width="12" height="2" rx="1" fill="#92400E" opacity="0.6" />
    <rect x="30" y="58" width="20" height="2" rx="1" fill="#92400E" opacity="0.4" />
  </svg>
)

const onboardingSteps = [
  {
    illustration: <IllustrationUpload />,
    title: '上传简历\n一键解析',
    subtitle: '支持 PDF / DOCX，系统自动提取\n教育、技能、经历、证书等信息',
  },
  {
    illustration: <IllustrationMatch />,
    title: '智能匹配\n真实岗位',
    subtitle: '基于 9958 条真实招聘数据\n从胜任力、潜力、技能多维度评分',
  },
  {
    illustration: <IllustrationPlan />,
    title: '规划路径\n导出报告',
    subtitle: '职业路径图谱可视化\n支持导出 PDF / DOCX 报告',
  },
]

const OnboardingFlow: React.FC = () => {
  const navigate = useNavigate()
  const { bootstrapSession, clearSession, currentStudent, hasProfile, profile } = useMobileApp()

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [account, setAccount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const existingDestination = currentStudent ? (hasProfile || profile ? '/profile' : '/upload') : '/upload'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = inferAccountPayload(account)
    if (!payload.email && !payload.phone) {
      setError('请输入邮箱或手机号，用于创建或找回学生会话。')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const result = await bootstrapSession({
        ...payload,
        name: name.trim() || undefined,
      })
      navigate(result.hasProfile ? '/profile' : '/upload', { replace: true })
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '登录失败，请稍后重试'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="onboarding-container">
      {/* Skip button - always visible on intro screens */}
      {step < 3 && (
        <button className="onboarding-skip-top pressable" onClick={() => setStep(3)}>
          跳过引导
        </button>
      )}

      {/* Intro screens: 0, 1, 2 */}
      {step < 3 && (
        <div className="onboarding-step">
          {/* Progress dots */}
          <div className="onboarding-dots">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`dot ${i === step ? 'active' : ''}`} />
            ))}
          </div>

          {/* Illustration */}
          <div className="onboarding-illustration">
            {onboardingSteps[step].illustration}
          </div>

          {/* Text */}
          <div className="onboarding-title">{onboardingSteps[step].title}</div>
          <div className="onboarding-subtitle">{onboardingSteps[step].subtitle}</div>

          {/* Primary button */}
          <button
            type="button"
            className="onboarding-primary-btn pressable"
            onClick={() => setStep(step < 2 ? step + 1 : 3)}
          >
            {step < 2 ? '下一步' : '开始使用'}
          </button>
        </div>
      )}

      {/* Login screen: step 3 */}
      {step === 3 && (
        <div className="onboarding-step" style={{ width: '100%' }}>
          <div style={{ textAlign: 'left', width: '100%', marginBottom: 18 }}>
            <div className="onboarding-title" style={{ textAlign: 'left', fontSize: 18, marginBottom: 4 }}>
              登录 / 注册
            </div>
            <div className="onboarding-subtitle" style={{ textAlign: 'left', marginBottom: 0 }}>
              输入邮箱或手机号，创建或找回你的学生档案
            </div>
          </div>

          {/* Existing session card */}
          {currentStudent && (
            <div
              style={{
                width: '100%',
                marginBottom: 14,
                padding: '10px 12px',
                borderRadius: 9,
                background: '#EEF2FF',
                border: '0.5px solid #C7D2FE',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: '#1e3a8a', marginBottom: 4 }}>
                已恢复学生会话
              </div>
              <div style={{ fontSize: 9, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
                {currentStudent.name || '未命名同学'} · {currentStudent.email}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="onboarding-primary-btn pressable"
                  style={{ flex: 1 }}
                  onClick={() => navigate(existingDestination)}
                >
                  继续使用
                </button>
                <button
                  type="button"
                  className="onboarding-secondary-btn pressable"
                  style={{ flex: 1 }}
                  onClick={clearSession}
                >
                  切换账号
                </button>
              </div>
            </div>
          )}

          <form className="onboarding-form" onSubmit={handleSubmit}>
            <div style={{ marginBottom: 10 }}>
              <label className="onboarding-label">昵称（可选）</label>
              <input
                className="onboarding-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：张同学"
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label className="onboarding-label">邮箱 / 手机号 *</label>
              <input
                className="onboarding-input"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="student@example.com 或 13800000000"
              />
            </div>

            {error && (
              <div
                style={{
                  marginBottom: 10,
                  padding: '7px 10px',
                  borderRadius: 7,
                  background: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: 9,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="onboarding-primary-btn pressable"
              disabled={submitting}
              style={{ opacity: submitting ? 0.8 : 1 }}
            >
              {submitting ? '正在创建学生会话...' : '登录 / 注册学生端'}
            </button>
          </form>

          <div className="onboarding-divider">
            <div className="onboarding-divider-line" />
            <span className="onboarding-divider-text">或</span>
            <div className="onboarding-divider-line" />
          </div>

          <button
            type="button"
            className="onboarding-secondary-btn pressable"
            onClick={() => setStep(0)}
          >
            重新查看引导
          </button>
        </div>
      )}
    </div>
  )
}

export default OnboardingFlow
