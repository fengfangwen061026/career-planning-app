import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import MobileShell from '../components/MobileShell'
import { useMobileApp } from '../context/MobileAppContext'
import type { StudentRecommendationItem } from '@shared/types/studentApp'
import './ExplorePage.css'

function scoreOf(item: StudentRecommendationItem, key: 'basic' | 'skill' | 'competency' | 'potential') {
  const section = item.scores?.[key]
  return Math.round(Number(section?.score || 0))
}

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
  const [activeCategory, setActiveCategory] = useState('全部')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      setError('')
      try {
        await refreshRecommendations({ top_k: 12 })
      } catch (loadError) {
        if (!mounted) {
          return
        }
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

  const categoryValues = new Set<string>()
  recommendations.forEach((item) => {
    if (item.role_category) {
      categoryValues.add(item.role_category)
    }
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
        <div style={{ padding: 24, color: '#334155' }}>
          还没有学生画像。先上传简历，才能得到真实岗位推荐。
          <div>
            <button
              type="button"
              onClick={() => navigate('/upload')}
              style={{
                marginTop: 16,
                border: 'none',
                borderRadius: 14,
                padding: '12px 16px',
                background: '#1d4ed8',
                color: '#ffffff',
                fontWeight: 700,
              }}
            >
              去上传简历
            </button>
          </div>
        </div>
      </MobileShell>
    )
  }

  return (
    <MobileShell hasTabBar activeTab="explore">
      <div
        style={{
          padding: '20px 18px 120px',
          background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 42%)',
          minHeight: '100%',
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>岗位探索</div>
        <p style={{ marginTop: 10, color: '#475569', lineHeight: 1.7, fontSize: 14 }}>
          这里展示后端真实推荐结果，点击卡片可进入匹配详情与职业路径。
        </p>

        <div
          style={{
            marginTop: 16,
            borderRadius: 18,
            background: '#ffffff',
            border: '1px solid #dbeafe',
            padding: '12px 14px',
          }}
        >
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索岗位、城市或行业"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: 14,
              color: '#0f172a',
            }}
          />
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              style={{
                borderRadius: 999,
                whiteSpace: 'nowrap',
                border: activeCategory === category ? '1px solid #6366f1' : '1px solid #cbd5e1',
                background: activeCategory === category ? '#eef2ff' : '#ffffff',
                color: activeCategory === category ? '#4338ca' : '#475569',
                padding: '10px 12px',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {category}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12 }}>
          <span>{isLoadingRecommendations ? '正在刷新推荐...' : `共 ${displayedJobs.length} 个岗位`}</span>
          <button
            type="button"
            onClick={() => refreshRecommendations({
              top_k: 12,
              force: true,
            })}
            style={{ border: 'none', background: 'transparent', color: '#1d4ed8', fontWeight: 700 }}
          >
            重新推荐
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: 14,
              borderRadius: 18,
              padding: '14px 16px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
          {displayedJobs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                selectRecommendation(item)
                navigate(`/match/${item.id}`)
              }}
              style={{
                textAlign: 'left',
                borderRadius: 24,
                padding: 18,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 12px 28px rgba(15, 23, 42, 0.05)',
              }}
            >
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                    {item.role_name || item.job_snapshot?.title || '未命名岗位'}
                  </div>
                  <div style={{ marginTop: 8, color: '#475569', lineHeight: 1.7, fontSize: 13 }}>
                    {[item.role_category, item.job_snapshot?.city, item.job_snapshot?.company_name].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div
                  style={{
                    width: 'fit-content',
                    textAlign: 'center',
                    borderRadius: 18,
                    padding: '10px 10px',
                    background: '#eef2ff',
                    color: '#4338ca',
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{Math.round(item.total_score)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>匹配分</div>
                </div>
              </div>

              {item.match_reasons.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {item.match_reasons.slice(0, 3).map((reason) => (
                    <span
                      key={reason}
                      style={{
                        borderRadius: 999,
                        padding: '8px 10px',
                        background: '#f8fafc',
                        color: '#334155',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                {[
                  { label: '基础要求', value: scoreOf(item, 'basic'), color: '#1d4ed8' },
                  { label: '技能匹配', value: scoreOf(item, 'skill'), color: '#2563eb' },
                  { label: '职业素养', value: scoreOf(item, 'competency'), color: '#10b981' },
                  { label: '发展潜力', value: scoreOf(item, 'potential'), color: '#f59e0b' },
                ].map((dimension) => (
                  <div key={dimension.label} style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#475569' }}>{dimension.label}</span>
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>{dimension.value}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${dimension.value}%`,
                          height: '100%',
                          background: dimension.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {(item.job_snapshot?.industries?.length || item.job_snapshot?.benefits?.length) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  {[...(item.job_snapshot?.industries || []), ...(item.job_snapshot?.benefits || [])].slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        borderRadius: 999,
                        padding: '7px 10px',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>

        {!isLoadingRecommendations && displayedJobs.length === 0 && !error && (
          <div
            style={{
              marginTop: 18,
              borderRadius: 24,
              padding: 20,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              color: '#475569',
              lineHeight: 1.7,
            }}
          >
            当前条件下没有找到推荐岗位，试试清空搜索词或切换行业筛选。
          </div>
        )}
      </div>
    </MobileShell>
  )
}

export default ExplorePage
