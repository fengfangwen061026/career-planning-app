import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import MobileShell from '../components/MobileShell'
import { useMobileApp } from '../context/MobileAppContext'
import { studentAppApi } from '@shared/api/studentApp'
import type { MatchResultResponse } from '@shared/types/matching'
import type { CareerPathResponse, StudentRecommendationItem } from '@shared/types/studentApp'
import './MatchDetailPage.css'

type DetailData = StudentRecommendationItem | MatchResultResponse

function getDimensionScore(item: DetailData, key: 'basic' | 'skill' | 'competency' | 'potential') {
  return Math.round(Number(item.scores?.[key]?.score || 0))
}

function getDetailTitle(detail: DetailData) {
  if ('job_title' in detail && detail.job_title) {
    return detail.job_title
  }
  return detail.role_name || detail.job_snapshot?.title || '岗位匹配详情'
}

const MatchDetailPage: React.FC = () => {
  const navigate = useNavigate()
  const { matchId } = useParams<{ matchId: string }>()
  const {
    currentStudent,
    recommendations,
    selectedRecommendation,
    selectRecommendation,
    getMatchResultById,
  } = useMobileApp()

  const [detail, setDetail] = useState<DetailData | null>(selectedRecommendation)
  const [careerPath, setCareerPath] = useState<CareerPathResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!matchId) {
        setError('缺少匹配结果 ID')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        let nextDetail: DetailData | null =
          selectedRecommendation?.id === matchId
            ? selectedRecommendation
            : recommendations.find((item) => item.id === matchId) || null

        if (!nextDetail) {
          nextDetail = await getMatchResultById(matchId)
        }

        if (!mounted) {
          return
        }

        setDetail(nextDetail)
        if ('match_reasons' in nextDetail && 'job_profile_id' in nextDetail && 'total_score' in nextDetail) {
          selectRecommendation(nextDetail as StudentRecommendationItem)
        }

        if (currentStudent && nextDetail.job_profile_id) {
          const response = await studentAppApi.getCareerPath(currentStudent.id, nextDetail.job_profile_id)
          if (mounted) {
            setCareerPath(response.data)
          }
        }
      } catch (loadError) {
        if (!mounted) {
          return
        }
        const message = loadError instanceof Error ? loadError.message : '加载匹配详情失败'
        setError(message)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [currentStudent?.id, matchId, recommendations.length, selectedRecommendation?.id])

  const mainPath = Array.isArray(careerPath?.path?.main_path) ? (careerPath?.path?.main_path as Array<Record<string, unknown>>) : []
  const alternativePaths = Array.isArray(careerPath?.path?.alternative_paths)
    ? (careerPath?.path?.alternative_paths as Array<Record<string, unknown>>)
    : []
  const actionPlan = Array.isArray(careerPath?.path?.action_plan) ? (careerPath?.path?.action_plan as Array<Record<string, unknown>>) : []
  const skillItems = detail?.scores?.skill?.items || []

  return (
    <MobileShell hasTabBar activeTab="explore">
      <div
        style={{
          minHeight: '100%',
          padding: '18px 18px 120px',
          background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 42%)',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/explore')}
          style={{ border: 'none', background: 'transparent', color: '#475569', fontWeight: 700, padding: 0 }}
        >
          返回岗位探索
        </button>

        {loading && <div style={{ marginTop: 18, color: '#334155' }}>正在加载匹配详情...</div>}

        {error && (
          <div
            style={{
              marginTop: 18,
              borderRadius: 20,
              padding: '16px 18px',
              background: '#fef2f2',
              color: '#b91c1c',
              lineHeight: 1.7,
            }}
          >
            {error}
          </div>
        )}

        {!loading && detail && (
          <div style={{ display: 'grid', gap: 16, marginTop: 14 }}>
            <div
              style={{
                borderRadius: 26,
                padding: 20,
                background: '#ffffff',
                border: '1px solid #dbeafe',
                boxShadow: '0 14px 30px rgba(15, 23, 42, 0.05)',
              }}
            >
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
                    {getDetailTitle(detail)}
                  </div>
                  <div style={{ marginTop: 8, color: '#475569', fontSize: 13, lineHeight: 1.7 }}>
                    {[detail.role_category, detail.job_snapshot?.city, detail.job_snapshot?.company_name].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div
                  style={{
                    width: 'fit-content',
                    borderRadius: 22,
                    padding: '12px 12px',
                    background: '#eef2ff',
                    color: '#4338ca',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 28, fontWeight: 800 }}>{Math.round(detail.total_score)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>综合匹配</div>
                </div>
              </div>

              {detail.job_snapshot && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  {[...(detail.job_snapshot.industries || []), ...(detail.job_snapshot.benefits || [])].slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        borderRadius: 999,
                        padding: '8px 10px',
                        background: '#f8fafc',
                        color: '#334155',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                borderRadius: 24,
                padding: 18,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>四维评分</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: '基础要求', value: getDimensionScore(detail, 'basic'), color: '#1d4ed8' },
                  { label: '技能匹配', value: getDimensionScore(detail, 'skill'), color: '#2563eb' },
                  { label: '职业素养', value: getDimensionScore(detail, 'competency'), color: '#10b981' },
                  { label: '发展潜力', value: getDimensionScore(detail, 'potential'), color: '#f59e0b' },
                ].map((dimension) => (
                  <div
                    key={dimension.label}
                    style={{
                      borderRadius: 18,
                      padding: 14,
                      background: '#f8fafc',
                    }}
                  >
                    <div style={{ color: '#475569', fontSize: 12, fontWeight: 700 }}>{dimension.label}</div>
                    <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: dimension.color }}>{dimension.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                borderRadius: 24,
                padding: 18,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>技能匹配</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {skillItems.map((item) => {
                  const matched = Boolean(item.matched)
                  return (
                    <span
                      key={`${item.skill_name}-${item.importance}`}
                      style={{
                        borderRadius: 999,
                        padding: '10px 12px',
                        background: matched ? '#ecfdf5' : '#fff7ed',
                        color: matched ? '#166534' : '#9a3412',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {item.skill_name} · {matched ? '已命中' : '待补齐'}
                    </span>
                  )
                })}
                {skillItems.length === 0 && <span style={{ color: '#64748b', fontSize: 13 }}>当前匹配结果没有返回细化技能条目。</span>}
              </div>
            </div>

            <div
              style={{
                borderRadius: 24,
                padding: 18,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>差距清单</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {(detail.gaps || []).map((gap, index) => (
                  <div
                    key={`${gap.gap_item}-${index}`}
                    style={{
                      borderRadius: 18,
                      padding: 14,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{gap.gap_item}</div>
                      <div style={{ color: '#b45309', fontSize: 12, fontWeight: 700 }}>{gap.priority}</div>
                    </div>
                    <div style={{ marginTop: 8, color: '#475569', fontSize: 12, lineHeight: 1.7 }}>
                      当前：{gap.current_level || '未知'} ｜ 目标：{gap.required_level || '未知'}
                    </div>
                    <div style={{ marginTop: 8, color: '#334155', fontSize: 13, lineHeight: 1.7 }}>{gap.suggestion}</div>
                  </div>
                ))}
                {!detail.gaps?.length && <div style={{ color: '#64748b', fontSize: 13 }}>当前没有明显差距项。</div>}
              </div>
            </div>

            <div
              style={{
                borderRadius: 24,
                padding: 18,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>职业路径</div>

              <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
                主路径目标：{String(careerPath?.path?.target_role || detail.role_name || '未命名岗位')}
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {mainPath.map((step, index) => (
                  <div
                    key={`${String(step.name || 'step')}-${index}`}
                    style={{
                      borderRadius: 18,
                      padding: 14,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      {index + 1}. {String(step.name || step.role_name || '路径节点')}
                    </div>
                    <div style={{ marginTop: 6, color: '#475569', fontSize: 12 }}>
                      {String(step.level || '')}
                    </div>
                    {Boolean(step.edge) && (
                      <div style={{ marginTop: 8, color: '#334155', fontSize: 13, lineHeight: 1.7 }}>
                        {String((step.edge as Record<string, unknown>).description || '该节点由图谱路径推导而来。')}
                      </div>
                    )}
                  </div>
                ))}
                {!mainPath.length && <div style={{ color: '#64748b', fontSize: 13 }}>当前没有可展示的主路径。</div>}
              </div>

              {alternativePaths.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>备选转岗路径</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {alternativePaths.map((path, index) => (
                      <div
                        key={`${String(path.intermediate_role || 'alternative')}-${index}`}
                        style={{
                          borderRadius: 18,
                          padding: 14,
                          background: '#eef6ff',
                          color: '#1e3a8a',
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{String(path.intermediate_role || '备选方向')}</div>
                        <div style={{ marginTop: 6, fontSize: 13 }}>预计步骤数：{String(path.steps || '未知')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {actionPlan.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>行动计划</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {actionPlan.map((item, index) => (
                      <div
                        key={`${String(item.step || 'plan')}-${index}`}
                        style={{
                          borderRadius: 18,
                          padding: 14,
                          background: '#fff7ed',
                          color: '#9a3412',
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>步骤 {String(item.step || index + 1)}</div>
                        <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.7 }}>
                          {Array.isArray(item.actions)
                            ? (item.actions as string[]).join('；')
                            : String(item.target || item.description || '继续补齐目标岗位要求')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate('/report')}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: 18,
                padding: '16px 18px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              基于该岗位生成职业规划报告
            </button>
          </div>
        )}
      </div>
    </MobileShell>
  )
}

export default MatchDetailPage
