import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TabBar from '../../components/TabBar/TabBar'

const JOBS = [
  {
    id: '1',
    name: '后端开发工程师',
    sub: '互联网 · 初级 · 北京/上海',
    color: '#4F46E5',
    char: '后',
    score: 89,
    scoreColor: '#4F46E5',
    dims: [
      { label: '基', pct: 95, color: '#1D4ED8' },
      { label: '技', pct: 82, color: '#3B82F6' },
      { label: '素', pct: 78, color: '#10B981' },
      { label: '潜', pct: 88, color: '#D97706' },
    ],
  },
  {
    id: '2',
    name: '数据分析师',
    sub: '金融/电商 · 初级 · 上海',
    color: '#059669',
    char: '数',
    score: 83,
    scoreColor: '#10B981',
    dims: [
      { label: '基', pct: 90, color: '#1D4ED8' },
      { label: '技', pct: 76, color: '#3B82F6' },
      { label: '素', pct: 72, color: '#10B981' },
      { label: '潜', pct: 80, color: '#D97706' },
    ],
  },
  {
    id: '3',
    name: '算法工程师',
    sub: 'AI/大模型 · 初级 · 北京',
    color: '#D97706',
    char: '算',
    score: 76,
    scoreColor: '#D97706',
    dims: [
      { label: '基', pct: 88, color: '#1D4ED8' },
      { label: '技', pct: 60, color: '#60A5FA' },
      { label: '素', pct: 75, color: '#10B981' },
      { label: '潜', pct: 85, color: '#D97706' },
    ],
  },
  {
    id: '4',
    name: '前端开发工程师',
    sub: '互联网 · 初级 · 全国',
    color: '#3B82F6',
    char: '前',
    score: 72,
    scoreColor: '#3B82F6',
    dims: [
      { label: '基', pct: 85, color: '#1D4ED8' },
      { label: '技', pct: 68, color: '#60A5FA' },
      { label: '素', pct: 74, color: '#10B981' },
      { label: '潜', pct: 70, color: '#D97706' },
    ],
  },
]

const FILTERS = ['全部', '互联网', 'AI/算法', '数据', '金融']

export default function ExplorePage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('全部')
  const [query, setQuery] = useState('')

  const filtered = JOBS.filter(j => {
    const matchFilter = filter === '全部' || j.sub.includes(filter.replace('AI/算法', 'AI'))
    const matchQuery = !query || j.name.includes(query)
    return matchFilter && matchQuery
  })

  return (
    <>
      {/* 固定白色顶部 header */}
      <div style={{
        padding: query ? '6px 10px' : '10px 10px 0',
        background: query ? '#EEF2FF' : 'white',
        borderBottom: query ? '0.5px solid rgba(79,70,229,0.15)' : 'none',
        flexShrink: 0,
      }}>
        {/* 标题行 — 搜索激活时隐藏 */}
        {!query && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.4px', color: '#0A0A0A' }}>岗位探索</div>
            <div style={{ fontSize: 8, color: '#6B7280' }}>51种岗位</div>
          </div>
        )}

        {/* 搜索框 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 10px',
          background: query ? '#FFFFFF' : '#F9FAFB',
          border: query ? '1px solid #4F46E5' : '0.5px solid #D1D5DB',
          borderRadius: 20,
          marginBottom: query ? 0 : 8,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="4" stroke={query ? '#4F46E5' : '#9CA3AF'} strokeWidth="1.2"/>
            <path d="M9 9l2 2" stroke={query ? '#4F46E5' : '#9CA3AF'} strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索岗位，如「产品经理」"
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontSize: 10,
              color: query ? '#4F46E5' : '#374151',
              fontWeight: query ? 600 : 400,
              fontFamily: 'inherit',
            }}
          />
          {query && (
            <svg onClick={() => setQuery('')} width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ cursor: 'pointer', flexShrink: 0 }}>
              <circle cx="5" cy="5" r="5" fill="#9CA3AF"/>
              <path d="M3 3l4 4M7 3l-4 4" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          )}
        </div>

        {/* 搜索结果计数 */}
        {query && (
          <div style={{ fontSize: 8, color: '#4F46E5', marginTop: 5, marginBottom: 6 }}>
            找到 {filtered.length} 个相关岗位
          </div>
        )}

        {/* 行业筛选行 — 搜索激活时隐藏 */}
        {!query && (
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 8 }}>
            {FILTERS.map(f => (
              <span
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '3px 9px',
                  background: filter === f ? '#4F46E5' : 'transparent',
                  color: filter === f ? '#fff' : '#6B7280',
                  border: filter === f ? 'none' : '0.5px solid #E5E7EB',
                  borderRadius: 20, fontSize: 8,
                  fontWeight: filter === f ? 700 : 400,
                  whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer',
                }}
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 滚动内容区 */}
      <div className="scroll-body" style={{ padding: '10px 10px 12px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: '#9CA3AF' }}>
            没有找到相关岗位
          </div>
        )}
        {filtered.map(job => (
              <div
                key={job.id}
                onClick={() => navigate(`/match/${job.id}`)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 7,
                  padding: '9px 10px', background: 'white',
                  border: '0.5px solid #E5E7EB',
                  borderRadius: 10, marginBottom: 7,
                  cursor: 'pointer', position: 'relative',
                }}
              >
                {/* 图标块 */}
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: job.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: 'white' }}>{job.char}</span>
                </div>

                {/* 内容区 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0A0A0A' }}>{job.name}</div>
                  <div style={{ fontSize: 8, color: '#6B7280', marginBottom: 4 }}>{job.sub}</div>
                  {job.dims.map(d => (
                    <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 3, margin: '1.5px 0' }}>
                      <span style={{ fontSize: 8, color: '#9CA3AF', width: 13, flexShrink: 0 }}>{d.label}</span>
                      <div style={{ flex: 1, height: 2.5, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${d.pct}%`, height: '100%', background: d.color, borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 综合分 */}
                <div style={{
                  fontSize: 18, fontWeight: 900, letterSpacing: '-0.8px',
                  color: job.scoreColor, flexShrink: 0, lineHeight: 1,
                  paddingRight: 14,
                }}>
                  {job.score}
                </div>

                {/* 箭头 */}
                <span style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 10, color: '#9CA3AF',
                }}>›</span>
              </div>
            ))
          }
      </div>

      <TabBar active="explore" />
    </>
  )
}
