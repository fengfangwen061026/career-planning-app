import React from 'react'
import { useNavigate } from 'react-router-dom'
import MobileShell from '../components/MobileShell'
import './UploadPage.css'

const UploadPage: React.FC = () => {
  const navigate = useNavigate()

  const handleUploadClick = () => {
    navigate('/parsing')
  }

  return (
    <MobileShell hasTabBar activeTab="upload">
      <div className="upload-page">
        {/* 上传拖拽区 */}
        <div className="upload-zone" onClick={handleUploadClick}>
          <div className="upload-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#EEF2FF"/>
              <path d="M16 10v10M11 15l5-5 5 5" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 22h12" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="upload-main-text">点击或拖拽上传</p>
          <p className="upload-hint-text">PDF / DOCX · 最大 10MB</p>
          <button className="upload-select-btn" onClick={(e) => { e.stopPropagation(); handleUploadClick() }}>
            选择文件
          </button>
        </div>

        {/* 分隔线 */}
        <div className="upload-divider">
          <div className="upload-divider-line" />
          <span className="upload-divider-text">或</span>
          <div className="upload-divider-line" />
        </div>

        {/* 手动填写链接 */}
        <a className="upload-manual-link" onClick={() => navigate('/profile')}>
          手动填写基本信息 →
        </a>

        {/* 解析内容展示卡片 */}
        <div className="upload-preview-card">
          <div className="preview-card-header">
            <span className="preview-card-indicator" />
            <span className="preview-card-title">将自动解析以下内容</span>
          </div>
          <div className="preview-grid">
            <div className="preview-item preview-item-blue">
              <span className="preview-item-dot" />
              <span className="preview-item-text">教育经历</span>
            </div>
            <div className="preview-item preview-item-blue">
              <span className="preview-item-dot" />
              <span className="preview-item-text">技能 & 工具</span>
            </div>
            <div className="preview-item preview-item-green">
              <span className="preview-item-dot" />
              <span className="preview-item-text">实习 & 项目</span>
            </div>
            <div className="preview-item preview-item-green">
              <span className="preview-item-dot" />
              <span className="preview-item-text">证书 & 奖项</span>
            </div>
            <div className="preview-item preview-item-orange preview-item-full">
              <span className="preview-item-dot" />
              <span className="preview-item-text">软素养信号 & 量化成果</span>
            </div>
          </div>
        </div>
      </div>
    </MobileShell>
  )
}

export default UploadPage
