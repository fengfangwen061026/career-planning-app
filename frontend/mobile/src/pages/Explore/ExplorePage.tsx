import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import TabBar from '../../components/TabBar/TabBar'
import { session } from '../../store/session'

interface RecommendItem {
  id: string
  job_profile_id: string
  role_name: string | null
  role_category: string | null
  total_score: number
  scores: {
    basic?: { score?: number }
    skill?: { score?: number }
    competency?: { score?: number }
    potential?: { score?: number }
  }
  gaps: Array<{ gap_item: string; dimension: string }>
  job_snapshot: {
    title: string | null
    city: string | null
    company_name: string | null
    industries: string[]
  } | null
}

interface RecommendResponse {
  results?: RecommendItem[]
}

const CATEGORY_COLORS: Record<string, string> = {
  '后端开发': '#4F46E5',
  '前端开发': '#7C3AED',
  '算法工程师': '#D97706',
  '数据分析': '#059669',
  '产品经理': '#DC2626',
  '测试工程师': '#0891B2',
  '运维': '#65A30D',
  default: '#6B7280',
}

function scoreValue(value: unknown): number {
  const num = Number(value || 0)
  return Number.isNaN(num) ? 0 : Math.round(num)
}

export default function ExplorePage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<RecommendItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('全部')
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState<string[]>(['全部'])
  const [error, setError] = useState('')

  useEffect(() => {
    const studentId = session.getStudentId()
    if (!studentId) {
      navigate('/onboarding')
      return
    }

    const load = async () => {
      try {
        const res = await fetch(`/api/student-app/students/${studentId}/recommendations?top_k=20`)
        if (!res.ok) {
          throw new Error('Failed')
        }
        const data = await res.json() as RecommendResponse
        const results = data.results || []
        setJobs(results)
        const cats = Array.from(new Set(results.map(r => r.role_category).filter(Boolean))) as string[]
        setCategories(['全部', ...cats])
      } catch {
        setError('暂无数据')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [navigate])

  const filtered = jobs.filter(job => {
    const name = (job.role_name || job.job_snapshot?.title || '').toLowerCase()
    const cat = (job.role_category || '').toLowerCase()
    const city = (job.job_snapshot?.city || '').toLowerCase()
    const q = query.toLowerCase()
    const matchFilter = filter === '全部' || job.role_category === filter
    const matchQuery = !query || name.includes(q) || cat.includes(q) || city.includes(q)
    return matchFilter && matchQuery
  })

  return (
    <>
      <div style={{
        padding: query ? '6px 10px' : '10px 10px 0',
        background: query ? '#EEF2FF' : 'white',
        borderBottom: query ? '0.5px solid rgba(79,70,229,0.15)' : 'none',
        flexShrink: 0,
      }}>
        {!query && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.4px', color: '#0A0A0A' }}>岗位探索</div>
            <div style={{ fontSize: 8, color: '#6B7280' }}>{jobs.length || 0} 个推荐岗位</div>
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 10px',
          background: query ? '#FFFFFF' : '#F9FAFB',
          border: query ? '1px solid #4F46E5' : '0.5px solid #D1D5DB',
          borderRadius: 20,
          marginBottom: query ? 0 : 8,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="4" stroke={query ? '#4F46E5' : '#9CA3AF'} strokeWidth="1.2" />
            <path d="M9 9l2 2" stroke={query ? '#4F46E5' : '#9CA3AF'} strokeWidth="1.2" strokeLinecap="round" />
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
              <circle cx="5" cy="5" r="5" fill="#9CA3AF" />
              <path d="M3 3l4 4M7 3l-4 4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          )}
        </div>

        {query && (
          <div style={{ fontSize: 8, color: '#4F46E5', marginTop: 5, marginBottom: 6 }}>
            找到 {filtered.length} 个相关岗位
          </div>
        )}

        {!query && (
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 8 }}>
            {categories.map(f => (
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

      <div className="scroll-body" style={{ padding: '10px 10px 12px' }}>
        {loading && (
          Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} style={{ padding: '9px 10px', background: 'white', border: '0.5px solid #E5E7EB', borderRadius: 10, marginBottom: 7 }}>
              <div className="skeleton" style={{ height: 14, width: '42%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 10, width: '58%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 28, width: '100%' }} />
            </div>
          ))
        )}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: '#9CA3AF' }}>
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: '#9CA3AF' }}>
            没有找到相关岗位
          </div>
        )}

        {!loading && !error && filtered.map(job => {
          const color = CATEGORY_COLORS[job.role_category || ''] || CATEGORY_COLORS.default
          const dims = [
            { label: '基', pct: scoreValue(job.scores.basic?.score), color: '#1D4ED8' },
            { label: '技', pct: scoreValue(job.scores.skill?.score), color: '#3B82F6' },
            { label: '素', pct: scoreValue(job.scores.competency?.score), color: '#10B981' },
            { label: '潜', pct: scoreValue(job.scores.potential?.score), color: '#D97706' },
          ]
          const roleName = job.role_name || job.job_snapshot?.title || '未知岗位'
          const sub = [job.role_category, job.job_snapshot?.city].filter(Boolean).join(' · ')
          return (
            <div
              key={job.id}
              onClick={() => navigate(`/match/${job.job_profile_id}`)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 7,
                padding: '9px 10px', background: 'white',
                border: '0.5px solid #E5E7EB',
                borderRadius: 10, marginBottom: 7,
                cursor: 'pointer', position: 'relative',
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: 7,
                background: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: 'white' }}>{roleName.charAt(0)}</span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0A0A0A' }}>{roleName}</div>
                <div style={{ fontSize: 8, color: '#6B7280', marginBottom: 4 }}>{sub || '岗位推荐'}</div>
                {dims.map(d => (
                  <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 3, margin: '1.5px 0' }}>
                    <span style={{ fontSize: 8, color: '#9CA3AF', width: 13, flexShrink: 0 }}>{d.label}</span>
                    <div style={{ flex: 1, height: 2.5, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${d.pct}%`, height: '100%', background: d.color, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                fontSize: 18, fontWeight: 900, letterSpacing: '-0.8px',
                color: color, flexShrink: 0, lineHeight: 1,
                paddingRight: 14,
              }}>
                {scoreValue(job.total_score)}
              </div>

              <span style={{
                position: 'absolute', right: 10, top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 10, color: '#9CA3AF',
              }}>›</span>
            </div>
          )
        })}
      </div>

      <TabBar active="explore" />
    </>
  )
}
