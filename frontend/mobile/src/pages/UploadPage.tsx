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
        style={{ background: 'linear-gradient(135deg, #F8F9FF 0%, #F0F4FF 50%, #F8FFF8 100%)' }}
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

        {/* Manual fill link */}
        <span
          onClick={() => navigate('/chat-fill')}
          style={{
            fontSize: 12, color: '#4F46E5', cursor: 'pointer',
            textDecoration: 'none', background: 'none', border: 'none',
          }}
        >
          手动填写基本信息 →
        </span>
      </div>
    </MobileShell>
  )
}

export default UploadPage
