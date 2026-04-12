import { useNavigate } from 'react-router-dom'

interface EmptyStateProps {
  type?: 'explore' | 'profile' | 'report'
  title?: string
  desc?: string
}

const CONFIG = {
  explore: {
    title: '还没有匹配结果',
    desc: '上传简历后，AI 将自动匹配最适合你的岗位',
    icon: (
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ marginBottom: 12 }}>
        <rect width="56" height="56" rx="14" fill="#F3F4F6"/>
        <circle cx="25" cy="23" r="10" fill="none" stroke="#D1D5DB" strokeWidth="2"/>
        <path d="M32 30l8 8" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M20 23h10M25 18v10" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  profile: {
    title: '暂无画像数据',
    desc: '上传简历后，AI 将为你生成专属学生画像',
    icon: (
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ marginBottom: 12 }}>
        <rect width="56" height="56" rx="14" fill="#F3F4F6"/>
        <circle cx="28" cy="22" r="9" fill="none" stroke="#D1D5DB" strokeWidth="2"/>
        <path d="M12 46c0-8.8 7.2-16 16-16s16 7.2 16 16" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },
  report: {
    title: '尚未生成报告',
    desc: '完成岗位匹配后，可生成完整的职业规划报告',
    icon: (
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ marginBottom: 12 }}>
        <rect width="56" height="56" rx="14" fill="#F3F4F6"/>
        <rect x="14" y="12" width="28" height="32" rx="4" fill="none" stroke="#D1D5DB" strokeWidth="2"/>
        <path d="M20 22h16M20 28h12M20 34h8" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
}

export default function EmptyState({ type = 'explore', title, desc }: EmptyStateProps) {
  const navigate = useNavigate()
  const cfg = CONFIG[type]

  return (
    <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center' }}>
      {cfg.icon}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0A0A0A', marginBottom: 6 }}>{title || cfg.title}</div>
      <div style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.7, marginBottom: 16 }}>{desc || cfg.desc}</div>
      <button
        onClick={() => navigate('/upload')}
        style={{
          padding: '8px 20px', background: '#4F46E5', color: 'white',
          border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
        }}
      >
        去上传简历
      </button>
    </div>
  )
}
