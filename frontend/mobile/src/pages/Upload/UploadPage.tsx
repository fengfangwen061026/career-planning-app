import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TabBar from '../../components/TabBar/TabBar'

export default function UploadPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = (file: File) => {
    setSelectedFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    // TODO: call API /api/students/{id}/resume/upload
    setTimeout(() => navigate('/parsing'), 800)
  }

  return (
    <>
      {/* 固定白色顶部 header */}
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

      {/* 滚动内容区 */}
      <div className="scroll-body" style={{ padding: '10px 10px 12px' }}>
        {/* 拖���区 */}
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
            <rect width="32" height="32" rx="8" fill="#EEF2FF"/>
            <path d="M16 10v10M11 15l5-5 5 5" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 22h12" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round"/>
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
                onClick={handleUpload}
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
                PDF / DOCX · 最大 10MB
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
            accept=".pdf,.docx"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        {/* 分隔线 */}
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

        {/* 解析内容展示卡 */}
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
