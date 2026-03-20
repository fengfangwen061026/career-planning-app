import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useMobileApp } from '../context/MobileAppContext'
import './OnboardingFlow.css'

function inferAccountPayload(account: string) {
  const value = account.trim()
  if (!value) {
    return {}
  }
  if (value.includes('@')) {
    return { email: value.toLowerCase() }
  }
  return { phone: value }
}

const featureCards = [
  {
    title: '真实简历解析',
    description: '直接走后端流式解析接口，支持失败兜底与自动重试。',
  },
  {
    title: '真实岗位推荐',
    description: '推荐、匹配详情、职业路径全部来自当前后端服务。',
  },
  {
    title: '真实报告导出',
    description: '支持读取历史报告并导出 PDF / DOCX。',
  },
]

const OnboardingFlow: React.FC = () => {
  const navigate = useNavigate()
  const { bootstrapSession, clearSession, currentStudent, hasProfile, profile } = useMobileApp()

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
    <div
      style={{
        minHeight: '100vh',
        padding: '24px 18px 28px',
        background:
          'radial-gradient(circle at top left, rgba(79,70,229,0.15), transparent 35%), linear-gradient(180deg, #f4f7ff 0%, #ffffff 55%)',
      }}
    >
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <div
          style={{
            borderRadius: 28,
            padding: 24,
            background: '#ffffff',
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.08)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
              color: '#ffffff',
              fontSize: 24,
              fontWeight: 700,
              marginBottom: 18,
            }}
          >
            学
          </div>

          <div style={{ fontSize: 30, lineHeight: 1.15, fontWeight: 800, color: '#0f172a' }}>
            大学生职业规划
            <br />
            学生端
          </div>
          <p style={{ marginTop: 12, marginBottom: 0, color: '#475569', lineHeight: 1.6, fontSize: 14 }}>
            输入邮箱或手机号，我们会创建或找回你的学生档案。后续上传简历后，就能直接看到真实画像、岗位推荐和职业报告。
          </p>

          {currentStudent && (
            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 18,
                background: '#eef4ff',
                border: '1px solid #c7d2fe',
              }}
            >
              <div style={{ fontWeight: 700, color: '#1e3a8a', marginBottom: 6 }}>当前已恢复学生会话</div>
              <div style={{ color: '#334155', fontSize: 13, lineHeight: 1.6 }}>
                {currentStudent.name || '未命名同学'}
                {' · '}
                {currentStudent.email}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => navigate(existingDestination)}
                  style={{
                    flex: 1,
                    border: 'none',
                    borderRadius: 14,
                    padding: '12px 14px',
                    background: '#1d4ed8',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                >
                  继续使用
                </button>
                <button
                  type="button"
                  onClick={clearSession}
                  style={{
                    flex: 1,
                    borderRadius: 14,
                    padding: '12px 14px',
                    background: '#ffffff',
                    color: '#334155',
                    fontWeight: 700,
                    border: '1px solid #cbd5e1',
                  }}
                >
                  切换账号
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ marginTop: 22, display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>昵称</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：张同学"
                style={{
                  borderRadius: 16,
                  border: '1px solid #dbe3f0',
                  padding: '14px 16px',
                  fontSize: 15,
                  outline: 'none',
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>邮箱 / 手机号</span>
              <input
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="例如：student@example.com 或 13800000000"
                style={{
                  borderRadius: 16,
                  border: '1px solid #dbe3f0',
                  padding: '14px 16px',
                  fontSize: 15,
                  outline: 'none',
                }}
              />
            </label>

            {error && (
              <div
                style={{
                  borderRadius: 14,
                  padding: '12px 14px',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 4,
                border: 'none',
                borderRadius: 16,
                padding: '14px 16px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 15,
                opacity: submitting ? 0.8 : 1,
              }}
            >
              {submitting ? '正在创建学生会话...' : '登录 / 注册学生端'}
            </button>
          </form>
        </div>

        <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
          {featureCards.map((card) => (
            <div
              key={card.title}
              style={{
                borderRadius: 22,
                padding: 18,
                background: 'rgba(255,255,255,0.78)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(148, 163, 184, 0.16)',
              }}
            >
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{card.title}</div>
              <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.6 }}>{card.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default OnboardingFlow
