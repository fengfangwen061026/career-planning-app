import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { session } from '../../store/session'

interface SkillMatchItem {
  skill_name: string
  matched: boolean
  importance?: string
  score?: number
}

interface GapItem {
  gap_item: string
  dimension: string
  priority?: string
  suggestion?: string
}

interface MatchDetail {
  id: string
  job_profile_id: string
  role_name: string | null
  role_category: string | null
  job_title: string | null
  total_score: number
  scores: {
    basic?: { score?: number }
    skill?: { score?: number; items?: SkillMatchItem[] }
    competency?: { score?: number }
    potential?: { score?: number }
  }
  gaps: GapItem[]
  match_reasons: string[]
  job_snapshot: {
    title: string | null
    city: string | null
    company_name: string | null
    industries: string[]
    benefits?: string[]
  } | null
}

interface CareerPathPayload {
  path?: {
    primary_path?: Array<{ stage?: string; title?: string; condition?: string; is_current?: boolean }>
    main_path?: Array<{ name?: string; level?: string }>
    action_plan?: Array<{ target?: string; estimated_time?: string; actions?: string[] }>
    alternative_paths?: Array<{ intermediate_role?: string; steps?: number }>
  }
}

interface TransitionResponse {
  transitions?: Array<{
    target_name?: string
    overlap?: number
    gap_skills?: string[]
    advice?: string
  }>
}

function scoreValue(value: unknown): number {
  const num = Number(value || 0)
  return Number.isNaN(num) ? 0 : Math.round(num)
}

function gapColor(gap: GapItem): string {
  if (gap.dimension === 'skill' && gap.priority === 'high') {
    return '#EF4444'
  }
  return '#D97706'
}

function buildPrimaryPath(matchData: MatchDetail | null, careerPath: CareerPathPayload | null) {
  const providedPath = careerPath?.path?.primary_path
  if (Array.isArray(providedPath) && providedPath.length > 0) {
    return providedPath.map(item => ({
      label: item.title || '职业阶段',
      cond: item.condition || item.stage || '继续积累相关经验',
      current: Boolean(item.is_current),
    }))
  }

  const actionPlan = careerPath?.path?.action_plan || []
  if (actionPlan.length > 0) {
    return [
      {
        label: `${matchData?.role_name || matchData?.job_title || '目标岗位'}（当前）`,
        cond: matchData?.match_reasons?.[0] || '当前最适合优先冲刺的岗位方向',
        current: true,
      },
      ...actionPlan.slice(0, 2).map(item => ({
        label: item.target || '下一阶段岗位',
        cond: [item.estimated_time, item.actions?.[0]].filter(Boolean).join(' · ') || '继续补强关键能力',
        current: false,
      })),
    ]
  }

  return [
    {
      label: `${matchData?.role_name || matchData?.job_title || '目标岗位'}（当前）`,
      cond: '先补齐当前差距，再向更高要求阶段推进',
      current: true,
    },
  ]
}

function buildLateralPath(transitions: TransitionResponse | null, careerPath: CareerPathPayload | null) {
  if (transitions?.transitions?.length) {
    return transitions.transitions.slice(0, 3).map(item => ({
      label: `${item.target_name || '相关岗位'} →`,
      cond: `技能重叠 ${Math.round(Number(item.overlap || 0) * 100)}%`,
      color: '#10B981',
      advice: item.advice || '',
    }))
  }

  return (careerPath?.path?.alternative_paths || []).slice(0, 3).map(item => ({
    label: `${item.intermediate_role || '相关岗位'} →`,
    cond: `路径步数 ${item.steps || 0}`,
    color: '#10B981',
    advice: '',
  }))
}

