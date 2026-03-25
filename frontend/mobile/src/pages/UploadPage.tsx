import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import MobileShell from '../components/MobileShell'
import { useMobileApp } from '../context/MobileAppContext'
import './UploadPage.css'

const previewItems = [
  { label: '教育经历', color: 'blue' },
  { label: '技能与工具', color: 'blue' },
  { label: '项目与实习', color: 'green' },
  { label: '证书与奖项', color: 'green' },
  { label: '软技能证据', color: 'orange' },
  { label: '缺失补全建议', color: 'orange' },
]

const UploadPage: React.FC = () => {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { startResumeUpload, resetUploadState, currentStudent, profile } = useMobileApp()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function openPicker() {
    inputRef.current?.click()
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setSubmitting(true)
    setError('')
    resetUploadState()
    navigate('/parsing')

    try {
      await startResumeUpload(file)
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : '上传失败，请稍后重试'
      setError(message)
    } finally {
      setSubmitting(false)
      event.target.value = ''
    }
  }

  return (
    <MobileShell hasTabBar activeTab="upload">
      <div
        className="upload-page toolbar-anim"
        style={{ background: 'linear-gradient(135deg, #F8F9FF 0%, #F0F4FF 50%, #F8FFF8 100%)', paddingBottom: 100 }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          hidden
          onChange={handleFileSelected}
        />

        {/* Upload zone */}
        <button
          type="button"
          className="upload-zone pressable"
          onClick={openPicker}
          disabled={submitting}
        >
          <div className="upload-icon">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="#EEF2FF" />
              <path d="M18 24V14M18 14l-4 4M18 14l4 4" stroke="#4F46E5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 26h16" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            </svg>
          </div>
          <p className="upload-main-text">
            {submitting ? '正在启动上传...' : '点击或拖拽上传'}
          </p>
          <p className="upload-hint-text">PDF / DOCX · 最大 10MB</p>
          {!submitting && (
            <span className="upload-select-btn">选择文件</span>
          )}
        </button>

        {error && (
          <div
            style={{
              marginTop: 8,
              borderRadius: 9,
              padding: '8px 10px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: 10,
              lineHeight: 1.6,
            }}
          >
            {error}
          </div>
        )}

        {/* Divider */}
        <div className="upload-divider">
          <div className="upload-divider-line" />
          <span className="upload-divider-text">或</span>
          <div className="upload-divider-line" />
        </div>

        {/* Manual fill link */}
        <button
          type="button"
          className="upload-manual-link pressable"
          onClick={() => navigate('/chat-fill')}
        >
          手动填写基本信息 →
        </button>

        {/* Preview card */}
        <div className="upload-preview-card card-bounce" style={{ '--ci': 0 } as React.CSSProperties}>
          <div className="preview-card-header">
            <div className="preview-card-indicator" />
            <span className="preview-card-title">上传后自动识别</span>
          </div>
          <div className="preview-grid">
            {previewItems.map((item) => (
              <div key={item.label} className={`preview-item preview-item-${item.color}`}>
                <div className="preview-item-dot" />
                <span className="preview-item-text">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Profile status hint */}
        <div
          className="upload-preview-card card-bounce"
          style={{
            '--ci': 1,
            marginTop: 8,
            background: profile ? '#ecfdf5' : '#fff7ed',
            borderColor: profile ? '#bbf7d0' : '#fed7aa',
          } as React.CSSProperties}
        >
          <div className="preview-card-header">
            <div
              className="preview-card-indicator"
              style={{ background: profile ? '#10B981' : '#D97706' }}
            />
            <span className="preview-card-title">
              {profile ? '已有学生画像' : '首次使用'}
            </span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', lineHeight: 1.6, marginBottom: 8 }}>
            {profile
              ? '重新上传会基于最新简历重建画像，推荐与报告也会随之刷新。'
              : `${currentStudent?.name ? `${currentStudent.name}，` : ''}如果现在没有简历，可以先去画像页查看当前状态。`}
          </div>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="upload-select-btn pressable"
            style={{ background: profile ? '#10B981' : 'var(--color-warning)' }}
          >
            前往画像页
          </button>
        </div>
      </div>
    </MobileShell>
  )
}

export default UploadPage
