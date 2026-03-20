import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import MobileShell from '../components/MobileShell'
import { useMobileApp } from '../context/MobileAppContext'
import './ParsingPage.css'

const progressSteps = [
  { key: 'queued', label: '上传文件' },
  { key: 'extracting', label: '提取简历文本' },
  { key: 'parsing', label: 'AI 解析结构化信息' },
  { key: 'retrying', label: '失败兜底与重试' },
  { key: 'complete', label: '生成学生画像' },
]

const ParsingPage: React.FC = () => {
  const navigate = useNavigate()
  const { uploadState, profile } = useMobileApp()
  const progressDegrees = Math.min(360, Math.max(0, uploadState.progress * 3.6))

  useEffect(() => {
    if (uploadState.status === 'completed' && profile) {
      const timer = window.setTimeout(() => {
        navigate('/profile', { replace: true, state: { justUpdated: true } })
      }, 900)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [navigate, profile, uploadState.status])

  const activeIndex = progressSteps.findIndex((step) => step.key === uploadState.stage)
  const normalizedActiveIndex = activeIndex >= 0 ? activeIndex : 0

  return (
    <MobileShell hasTabBar={false}>
      <div
        style={{
          minHeight: '100%',
          padding: '26px 20px 34px',
          background: 'linear-gradient(180deg, #f6f8ff 0%, #ffffff 60%)',
        }}
      >
        <div
          style={{
            borderRadius: 28,
            padding: 22,
            background: '#ffffff',
            border: '1px solid rgba(99, 102, 241, 0.12)',
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.07)',
          }}
        >
          <div
            style={{
              width: 92,
              height: 92,
              margin: '0 auto',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: `conic-gradient(#4f46e5 0deg, #2563eb ${progressDegrees}deg, #dbeafe ${progressDegrees}deg, #dbeafe 360deg)`,
              position: 'relative',
            }}
          >
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: '50%',
                background: '#ffffff',
                display: 'grid',
                placeItems: 'center',
                color: '#1d4ed8',
                fontSize: 18,
                fontWeight: 800,
              }}
            >
              {Math.round(uploadState.progress)}%
            </div>
          </div>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>正在解析你的简历</div>
            <div style={{ marginTop: 10, color: '#475569', lineHeight: 1.7, fontSize: 14 }}>
              {uploadState.message}
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
            {progressSteps.map((step, index) => {
              const completed = index < normalizedActiveIndex || uploadState.status === 'completed'
              const active = index === normalizedActiveIndex && uploadState.status === 'uploading'
              return (
                <div
                  key={step.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 16,
                    background: active ? '#eef2ff' : '#f8fafc',
                    border: `1px solid ${active ? '#c7d2fe' : '#e2e8f0'}`,
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      background: completed ? '#10b981' : active ? '#4f46e5' : '#e2e8f0',
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {completed ? '✓' : index + 1}
                  </div>
                  <div style={{ color: '#0f172a', fontWeight: active ? 800 : 600, fontSize: 14 }}>{step.label}</div>
                </div>
              )
            })}
          </div>

          {(uploadState.isFallback || uploadState.retrying) && (
            <div
              style={{
                marginTop: 18,
                borderRadius: 18,
                padding: '14px 16px',
                background: '#fff7ed',
                border: '1px solid #fdba74',
                color: '#9a3412',
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              当前正在走降级链路：页面会先展示可用兜底结果，随后继续自动重试 AI 解析，不需要你重复上传。
            </div>
          )}

          {uploadState.status === 'error' && (
            <div
              style={{
                marginTop: 18,
                borderRadius: 18,
                padding: '14px 16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 6 }}>解析失败</div>
              <div>{uploadState.error || uploadState.message}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => navigate('/upload', { replace: true })}
                  style={{
                    flex: 1,
                    border: 'none',
                    borderRadius: 14,
                    padding: '12px 14px',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                >
                  重新上传
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/profile', { replace: true })}
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
                  返回画像页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  )
}

export default ParsingPage