export default function MatchPage() {
  const navigate = useNavigate()
  const { id: jobProfileId } = useParams<{ id: string }>()
  const [matchData, setMatchData] = useState<MatchDetail | null>(null)
  const [careerPath, setCareerPath] = useState<CareerPathPayload | null>(null)
  const [transitions, setTransitions] = useState<TransitionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'path'>('overview')

  useEffect(() => {
    const studentId = session.getStudentId()
    if (!studentId || !jobProfileId) {
      navigate('/explore')
      return
    }

    const load = async () => {
      try {
        const matchRes = await fetch('/api/matching/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: studentId, job_profile_id: jobProfileId }),
        })
        if (!matchRes.ok) {
          throw new Error('Match failed')
        }
        const matchDetail = await matchRes.json() as MatchDetail
        setMatchData(matchDetail)

        const [pathRes, transRes] = await Promise.allSettled([
          fetch(`/api/student-app/students/${studentId}/career-path?job_profile_id=${jobProfileId}`),
          fetch(`/api/graph/transitions/${jobProfileId}`),
        ])

        if (pathRes.status === 'fulfilled' && pathRes.value.ok) {
          setCareerPath(await pathRes.value.json() as CareerPathPayload)
        }
        if (transRes.status === 'fulfilled' && transRes.value.ok) {
          setTransitions(await transRes.value.json() as TransitionResponse)
        }
      } catch {
        setError('暂无匹配数据')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [navigate, jobProfileId])

  const dims = [
    { label: '基础', score: scoreValue(matchData?.scores.basic?.score), color: '#1D4ED8' },
    { label: '技能', score: scoreValue(matchData?.scores.skill?.score), color: '#3B82F6' },
    { label: '素养', score: scoreValue(matchData?.scores.competency?.score), color: '#10B981' },
    { label: '潜力', score: scoreValue(matchData?.scores.potential?.score), color: '#D97706' },
  ]
  const skillItems = matchData?.scores.skill?.items || []
  const primaryPath = buildPrimaryPath(matchData, careerPath)
  const lateralPath = buildLateralPath(transitions, careerPath)

  const handleGenerateReport = () => {
    session.setTargetJobProfileId(jobProfileId || '')
    session.setReportId('')
    navigate('/report')
  }

  return (
    <>
      <div className="scroll-body" style={{ padding: '12px 12px 0' }}>
        {loading && (
          <>
            <div className="card" style={{ padding: 12 }}>
              <div className="skeleton" style={{ height: 18, width: '42%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 12, width: '55%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 64, width: '100%' }} />
            </div>
            <div className="card">
              <div className="skeleton" style={{ height: 10, width: '100%' }} />
            </div>
          </>
        )}

        {!loading && error && (
          <div className="card">
            <div style={{ fontSize: 10, color: '#EF4444', marginBottom: 8 }}>{error}</div>
            <button className="btn-primary" onClick={() => navigate('/explore')}>
              返回岗位列表
            </button>
          </div>
        )}

        {!loading && !error && matchData && (
          <>
            <div style={{ background: 'white', borderRadius: 10, padding: '10px 11px', marginBottom: 8, border: '0.5px solid #E5E7EB' }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#4F46E5', marginBottom: 2, cursor: 'pointer' }} onClick={() => navigate('/explore')}>
                ← 返回探索
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.3px', color: '#0A0A0A' }}>
                    {matchData.role_name || matchData.job_title || '岗位详情'}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {matchData.job_snapshot?.industries?.[0] ? <span className="tag tag-blue">{matchData.job_snapshot.industries[0]}</span> : null}
                    {matchData.role_category ? <span className="tag tag-gray">{matchData.role_category}</span> : null}
                    {matchData.job_snapshot?.city ? <span className="tag tag-gray">{matchData.job_snapshot.city}</span> : null}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#4F46E5', letterSpacing: '-1px', lineHeight: 1 }}>
                    {scoreValue(matchData.total_score)}
                  </div>
                  <div style={{ fontSize: 8, color: '#9CA3AF' }}>综合匹配</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
              {[
                { key: 'overview', label: '总览' },
                { key: 'skills', label: '技能' },
                { key: 'path', label: '路径' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as 'overview' | 'skills' | 'path')}
                  style={{
                    flex: 1,
                    height: 30,
                    borderRadius: 8,
                    border: activeTab === tab.key ? 'none' : '0.5px solid #E5E7EB',
                    background: activeTab === tab.key ? '#4F46E5' : 'white',
                    color: activeTab === tab.key ? 'white' : '#6B7280',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <>
                <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                  {dims.map(d => (
                    <div key={d.label} style={{ flex: 1, background: '#F9FAFB', borderRadius: 8, padding: '7px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.8px', lineHeight: 1, color: d.color }}>{d.score}</div>
                      <div style={{ fontSize: 7, color: '#9CA3AF', marginTop: 2, lineHeight: 1.3 }}>{d.label}</div>
                    </div>
                  ))}
                </div>

                <div className="card">
                  <div className="card-hd"><div className="card-hd-bar" style={{ background: '#EF4444' }} />差距清单</div>
                  {matchData.gaps.length > 0 ? matchData.gaps.map((gap, i) => (
                    <div key={`${gap.gap_item}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 0', borderBottom: i < matchData.gaps.length - 1 ? '0.5px solid #E5E7EB' : 'none' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: gapColor(gap), flexShrink: 0, marginTop: 3 }} />
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#0A0A0A' }}>{gap.gap_item}</div>
                        <div style={{ fontSize: 9, color: '#6B7280' }}>{gap.suggestion || '建议优先补齐该差距项'}</div>
                      </div>
                    </div>
                  )) : (
                    <div style={{ fontSize: 9, color: '#9CA3AF' }}>当前没有明显差距项</div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'skills' && (
              <div className="card">
                <div className="card-hd"><div className="card-hd-bar" style={{ background: '#3B82F6' }} />岗位必备技能</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: skillItems.length > 0 ? 8 : 0 }}>
                  {skillItems.length > 0 ? skillItems.slice(0, 8).map(item => (
                    <span
                      key={item.skill_name}
                      className={`tag ${item.matched ? 'tag-green' : item.importance === 'required' ? 'tag-red' : 'tag-amber'}`}
                    >
                      {item.skill_name} {item.matched ? '✓' : item.importance === 'required' ? '✗' : '△'}
                    </span>
                  )) : (
                    <span className="tag tag-gray">暂无技能匹配详情</span>
                  )}
                </div>

                {skillItems.map((item, i) => (
                  <div key={`${item.skill_name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: i === 0 ? '0.5px solid #E5E7EB' : undefined }}>
                    <div style={{ width: 16, textAlign: 'center', color: item.matched ? '#10B981' : '#EF4444', fontSize: 10, fontWeight: 700 }}>
                      {item.matched ? '✓' : '✗'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#0A0A0A' }}>{item.skill_name}</div>
                      <div style={{ fontSize: 9, color: '#6B7280' }}>
                        {item.importance === 'required' ? '必备技能' : item.importance === 'preferred' ? '优选技能' : '加分技能'}
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: '#6B7280' }}>{scoreValue(item.score)}分</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'path' && (
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-hd"><div className="card-hd-bar" style={{ background: '#10B981' }} />职业路径</div>

                <div style={{ fontSize: 8, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>垂直晋升</div>
                {primaryPath.map((node, i) => (
                  <div key={`${node.label}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: i < primaryPath.length - 1 ? 0 : 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: node.current ? '#4F46E5' : 'white',
                        border: node.current ? 'none' : '1.5px solid #4F46E5',
                        fontSize: 9, fontWeight: 800, color: node.current ? 'white' : '#4F46E5',
                      }}>
                        {node.current ? (
                          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                            <path d="M2 4.5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : i + 1}
                      </div>
                      {i < primaryPath.length - 1 && (
                        <div style={{ width: 1.5, height: 18, background: '#E5E7EB' }} />
                      )}
                    </div>
                    <div style={{ paddingTop: 2 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: node.current ? '#4F46E5' : '#0A0A0A' }}>{node.label}</div>
                      <div style={{ fontSize: 9, color: '#6B7280' }}>{node.cond}</div>
                    </div>
                  </div>
                ))}

                <div style={{ height: '0.5px', background: '#E5E7EB', marginBottom: 7 }} />

                <div style={{ fontSize: 8, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>横向转岗</div>
                {lateralPath.length > 0 ? lateralPath.map((node, i) => (
                  <div key={`${node.label}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'white', border: `1.5px solid ${node.color}`,
                        fontSize: 9, fontWeight: 800, color: node.color,
                      }}>→</div>
                      {i < lateralPath.length - 1 && (
                        <div style={{ width: 1.5, height: 18, background: '#D1FAE5' }} />
                      )}
                    </div>
                    <div style={{ paddingTop: 2, marginBottom: i < lateralPath.length - 1 ? 4 : 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#0A0A0A' }}>{node.label}</div>
                      <div style={{ fontSize: 9, color: '#6B7280' }}>{node.cond}</div>
                      {node.advice ? <div style={{ fontSize: 8, color: '#9CA3AF', marginTop: 2 }}>{node.advice}</div> : null}
                    </div>
                  </div>
                )) : (
                  <div style={{ fontSize: 9, color: '#9CA3AF' }}>暂未获取到横向转岗路径</div>
                )}
              </div>
            )}

            <button className="btn-primary" onClick={handleGenerateReport}>
              生成职业规划报告 →
            </button>
          </>
        )}
      </div>
    </>
  )
}
