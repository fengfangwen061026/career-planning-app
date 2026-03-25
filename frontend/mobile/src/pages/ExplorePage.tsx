import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import MobileShell from '../components/MobileShell'
import { useMobileApp } from '../context/MobileAppContext'
import type { StudentRecommendationItem } from '@shared/types/studentApp'
import './ExplorePage.css'

function scoreOf(item: StudentRecommendationItem, key: 'basic' | 'skill' | 'competency' | 'potential') {
  const section = item.scores?.[key]
  return Math.round(Number(section?.score || 0))
}

const ICON_COLORS = ['#4F46E5', '#10B981', '#D97706', '#EF4444', '#3B82F6', '#8B5CF6', '#F59E0B']

const ExplorePage: React.FC = () => {
  const navigate = useNavigate()
  const {
    profile,
    recommendations,
    refreshRecommendations,
    isLoadingRecommendations,
    selectRecommendation,
  } = useMobileApp()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [activeCategory, setActiveCategory] = useState('全部')
  const [error, setError] = useState('')

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    let mounted = true
    async function load() {
      setError('')
      try {
        await refreshRecommendations({ top_k: 12 })
      } catch (loadError) {
        if (!mounted) return
        const message = loadError instanceof Error ? loadError.message : '加载推荐失败'
        setError(message)
      }
    }

    if (profile && recommendations.length === 0 && !isLoadingRecommendations) {
      void load()
    }

    return () => {
      mounted = false
    }
  }, [isLoadingRecommendations, profile, recommendations.length])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const allItems = Array.from(document.querySelectorAll('.reveal-item'))
            const idx = allItems.indexOf(entry.target)
            ;(entry.target as HTMLElement).style.transitionDelay = `${idx * 40}ms`
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
    )

    cardRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [recommendations])

  const categoryValues = new Set<string>()
  recommendations.forEach((item) => {
    if (item.role_category) categoryValues.add(item.role_category)
  })
  const categories = ['全部', ...categoryValues]

  const keyword = searchQuery.trim().toLowerCase()
  const displayedJobs = recommendations.filter((item) => {
    const matchesCategory = activeCategory === '全部' || item.role_category === activeCategory
    const searchable = [
      item.role_name,
      item.role_category,
      item.job_snapshot?.title,
      item.job_snapshot?.city,
      ...(item.job_snapshot?.industries || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const matchesKeyword = !keyword || searchable.includes(keyword)
    return matchesCategory && matchesKeyword
  })

  if (!profile) {
    return (
      <MobileShell hasTabBar activeTab="explore">
        <div style={{ padding: 16, color: 'var(--color-text-secondary)', fontSize: 12, lineHeight: 1.7 }}>
          还没有学生画像，先上传简历才能得到真实岗位推荐。
          <button
            type="button"
            onClick={() => navigate('/upload')}
            style={{
              display: 'block',
              marginTop: 14,
              border: 'none',
              borderRadius: 9,
              padding: '9px 16px',
              background: 'var(--color-primary)',
              color: 'white',
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            去上传简历
          </button>
        </div>
      </MobileShell>
    )
  }

  return (
    <MobileShell hasTabBar activeTab="explore">
      <div className="explore-page">
        {/* Header */}
        <div className="explore-header page-header-anim">
          <div className="explore-header-row">
            <span className="explore-title">岗位探索</span>
            <span className="explore-count">
              {isLoadingRecommendations ? '刷新中...' : `共 ${displayedJobs.length} 个`}
            </span>
          </div>

          {/* Search */}
          <div className={`explore-search-container ${searchFocused || searchQuery ? 'active' : 'inactive'}`}>
            <svg className="explore-search-icon" viewBox="0 0 12 12" fill="none">
              <circle cx="5" cy="5" r="3.5" strokeWidth="1.2" />
              <line x1="8" y1="8" x2="11" y2="11" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              className="explore-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="搜索岗位、城市或行业"
            />
            {searchQuery && (
              <svg
                className="explore-search-clear"
                viewBox="0 0 10 10"
                fill="none"
                onClick={() => setSearchQuery('')}
              >
                <line x1="1" y1="1" x2="9" y2="9" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="9" y1="1" x2="1" y2="9" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            )}
          </div>

          {/* Filter chips */}
          <div className="explore-filter-bar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`explore-filter-chip pressable ${activeCategory === cat ? 'active' : 'inactive'}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ margin: '6px 10px', padding: '7px 10px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 9 }}>
            {error}
          </div>
        )}

        {/* Job list */}
        <div className="explore-job-list" style={{ padding: '6px 10px 8px' }}>
          {isLoadingRecommendations && displayedJobs.length === 0 && (
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-line" style={{ height: 72, marginBottom: 7, borderRadius: 10 }} />
              ))}
            </>
          )}

          {displayedJobs.map((item, index) => {
            const iconColor = ICON_COLORS[index % ICON_COLORS.length]
            const scoreColor = item.total_score >= 75 ? '#10B981' : item.total_score >= 55 ? '#4F46E5' : '#9CA3AF'
            const dims = [
              { label: '基', value: scoreOf(item, 'basic'), color: '#1D4ED8' },
              { label: '技', value: scoreOf(item, 'skill'), color: '#10B981' },
              { label: '素', value: scoreOf(item, 'competency'), color: '#D97706' },
              { label: '潜', value: scoreOf(item, 'potential'), color: '#8B5CF6' },
            ]

            return (
              <div
                key={item.id}
                ref={(el) => { if (el) cardRefs.current.set(item.id, el) }}
                className="explore-job-card reveal-item role-card-body pressable"
                role="button"
                tabIndex={0}
                onClick={() => {
                  selectRecommendation(item)
                  navigate(`/match/${item.id}`)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    selectRecommendation(item)
                    navigate(`/match/${item.id}`)
                  }
                }}
              >
                {/* Icon */}
                <div className="explore-job-icon" style={{ background: iconColor }}>
                  <span className="explore-job-icon-text">
                    {(item.role_name || item.job_snapshot?.title || '岗')[0]}
                  </span>
                </div>

                {/* Content */}
                <div className="explore-job-content">
                  <div className="explore-job-name">
                    {item.role_name || item.job_snapshot?.title || '未命名岗位'}
                  </div>
                  <div className="explore-job-subtitle">
                    {[item.role_category, item.job_snapshot?.city].filter(Boolean).join(' · ')}
                  </div>
                  <div className="explore-job-dims">
                    {dims.map((dim) => (
                      <div key={dim.label} className="explore-dim-row">
                        <span className="explore-dim-label">{dim.label}</span>
                        <div className="explore-dim-track">
                          <div
                            className="explore-dim-fill"
                            style={{ width: `${dim.value}%`, background: dim.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Score */}
                <div className="explore-job-score" style={{ color: scoreColor }}>
                  {Math.round(item.total_score)}
                </div>

                {/* Arrow */}
                <span className="explore-job-arrow role-card-arrow">›</span>
              </div>
            )
          })}

          {!isLoadingRecommendations && displayedJobs.length === 0 && !error && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 10 }}>
              当前条件下没有找到推荐岗位，试试清空搜索词或切换筛选。
            </div>
          )}

          {displayedJobs.length > 0 && (
            <div className="explore-more-hint">
              已展示全部 {displayedJobs.length} 个推荐岗位 ·{' '}
              <button
                type="button"
                style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: 8, fontWeight: 700 }}
                onClick={() => refreshRecommendations({ top_k: 12, force: true })}
              >
                重新推荐
              </button>
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  )
}

export default ExplorePage
