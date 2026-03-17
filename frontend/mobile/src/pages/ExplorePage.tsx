import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileShell from '../components/MobileShell'
import './ExplorePage.css'

interface JobDim {
  label: string
  score: number
  color: string
}

interface JobTag {
  text: string
  bg: string
  color: string
}

interface Job {
  id: string
  name: string
  icon: string
  iconColor: string
  industry: string
  level: string
  city: string
  score: number
  scoreColor: string
  tags?: JobTag[]
  dims: JobDim[]
}

const jobs: Job[] = [
  {
    id: 'backend-engineer',
    name: '后端开发工程师',
    icon: '后',
    iconColor: '#4F46E5',
    industry: '互联网',
    level: '初级',
    city: '北京/上海',
    score: 89,
    scoreColor: '#4F46E5',
    dims: [
      { label: '基', score: 95, color: '#1D4ED8' },
      { label: '技', score: 82, color: '#3B82F6' },
      { label: '素', score: 78, color: '#10B981' },
      { label: '潜', score: 88, color: '#D97706' },
    ]
  },
  {
    id: 'data-analyst',
    name: '数据分析师',
    icon: '数',
    iconColor: '#059669',
    industry: '金融/电商',
    level: '初级',
    city: '全国',
    score: 83,
    scoreColor: '#10B981',
    dims: [
      { label: '基', score: 90, color: '#1D4ED8' },
      { label: '技', score: 76, color: '#3B82F6' },
      { label: '素', score: 72, color: '#10B981' },
      { label: '潜', score: 80, color: '#D97706' },
    ]
  },
  {
    id: 'algorithm-engineer',
    name: '算法工程师',
    icon: '算',
    iconColor: '#D97706',
    industry: 'AI/大模型',
    level: '初级',
    city: '北京',
    score: 76,
    scoreColor: '#D97706',
    dims: [
      { label: '基', score: 88, color: '#1D4ED8' },
      { label: '技', score: 60, color: '#3B82F6' },
      { label: '素', score: 75, color: '#10B981' },
      { label: '潜', score: 85, color: '#D97706' },
    ]
  },
  {
    id: 'frontend-engineer',
    name: '前端开发工程师',
    icon: '前',
    iconColor: '#3B82F6',
    industry: '互联网',
    level: '初级',
    city: '全国',
    score: 72,
    scoreColor: '#3B82F6',
    dims: [
      { label: '基', score: 85, color: '#1D4ED8' },
      { label: '技', score: 68, color: '#3B82F6' },
      { label: '素', score: 74, color: '#10B981' },
      { label: '潜', score: 70, color: '#D97706' },
    ]
  },
]

const searchResults: Job[] = [
  {
    id: 'product-manager',
    name: '产品经理',
    icon: '产',
    iconColor: '#7C3AED',
    industry: '互联网',
    level: '初级',
    city: '全国',
    score: 71,
    scoreColor: '#7C3AED',
    tags: [
      { text: '匹配', bg: '#EEF2FF', color: '#4F46E5' },
      { text: '需补充需求分析', bg: '#F3F4F6', color: '#9CA3AF' }
    ],
    dims: [
      { label: '基', score: 85, color: '#1D4ED8' },
      { label: '技', score: 65, color: '#3B82F6' },
      { label: '素', score: 70, color: '#10B981' },
      { label: '潜', score: 72, color: '#D97706' },
    ]
  },
  {
    id: 'growth-pm',
    name: '增长产品经理',
    icon: '增',
    iconColor: '#7C3AED',
    industry: '互联网',
    level: '初级',
    city: '全国',
    score: 65,
    scoreColor: '#7C3AED',
    tags: [
      { text: '需 A/B测试经验', bg: '#F3F4F6', color: '#9CA3AF' }
    ],
    dims: [
      { label: '基', score: 80, color: '#1D4ED8' },
      { label: '技', score: 55, color: '#3B82F6' },
      { label: '素', score: 68, color: '#10B981' },
      { label: '潜', score: 70, color: '#D97706' },
    ]
  }
]

const filters = ['全部', '互联网', 'AI/算法', '数据', '金融']

