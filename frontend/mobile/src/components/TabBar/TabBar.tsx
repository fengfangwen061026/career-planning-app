import { useNavigate } from 'react-router-dom'
import './TabBar.css'

const tabs = [
  {
    key: 'upload',
    label: '上传',
    path: '/upload',
    icon: (
      <svg viewBox="0 0 18 18" fill="none">
        <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M6 6h6M6 9h6M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'profile',
    label: '画像',
    path: '/profile',
    icon: (
      <svg viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 15c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'explore',
    label: '探索',
    path: '/explore',
    icon: (
      <svg viewBox="0 0 18 18" fill="none">
        <circle cx="7.5" cy="7.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M13.5 13.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'report',
    label: '报告',
    path: '/report',
    icon: (
      <svg viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 7h8M5 10h6M5 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

interface TabBarProps {
  active: 'upload' | 'profile' | 'explore' | 'report'
}

export default function TabBar({ active }: TabBarProps) {
  const navigate = useNavigate()
  return (
    <div className="tabbar">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`tabbar-item ${active === tab.key ? 'active' : ''}`}
          onClick={() => navigate(tab.path)}
        >
          <span className="tabbar-icon">{tab.icon}</span>
          <span className="tabbar-label">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
