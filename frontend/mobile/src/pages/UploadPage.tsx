import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import MobileShell from '../components/MobileShell'
import { useMobileApp } from '../context/MobileAppContext'
import './UploadPage.css'

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
    if (!file) {
      return
    }

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
        style={{
          padding: '20px 18px 110px',
          background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 45%)',
          minHeight: '100%',
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
          上传简历
        </div>
        <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.7, marginTop: 10 }}>
          {currentStudent
            ? `当前学生：${currentStudent.name || '未命名同学'}。上传后会自动完成解析、画像生成和后续推荐刷新。`
            : '请先创建学生会话。'}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          hidden
          onChange={handleFileSelected}
        />

        <button
          type="button"
          onClick={openPicker}
          disabled={submitting}
          style={{
            width: '100%',
            marginTop: 20,
            borderRadius: 28,
            border: '1px dashed #93c5fd',
            background: '#eef6ff',
            padding: '28px 18px',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 18,
              display: 'grid',
              placeItems: 'center',
              background: '#dbeafe',
              color: '#1d4ed8',
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            上
          </div>
          <div style={{ marginTop: 16, fontWeight: 800, color: '#0f172a', fontSize: 18 }}>
            {submitting ? '正在启动上传...' : '选择 PDF / Word 简历'}
          </div>
          <div style={{ marginTop: 8, color: '#475569', fontSize: 13, lineHeight: 1.7 }}>
            直接调用 `/api/students/{'{student_id}'}/upload-resume/stream`
            <br />
            支持 fallback、retrying、complete 全链路状态。
          </div>
        </button>

        {error && (
          <div
            style={{
              marginTop: 14,
              borderRadius: 18,
              padding: '14px 16px',
              background: '#fef2f2',
              color: '#b91c1c',
              lineHeight: 1.6,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            borderRadius: 24,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            padding: 18,
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.05)',
          }}
        >
          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>上传后会自动识别</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {['教育经历', '技能与工具', '项目与实习', '证书与奖项', '软技能证据', '缺失补全建议'].map((item) => (
              <div
                key={item}
                style={{
                  borderRadius: 16,
                  padding: '12px 14px',
                  background: '#f8fafc',
                  color: '#334155',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            borderRadius: 24,
            padding: 18,
            background: profile ? '#ecfdf5' : '#fff7ed',
            border: `1px solid ${profile ? '#bbf7d0' : '#fed7aa'}`,
          }}
        >
          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
            {profile ? '已经存在一份学生画像' : '首次使用建议先上传简历'}
          </div>
          <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.7 }}>
            {profile
              ? '重新上传会基于最新简历重建画像，推荐与报告也会随之刷新。'
              : '如果现在没有简历，也可以先去画像页查看当前状态，再决定是否补充内容。'}
          </div>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            style={{
              marginTop: 12,
              border: 'none',
              borderRadius: 14,
              padding: '12px 14px',
              background: '#0f172a',
              color: '#ffffff',
              fontWeight: 700,
            }}
          >
            前往画像页
          </button>
        </div>
      </div>
    </MobileShell>
  )
}

export default UploadPage