const ExplorePage: React.FC = () => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('全部')
  const [activeSegment, setActiveSegment] = useState<'list' | 'graph'>('list')
  const [searchActive, setSearchActive] = useState(false)

  const displayedJobs = searchQuery
    ? searchResults
    : jobs.filter(j => activeFilter === '全部' || j.industry.includes(activeFilter))

  const handleSearchFocus = () => {
    setSearchActive(true)
  }

  const handleSearchClear = () => {
    setSearchQuery('')
    setSearchActive(false)
  }

  const handleJobClick = (jobId: string) => {
    navigate(`/match/${jobId}`)
  }

  return (
    <MobileShell hasTabBar activeTab="explore">
      <div className="explore-page">
        {/* 顶部栏 */}
        <div className="explore-header">
          <div className="explore-header-row">
            <span className="explore-title">岗位探索</span>
            <span className="explore-count">共 51 种岗位</span>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="explore-header">
          <div
            className={`explore-search-container ${searchActive ? 'active' : 'inactive'}`}
            onClick={() => {
              const input = document.querySelector('.explore-search-input') as HTMLInputElement
              input?.focus()
            }}
          >
            <svg className="explore-search-icon" viewBox="0 0 12 12" fill="none">
              <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              className="explore-search-input"
              placeholder="搜索岗位，如「产品经理」"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={handleSearchFocus}
            />
            {searchActive && searchQuery && (
              <svg className="explore-search-clear" viewBox="0 0 10 10" fill="none" onClick={handleSearchClear}>
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
          </div>
        </div>

        {/* 行业筛选栏 - 仅 searchActive=false 时显示 */}
        {!searchActive && (
          <div className="explore-header">
            <div className="explore-filter-bar">
              {filters.map(filter => (
                <button
                  key={filter}
                  className={`explore-filter-chip ${activeFilter === filter ? 'active' : 'inactive'}`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Segment Control - 仅 searchActive=false 时显示 */}
        {!searchActive && (
          <div className="explore-header">
            <div className="explore-segment">
              <button
                className={`explore-segment-btn ${activeSegment === 'list' ? 'active' : 'inactive'}`}
                onClick={() => setActiveSegment('list')}
              >
                推荐列表
              </button>
              <button
                className={`explore-segment-btn ${activeSegment === 'graph' ? 'active' : 'inactive'}`}
                onClick={() => navigate('/explore?view=graph')}
              >
                岗位图谱
              </button>
            </div>
          </div>
        )}

        {/* 搜索结果提示条 - searchActive=true 且 searchQuery 非空时显示 */}
        {searchActive && searchQuery && (
          <div className="explore-header">
            <div className="explore-search-result-bar">
              <span className="explore-search-result-text">找到 {displayedJobs.length} 个相关岗位</span>
            </div>
          </div>
        )}

        {/* 岗位卡片列表 */}
        <div className="explore-job-list">
          {displayedJobs.map((job, index) => (
            <div
              key={job.id}
              className="explore-job-card"
              style={{ animationDelay: `${index * 0.05}s` }}
              onClick={() => handleJobClick(job.id)}
            >
              <div className="explore-job-icon" style={{ background: job.iconColor }}>
                <span className="explore-job-icon-text">{job.icon}</span>
              </div>
              <div className="explore-job-content">
                <div className="explore-job-name">{job.name}</div>
                <div className="explore-job-subtitle">{job.industry} · {job.level} · {job.city}</div>
                {job.tags && job.tags.length > 0 && (
                  <div className="explore-job-tags">
                    {job.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="explore-job-tag"
                        style={{ background: tag.bg, color: tag.color }}
                      >
                        {tag.text}
                      </span>
                    ))}
                  </div>
                )}
                <div className="explore-job-dims">
                  {job.dims.map((dim, i) => (
                    <div key={i} className="explore-dim-row">
                      <span className="explore-dim-label">{dim.label}</span>
                      <div className="explore-dim-track">
                        <div
                          className="explore-dim-fill"
                          style={{ width: `${dim.score}%`, background: dim.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <span className="explore-job-score" style={{ color: job.scoreColor }}>{job.score}</span>
              <span className="explore-job-arrow">›</span>
            </div>
          ))}

          {/* 搜索结果底部提示 */}
          {searchActive && searchQuery && displayedJobs.length > 2 && (
            <div className="explore-more-hint">还有 {displayedJobs.length - 2} 个结果</div>
          )}
        </div>
      </div>
    </MobileShell>
  )
}

export default ExplorePage
