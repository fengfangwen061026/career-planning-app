import React from 'react'
import { useNavigate } from 'react-router-dom'

import './TabBar.css'

interface TabBarProps {
  activeTab: 'upload' | 'profile' | 'explore' | 'report'
}

const tabs = [
  {
    key: 'upload',
    label: '上传',
    path: '/upload',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" strokeWidth="1.5" strokeLinecap="round">
        <rect x="3" y="2" width="12" height="14" rx="2" />
        <line x1="5" y1="6" x2="13" y2="6" />
        <line x1="5" y1="10" x2="13" y2="10" />
        <line x1="5" y1="14" x2="10" y2="14" />
      </svg>
    ),
  },
  {
    key: 'profile',
    label: '画像',
    path: '/profile',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="9" cy="6" r="3" />
        <path d="M3 18c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
    ),
  },
  {
    key: 'explore',
    label: '探索',
    path: '/explore',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="7.5" cy="7.5" r="4.5" />
        <line x1="13.5" y1="13.5" x2="16" y2="16" />
      </svg>
    ),
  },
  {
    key: 'report',
    label: '报告',
    path: '/report',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" strokeWidth="1.5" strokeLinecap="round">
        <rect x="2" y="2" width="14" height="14" rx="2" />
        <line x1="4" y1="6" x2="14" y2="6" />
        <line x1="4" y1="10" x2="14" y2="10" />
        <line x1="4" y1="14" x2="10" y2="14" />
      </svg>
    ),
  },
] as const

const TabBar: React.FC<TabBarProps> = ({ activeTab }) => {
  const navigate = useNavigate()

  return (
    <div className="tab-bar">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key
        return (
          <button
            key={tab.key}
            className={`tab-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default TabBar
