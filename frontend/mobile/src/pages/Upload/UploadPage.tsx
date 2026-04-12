import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import TabBar from '../../components/TabBar/TabBar'
import { session } from '../../store/session'

interface UploadEvent {
  type?: string
  stage?: string
  progress?: number
  message?: string
  data?: {
    resume?: {
      id?: string
    }
  }
}

export default function UploadPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStage, setUploadStage] = useState('')
  const [uploadError, setUploadError] = useState('')

  const handleFile = (file: File) => {
    setSelectedFile(file)
    setUploadError('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      return
    }

    const studentId = session.getStudentId()
    if (!studentId) {
      navigate('/onboarding')
      return
    }

    setUploading(true)
    setUploadError('')
    setUploadProgress(5)
    setUploadStage('正在上传文件...')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch(`/api/students/${studentId}/upload-resume/stream`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok || !res.body) {
        throw new Error('网络连接失败，请检查网络后重试')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let resumeId: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) {
            continue
          }

          const raw = line.slice(6).trim()
          if (!raw) {
            continue
          }

          try {
            const event = JSON.parse(raw) as UploadEvent

            if (event.type === 'stage') {
              setUploadProgress(Number(event.progress) || 30)
              const stageLabels: Record<string, string> = {
                extracting: '正在读取文件内容...',
                parsing: '正在 AI 解析简历...',
              }
              setUploadStage(stageLabels[event.stage || ''] || '处理中...')
            }

            if (event.type === 'fallback') {
              setUploadProgress(Number(event.progress) || 72)
              setUploadStage('解析完成（快速模式）')
            }

            if (event.type === 'complete') {
              setUploadProgress(100)
              setUploadStage('解析完成！')
              resumeId = event.data?.resume?.id || null
              if (resumeId) {
                session.setResumeId(resumeId)
              }

              if (resumeId) {
                try {
                  await fetch(`/api/students/${studentId}/profile/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ resume_id: resumeId }),
                  })
                  session.setHasProfile(true)
                } catch {
                  // profile 生成失败不阻断后续流程
                }
              }

              window.setTimeout(() => navigate('/parsing'), 400)
            }

            if (event.type === 'error') {
              throw new Error(event.message || '上传失败，请重试')
            }
          } catch (parseErr) {
            if (parseErr instanceof Error) {
              throw parseErr
            }
          }
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '上传失败，请重试'
      setUploadError(message)
      setUploading(false)
      return
    }

    setUploading(false)
  }

  return (
    <>
      <div style={{
        padding: '10px 10px 8px',
        background: 'white',
        borderBottom: '0.5px solid #E5E7EB',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.5px', color: '#0A0A0A' }}>
          上传简历
        </div>
        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 3 }}>
          AI 自动解析，生成你的职业画像
        </div>
      </div>

      <div className="scroll-body" style={{ padding: '10px 10px 12px' }}>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `1.5px dashed ${dragging ? '#4F46E5' : '#D1D5DB'}`,
            borderRadius: 10,
            padding: '24px 12px',
            textAlign: 'center',
            marginBottom: 10,
            background: dragging ? '#EEF2FF' : 'white',
            transition: 'all 0.15s',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" style={{ margin: '0 auto 8px', display: 'block' }} fill="none">
            <rect width="32" height="32" rx="8" fill="#EEF2FF" />
            <path d="M16 10v10M11 15l5-5 5 5" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 22h12" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {selectedFile ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0A0A0A', marginBottom: 3 }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 10 }}>
                {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
              </div>
              <button
                onClick={() => { void handleUpload() }}
                disabled={uploading}
                style={{
                  padding: '6px 18px', background: uploading ? '#9CA3AF' : '#4F46E5',
                  color: '#fff', border: 'none', borderRadius: 7,
                  fontSize: 10, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer',
                }}
              >
                {uploading ? '上传中…' : '开始解析'}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0A0A0A', marginBottom: 3 }}>
                点击或拖拽上传
              </div>
              <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 10 }}>
                PDF / DOC / DOCX · 最大 5MB
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '6px 18px', background: '#4F46E5',
                  color: '#fff', border: 'none', borderRadius: 7,
                  fontSize: 10, fontWeight: 700, cursor: 'pointer',
                }}
              >
                选择文件
              </button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          {uploading && (
            <div style={{ marginTop: 12 }}>
              <div style={{ height: 4, background: '#E5E7EB', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#4F46E5', borderRadius: 999, transition: 'width 0.25s ease' }} />
              </div>
              <div style={{ fontSize: 9, color: '#6B7280', marginTop: 6 }}>
                {uploadStage}
              </div>
            </div>
          )}

          {uploadError && (
            <div style={{ fontSize: 9, color: '#EF4444', marginTop: 8 }}>
              {uploadError}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, height: '0.5px', background: '#E5E7EB' }} />
          <div style={{ fontSize: 9, color: '#9CA3AF' }}>或</div>
          <div style={{ flex: 1, height: '0.5px', background: '#E5E7EB' }} />
        </div>
        <div
          onClick={() => navigate('/chat-fill')}
          style={{ textAlign: 'center', fontSize: 10, color: '#4F46E5', fontWeight: 600, marginBottom: 14, cursor: 'pointer' }}
        >
          手动填写基本信息 →
        </div>

        <div className="card">
          <div className="card-hd">
            <div className="card-hd-bar" style={{ background: '#4F46E5' }} />
            将自动解析以下内容
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 7px', background: '#EFF6FF', borderRadius: 7 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1D4ED8', flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: '#1D4ED8', fontWeight: 500 }}>教育经历</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 7px', background: '#EFF6FF', borderRadius: 7 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1D4ED8', flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: '#1D4ED8', fontWeight: 500 }}>技能 &amp; 工具</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 7px', background: '#D1FAE5', borderRadius: 7 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: '#065F46', fontWeight: 500 }}>实习 &amp; 项目</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 7px', background: '#D1FAE5', borderRadius: 7 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: '#065F46', fontWeight: 500 }}>证书 &amp; 奖项</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 7px', background: '#FEF3C7', borderRadius: 7, gridColumn: '1 / -1' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D97706', flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: '#92400E', fontWeight: 500 }}>软素养信号 &amp; 量化成果</span>
            </div>
          </div>
        </div>
      </div>
      <TabBar active="upload" />
    </>
  )
}
