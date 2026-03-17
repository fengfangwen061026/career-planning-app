import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileShell from '../components/MobileShell'
import EmptyState from '../components/EmptyState'
import './EmptyStatePage.css'

type TabType = 'explore' | 'profile' | 'report'

const EmptyStatePage: React.FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('profile')

  const handleNavigate = () => {
    navigate('/upload')
  }

  return (
    <MobileShell hasTabBar activeTab={activeTab}>
      <div className="empty-state-page">
        <div className="tab-selector">
          <button
            className={`tab-btn ${activeTab === 'explore' ? 'active' : ''}`}
            onClick={() => setActiveTab('explore')}
          >
            探索
          </button>
          <button
            className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            画像
          </button>
          <button
            className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
            onClick={() => setActiveTab('report')}
          >
            报告
          </button>
        </div>

        <div className="empty-state-container">
          <EmptyState type={activeTab} onNavigate={handleNavigate} />
        </div>
      </div>
    </MobileShell>
  )
}

export default EmptyStatePage
