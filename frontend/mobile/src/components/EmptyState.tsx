import React from 'react'
import './EmptyState.css'

interface EmptyStateProps {
  type: 'explore' | 'profile' | 'report'
  onNavigate: () => void
}

const EmptyState: React.FC<EmptyStateProps> = ({ type, onNavigate }) => {
  const renderIcon = () => {
    switch (type) {
      case 'explore':
        return (
          <svg width="56" height="56" viewBox="0 0 56 56">
            <rect width="56" height="56" rx="14" fill="var(--color-background-tertiary)" />
            <circle cx="25" cy="23" r="10" stroke="var(--color-border-primary)" strokeWidth="2" fill="none" />
            <path d="M32 30l8 8" stroke="var(--color-border-primary)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M20 23h10" stroke="var(--color-border-primary)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M25 18v10" stroke="var(--color-border-primary)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )
      case 'profile':
        return (
          <svg width="56" height="56" viewBox="0 0 56 56">
            <rect width="56" height="56" rx="14" fill="var(--color-background-tertiary)" />
            <circle cx="28" cy="20" r="7" stroke="var(--color-border-primary)" strokeWidth="2" fill="none" />
            <path d="M14 42c0-7.7 6.3-14 14-14s14 6.3 14 14" stroke="var(--color-border-primary)" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        )
      case 'report':
        return (
          <svg width="56" height="56" viewBox="0 0 56 56">
            <rect width="56" height="56" rx="14" fill="var(--color-background-tertiary)" />
            <rect x="14" y="10" width="28" height="36" rx="4" stroke="var(--color-border-primary)" strokeWidth="2" fill="none" />
            <path d="M20 20h16" stroke="var(--color-border-primary)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M20 27h16" stroke="var(--color-border-primary)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M20 34h10" stroke="var(--color-border-primary)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )
    }
  }

  const getDescription = () => {
    switch (type) {
      case 'explore':
        return '上传简历后，我们会为你\n推荐最匹配的岗位'
      case 'profile':
        return '上传简历后，\n我们会为你生成专属画像'
      case 'report':
        return '完成匹配后，\n可以在这里查看职业规划报告'
    }
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {renderIcon()}
      </div>
      <h3 className="empty-state-title">还没有简历</h3>
      <p className="empty-state-description">{getDescription()}</p>
      <button className="empty-state-button" onClick={onNavigate}>
        去上传简历
      </button>
    </div>
  )
}

export default EmptyState
