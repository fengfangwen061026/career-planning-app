import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import TabBar from '../../components/TabBar/TabBar'
import { readSSE } from '../../api/client'
import { session } from '../../store/session'

interface ChapterData {
  chapter_index: number
  title: string
  text: string | null
  data: unknown
}

interface ReportState {
  status: 'idle' | 'generating' | 'complete' | 'error'
  progress: number
  message: string
  chapters: ChapterData[]
  reportId: string | null
  errorMsg: string
}

interface ReportResponse {
  content_json?: {
    chapters?: Array<{
      chapter_id?: number
      title?: string
      text?: string | null
      data?: unknown
    }>
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sortChapters(chapters: ChapterData[]): ChapterData[] {
  return [...chapters].sort((a, b) => a.chapter_index - b.chapter_index)
}

function getChapterPayload(chapter: ChapterData | undefined): unknown {
  if (!chapter) {
    return null
  }
  if (isRecord(chapter.data) && 'json_data' in chapter.data) {
    return chapter.data.json_data
  }
  return chapter.data
}

function chapterFromEvent(event: Record<string, unknown>): ChapterData {
  const rawData = isRecord(event.data) ? event.data : null
  return {
    chapter_index: Number(event.chapter_index || rawData?.chapter_id || 0),
    title: String(rawData?.title || `第${event.chapter_index}章`),
    text: typeof rawData?.text === 'string' ? rawData.text : null,
    data: rawData?.data ?? rawData ?? null,
  }
}

export default function ReportPage() {
  const navigate = useNavigate()
  const generatingRef = useRef(false)
  const [state, setState] = useState<ReportState>({
    status: 'idle',
    progress: 0,
    message: '',
    chapters: [],
    reportId: null,
    errorMsg: '',
  })
  const [activeChapter, setActiveChapter] = useState(1)
  const [planStage, setPlanStage] = useState<'short_term' | 'medium_term'>('short_term')

  const generateReport = async () => {
    if (generatingRef.current) {
      return
    }

    const studentId = session.getStudentId()
    if (!studentId) {
      navigate('/onboarding')
      return
    }

    generatingRef.current = true
    const jobProfileId = session.getTargetJobProfileId()

    setState({
      status: 'generating',
      progress: 5,
      message: '正在准备报告...',
      chapters: [],
      reportId: null,
      errorMsg: '',
    })

    try {
      let path = `/reports/generate/stream?student_id=${studentId}`
      if (jobProfileId) {
        path += `&job_profile_id=${jobProfileId}`
      }

      for await (const rawEvent of readSSE(path, 'POST')) {
        const event = rawEvent as Record<string, unknown>

        if (event.type === 'stage') {
          setState(prev => ({
            ...prev,
            status: 'generating',
            progress: Number(event.progress) || prev.progress,
            message: typeof event.message === 'string' ? event.message : prev.message,
          }))
        }

        if (event.type === 'chapter') {
          const chapter = chapterFromEvent(event)
          setState(prev => ({
            ...prev,
            status: 'generating',
            progress: Number(event.progress) || prev.progress,
            message: typeof event.message === 'string' ? event.message : prev.message,
            chapters: sortChapters([
              ...prev.chapters.filter(item => item.chapter_index !== chapter.chapter_index),
              chapter,
            ]),
          }))
        }

        if (event.type === 'complete') {
          const reportPayload = isRecord(event.data) && isRecord(event.data.report)
            ? event.data.report
            : null
          const reportId = typeof reportPayload?.id === 'string' ? reportPayload.id : null
          if (reportId) {
            session.setReportId(reportId)
          }
          setState(prev => ({
            ...prev,
            status: 'complete',
            progress: 100,
            message: typeof event.message === 'string' ? event.message : '报告生成完成',
            reportId,
          }))
        }

        if (event.type === 'error') {
          throw new Error(typeof event.message === 'string' ? event.message : '生成失败')
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '服务器繁忙，请稍后重试'
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMsg: msg,
      }))
    } finally {
      generatingRef.current = false
    }
  }

  const loadExistingReport = async (reportId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/reports/${reportId}`)
      if (!res.ok) {
        return false
      }
      const report = await res.json() as ReportResponse
      const chapters = sortChapters(
        (report.content_json?.chapters || []).map(chapter => ({
          chapter_index: Number(chapter.chapter_id || 0),
          title: chapter.title || '',
          text: chapter.text || null,
          data: chapter.data ?? null,
        })),
      )

      if (chapters.length === 0) {
        return false
      }

      setActiveChapter(chapters[0].chapter_index || 1)
      setState({
        status: 'complete',
        progress: 100,
        message: '报告加载完成',
        chapters,
        reportId,
        errorMsg: '',
      })
      return true
    } catch {
      return false
    }
  }

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      const studentId = session.getStudentId()
      if (!studentId) {
        navigate('/onboarding')
        return
      }

      const existingReportId = session.getReportId()
      if (existingReportId) {
        const loaded = await loadExistingReport(existingReportId)
        if (loaded || cancelled) {
          return
        }
        session.setReportId('')
      }

      if (!cancelled) {
        await generateReport()
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleExport = () => {
    if (!state.reportId) {
      return
    }
    window.open(`/api/reports/${state.reportId}/export?format=html`, '_blank')
  }

  const activeChapterData = state.chapters.find(chapter => chapter.chapter_index === activeChapter)
  const payload = getChapterPayload(activeChapterData)
  const chapterList = [
    { index: 1, title: '一、个人优势总结' },
    { index: 2, title: '二、目标岗位分析' },
    { index: 3, title: '三、差距与行动计划' },
    { index: 4, title: '四、职业路径规划' },
    { index: 5, title: '五、评估周期' },
  ]

  return (
    <>
      <div style={{ padding: '10px 12px', background: 'white', borderBottom: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.4px', color: '#0A0A0A' }}>职业发展报告</div>
          <div style={{ fontSize: 9, color: '#6B7280', marginTop: 2 }}>{session.getName()} · AI 实时生成</div>
        </div>
        <button
          onClick={handleExport}
          disabled={state.status !== 'complete' || !state.reportId}
          style={{
            padding: '5px 12px', background: state.status === 'complete' ? '#4F46E5' : '#F3F4F6',
            color: state.status === 'complete' ? '#fff' : '#9CA3AF', border: 'none', borderRadius: 7,
            fontSize: 9, fontWeight: 700, cursor: state.status === 'complete' ? 'pointer' : 'not-allowed',
          }}
        >
          {state.status === 'complete' ? '↓ 导出' : '生成中'}
        </button>
      </div>

      <div className="scroll-body" style={{ padding: '10px 12px' }}>
        {state.status === 'generating' && (
          <>
            <div className="card" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0A0A0A' }}>生成进度</div>
                <div style={{ fontSize: 9, color: '#4F46E5', fontWeight: 700 }}>{state.progress}%</div>
              </div>
              <div style={{ height: 4, background: '#E5E7EB', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ width: `${state.progress}%`, height: '100%', background: '#4F46E5', borderRadius: 999, transition: 'width 0.25s ease' }} />
              </div>
              <div style={{ fontSize: 9, color: '#6B7280' }}>{state.message || '正在生成...'}</div>
            </div>

            {chapterList.map(chapter => {
              const existing = state.chapters.find(item => item.chapter_index === chapter.index)
              if (existing) {
                return (
                  <div key={chapter.index} style={{ background: 'white', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: 11, marginBottom: 7, animation: 'fadeIn 0.4s ease forwards' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.2px' }}>{chapter.title}</div>
                      <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 8, fontWeight: 600, background: '#D1FAE5', color: '#065F46' }}>已生成</span>
                    </div>
                    <div style={{ fontSize: 9, color: '#374151', lineHeight: 1.9 }}>{existing.text || '章节内容已生成'}</div>
                  </div>
                )
              }

              return (
                <div key={chapter.index} style={{ background: 'white', border: '0.5px solid rgba(79,70,229,0.2)', borderRadius: 10, padding: 11, marginBottom: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#0A0A0A' }}>{chapter.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4F46E5', animation: 'pulse 1s infinite' }} />
                      <span style={{ fontSize: 8, color: '#4F46E5', fontWeight: 600 }}>生成中</span>
                    </div>
                  </div>
                  {['90%', '100%', '75%'].map((w, i) => (
                    <div key={i} className="skeleton" style={{ height: 8, width: w, marginBottom: i < 2 ? 5 : 0 }} />
                  ))}
                </div>
              )
            })}
          </>
        )}

        {state.status === 'error' && (
          <div className="card">
            <div style={{ fontSize: 10, color: '#EF4444', marginBottom: 8 }}>{state.errorMsg || '服务器繁忙，请稍后重试'}</div>
            <button className="btn-primary" onClick={() => { void generateReport() }}>
              重新生成
            </button>
          </div>
        )}

        {state.status === 'complete' && (
          <>
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 8 }}>
              {chapterList.map(chapter => (
                <button
                  key={chapter.index}
                  onClick={() => setActiveChapter(chapter.index)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    border: activeChapter === chapter.index ? 'none' : '0.5px solid #E5E7EB',
                    background: activeChapter === chapter.index ? '#4F46E5' : 'white',
                    color: activeChapter === chapter.index ? 'white' : '#6B7280',
                    fontSize: 8,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {chapter.index}
                </button>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.2px' }}>
                  {activeChapterData?.title || '报告章节'}
                </div>
                <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 8, fontWeight: 600, background: '#D1FAE5', color: '#065F46' }}>已完成</span>
              </div>

              <div style={{ fontSize: 9, color: '#374151', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                {activeChapterData?.text || '暂无章节内容'}
              </div>

              {activeChapter === 2 && isRecord(payload) && Array.isArray(payload.dimensions) && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  {payload.dimensions.map((item, idx) => {
                    const dim = item as Record<string, unknown>
                    const color = idx === 0 ? '#1D4ED8' : idx === 1 ? '#3B82F6' : idx === 2 ? '#10B981' : '#D97706'
                    return (
                      <div key={String(dim.label || idx)} style={{ flex: 1, textAlign: 'center', padding: 5, background: '#F9FAFB', borderRadius: 7 }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color }}>{Number(dim.score || 0)}</div>
                        <div style={{ fontSize: 7, color: '#9CA3AF', marginTop: 1 }}>{String(dim.label || '')}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {activeChapter === 3 && isRecord(payload) && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    {[
                      { key: 'short_term', label: '短期 0–6月' },
                      { key: 'medium_term', label: '中期 6–18月' },
                    ].map(item => (
                      <button
                        key={item.key}
                        onClick={() => setPlanStage(item.key as 'short_term' | 'medium_term')}
                        style={{
                          flex: 1,
                          height: 28,
                          borderRadius: 7,
                          border: planStage === item.key ? 'none' : '0.5px solid #E5E7EB',
                          background: planStage === item.key ? '#4F46E5' : 'white',
                          color: planStage === item.key ? 'white' : '#6B7280',
                          fontSize: 9,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {((payload[planStage] as unknown[]) || []).length > 0 ? (
                    ((payload[planStage] as unknown[]) || []).map((item, idx) => {
                      const plan = item as Record<string, unknown>
                      const resources = Array.isArray(plan.resources) ? plan.resources.map(value => String(value)).join(' / ') : ''
                      return (
                        <div key={`${String(plan.item || idx)}-${idx}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 8px', background: planStage === 'short_term' ? '#D1FAE5' : '#FEF3C7', borderRadius: 7, marginBottom: 6 }}>
                          <div style={{ fontSize: 8, fontWeight: 700, color: planStage === 'short_term' ? '#065F46' : '#92400E', minWidth: 14 }}>{idx + 1}</div>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#0A0A0A' }}>{String(plan.item || '行动项')}</div>
                            <div style={{ fontSize: 9, color: '#374151', lineHeight: 1.6 }}>{String(plan.action || '')}</div>
                            <div style={{ fontSize: 8, color: '#6B7280', marginTop: 2 }}>
                              {String(plan.timeline || '')}{resources ? ` · ${resources}` : ''}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div style={{ fontSize: 9, color: '#9CA3AF' }}>该阶段暂无行动项</div>
                  )}
                </div>
              )}

              {activeChapter === 4 && isRecord(payload) && (
                <div style={{ marginTop: 8 }}>
                  {(Array.isArray(payload.primary_path) ? payload.primary_path : []).map((item, idx) => {
                    const pathItem = item as Record<string, unknown>
                    const current = Boolean(pathItem.is_current)
                    return (
                      <div key={`${String(pathItem.title || idx)}-${idx}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: current ? '#4F46E5' : 'white',
                            border: current ? 'none' : '1.5px solid #4F46E5',
                            fontSize: 8, fontWeight: 800, color: current ? 'white' : '#4F46E5',
                          }}>
                            {current ? '✓' : idx + 1}
                          </div>
                          {idx < (Array.isArray(payload.primary_path) ? payload.primary_path.length : 0) - 1 && <div style={{ width: 1.5, height: 14, background: '#E5E7EB' }} />}
                        </div>
                        <div style={{ paddingTop: 1 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: current ? '#4F46E5' : '#0A0A0A' }}>{String(pathItem.title || '')}</div>
                          <div style={{ fontSize: 8, color: '#6B7280' }}>{String(pathItem.condition || pathItem.stage || '')}</div>
                        </div>
                      </div>
                    )
                  })}

                  {Array.isArray(payload.alt_paths) && payload.alt_paths.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: '#9CA3AF', marginBottom: 6 }}>横向换岗建议</div>
                      {payload.alt_paths.map((item, idx) => {
                        const pathItem = item as Record<string, unknown>
                        return (
                          <div key={`${String(pathItem.title || idx)}-${idx}`} style={{ fontSize: 9, color: '#374151', marginBottom: 4 }}>
                            {String(pathItem.title || '相关岗位')} · 技能重叠 {Number(pathItem.skill_overlap || 0)}%
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeChapter === 5 && isRecord(payload) && Array.isArray(payload.review_checkpoints) && (
                <div style={{ marginTop: 8 }}>
                  {(payload.review_checkpoints as unknown[]).map((item, idx, arr) => {
                    const checkpoint = item as Record<string, unknown>
                    return (
                      <div key={`${String(checkpoint.month || idx)}-${idx}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: idx < arr.length - 1 ? '0.5px solid #E5E7EB' : 'none' }}>
                        <div style={{ minWidth: 32, height: 20, borderRadius: 10, background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700 }}>
                          {String(checkpoint.month || '')}月
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#0A0A0A' }}>{String(checkpoint.goal || '')}</div>
                          <div style={{ fontSize: 8, color: '#6B7280', lineHeight: 1.6 }}>KPI：{String(checkpoint.kpi || '')}</div>
                          <div style={{ fontSize: 8, color: '#6B7280', lineHeight: 1.6 }}>验证动作：{String(checkpoint.action || '')}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {state.status === 'complete' && (
        <div style={{ padding: '12px', borderTop: '0.5px solid #E5E7EB', background: 'white', flexShrink: 0 }}>
          <button
            onClick={handleExport}
            style={{
              width: '100%', padding: '10px', background: '#4F46E5',
              color: 'white', border: 'none', borderRadius: 8,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            导出完整报告
          </button>
        </div>
      )}
      <TabBar active="report" />
    </>
  )
}
