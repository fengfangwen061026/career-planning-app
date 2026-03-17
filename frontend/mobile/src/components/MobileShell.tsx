import React from 'react'
import './MobileShell.css'
import TabBar from './TabBar'

interface MobileShellProps {
  children: React.ReactNode
  hasTabBar?: boolean
  activeTab?: 'upload' | 'profile' | 'explore' | 'report'
}

const MobileShell: React.FC<MobileShellProps> = ({
  children,
  hasTabBar = false,
  activeTab = 'upload'
}) => {
  return (
    <div className="mobile-shell-wrapper">
      <div className="mobile-shell-container">
        <div className="mobile-shell-content">
          {children}
        </div>
        {hasTabBar && <TabBar activeTab={activeTab} />}
      </div>
    </div>
  )
}

export default MobileShell
