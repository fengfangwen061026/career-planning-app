import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

import MobileShell from '../components/MobileShell'
import { useMobileApp } from '../context/MobileAppContext'
import { reportsApi } from '@shared/api/reports'
import type { CareerReportResponse } from '@shared/types/report'
import './ReportPage.css'

interface ReportSection {
  title?: string
  content?: string
  key_points?: string[]
}

interface ReportTable {
  title?: string
  headers?: string[]
  rows?: Array<Array<string | number | null>>
}

interface ReportChapter {
  chapter_id?: number
  title?: string
  sections?: ReportSection[]
  tables?: ReportTable[]
}

interface RecommendationItem {
  type?: string
  title?: string
  content?: string
}

function formatDateTime(value?: string) {
  if (!value) {
    return '未生成'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
  })
}

function extractFileName(headerValue: string | undefined, fallback: string) {
  if (!headerValue) {
    return fallback
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const plainMatch = headerValue.match(/filename="?([^"]+)"?/i)
  if (plainMatch?.[1]) {
    return plainMatch[1]
  }

  return fallback
}

function getChapters(report: CareerReportResponse | null): ReportChapter[] {
  const value = report?.content_json?.chapters
  return Array.isArray(value) ? (value as ReportChapter[]) : []
}

function getRecommendations(report: CareerReportResponse | null): RecommendationItem[] {
  return Array.isArray(report?.recommendations) ? (report?.recommendations as RecommendationItem[]) : []
}

const ReportPage: React.FC = () => {
  const navigate = useNavigate()
  const {
    profile,
    currentStudent,
    reports,
    currentReport,
    selectedRecommendation,
    isLoadingReports,
    refreshReports,
    generateReport,
    polishReport,
    checkReportCompleteness,
  } = useMobileApp()

  const [activeReportId, setActiveReportId] = useState<string | null>(null)
  const [loadingError, setLoadingError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'docx' | null>(null)
  const [polishing, setPolishing] = useState(false)
  const [checkResult, setCheckResult] = useState<{
    complete: boolean
    missing_items: string[]
    suggestions: string[]
  } | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadReports() {
      if (!currentStudent) {
        return
      }

      setLoadingError('')
      try {
        await refreshReports()
      } catch (error) {
        if (!mounted) {
          return
        }
        const message = error instanceof Error ? error.message : '加载报告失败'
        setLoadingError(message)
      }
    }

    void loadReports()
    return () => {
      mounted = false
    }
  }, [currentStudent?.id])

  useEffect(() => {
    if (!activeReportId && currentReport?.id) {
      setActiveReportId(currentReport.id)
    }
  }, [activeReportId, currentReport?.id])

  useEffect(() => {
    setCheckResult(null)
  }, [activeReportId])

  const activeReport =
    reports.find((item) => item.id === activeReportId) ||
    currentReport ||
    reports[0] ||
    null

  const chapters = getChapters(activeReport)
  const recommendationItems = getRecommendations(activeReport)
  const reportScopeLabel = selectedRecommendation?.role_name || selectedRecommendation?.job_snapshot?.title || '当前画像'

  async function handleGenerate() {
    setGenerating(true)
    setLoadingError('')

    try {
      const report = await generateReport(
        selectedRecommendation?.job_profile_id ? [selectedRecommendation.job_profile_id] : undefined,
      )
      setActiveReportId(report.id)
      await refreshReports()
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成报告失败'
      setLoadingError(message)
    } finally {
      setGenerating(false)
    }
  }

  async function handlePolish() {
    if (!activeReport) return
    setPolishing(true)
    setLoadingError('')
    try {
      await polishReport(activeReport.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : '润色失败'
      setLoadingError(message)
    } finally {
      setPolishing(false)
    }
  }

  async function handleCheck() {
    if (!activeReport) return
    setLoadingError('')
    try {
      const result = await checkReportCompleteness(activeReport.id)
      setCheckResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : '检查失败'
      setLoadingError(message)
    }
  }

  async function handleExport(format: 'pdf' | 'docx') {
    if (!activeReport) {
      return
    }

    setExportingFormat(format)
    setLoadingError('')

    try {
      const response = await reportsApi.exportReport({
        report_id: activeReport.id,
        format,
      })
      const blob = response.data as Blob
      const fallbackName = `career-report-${activeReport.id}.${format}`
      const filename = extractFileName(response.headers['content-disposition'], fallbackName)
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? ((error.response?.data as { detail?: string } | undefined)?.detail || error.message || '导出失败')
        : error instanceof Error
          ? error.message
          : '导出失败'
      setLoadingError(message)
    } finally {
      setExportingFormat(null)
    }
  }

  if (!profile) {
    return (
      <MobileShell hasTabBar activeTab="report">
        <div
          style={{
            padding: '24px 18px 120px',
            background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 45%)',
            minHeight: '100%',
          }}
        >
          <div
            style={{
              borderRadius: 11,
              padding: 22,
              background: '#ffffff',
              border: '1px solid #dbeafe',
              boxShadow: '0 14px 32px rgba(15, 23, 42, 0.06)',
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0A0A0A', lineHeight: 1.2 }}>
              还不能生成职业报告
            </div>
            <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.7, marginTop: 10 }}>
              先上传简历并生成学生画像，报告页才会使用真实匹配结果和职业路径生成完整内容。
            </p>
            <button
              type="button"
              onClick={() => navigate('/upload')}
              style={{
                marginTop: 14,
                border: 'none',
                borderRadius: 16,
                padding: '14px 16px',
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
    <MobileShell hasTabBar activeTab="report">
      <div
        style={{
          padding: '20px 18px 120px',
          background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 42%)',
          minHeight: '100%',
          display: 'grid',
          gap: 16,
        }}
      >
        <div
          style={{
            borderRadius: 26,
            padding: 20,
            background: '#ffffff',
            border: '1px solid #dbeafe',
            boxShadow: '0 14px 30px rgba(15, 23, 42, 0.05)',
          }}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0A0A0A', lineHeight: 1.2 }}>职业发展报告</div>
              <div style={{ marginTop: 10, color: '#374151', fontSize: 13, lineHeight: 1.7 }}>
                当前学生：{currentStudent?.name || currentStudent?.email || '未命名学生'}
                <br />
                生成范围：{selectedRecommendation ? `围绕「${reportScopeLabel}」生成` : '基于当前画像与推荐岗位生成'}
              </div>
            </div>
            <div
              style={{
                width: 'fit-content',
                borderRadius: 999,
                padding: '8px 12px',
                background: activeReport ? '#eef2ff' : '#f8fafc',
                color: activeReport ? '#4338ca' : '#6B7280',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {activeReport ? `v${activeReport.version || '1.0'}` : '暂无报告'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              style={{
                border: 'none',
                borderRadius: 16,
                padding: '13px 16px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
                color: '#ffffff',
                fontWeight: 800,
              }}
            >
              {generating ? '正在生成报告...' : selectedRecommendation ? '为当前岗位生成报告' : '生成最新报告'}
            </button>
            <button
              type="button"
              onClick={() => refreshReports().catch((error: unknown) => {
                const message = error instanceof Error ? error.message : '刷新报告失败'
                setLoadingError(message)
              })}
              disabled={isLoadingReports}
              style={{
                borderRadius: 16,
                padding: '13px 16px',
                background: '#ffffff',
                color: '#334155',
                fontWeight: 700,
                border: '1px solid #cbd5e1',
              }}
            >
              {isLoadingReports ? '刷新中...' : '刷新列表'}
            </button>
          </div>

          {loadingError && (
            <div
              style={{
                marginTop: 14,
                borderRadius: 16,
                padding: '12px 14px',
                background: '#fef2f2',
                color: '#b91c1c',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {loadingError}
            </div>
          )}
        </div>

        {reports.length > 0 && (
          <div
            style={{
              borderRadius: 11,
              padding: 18,
              background: '#ffffff',
              border: '1px solid #E5E7EB',
            }}
          >
            <div style={{ fontWeight: 800, color: '#0A0A0A', marginBottom: 12 }}>历史报告</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {reports.map((report) => {
                const selected = report.id === activeReport?.id
                return (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => setActiveReportId(report.id)}
                    style={{
                      textAlign: 'left',
                      borderRadius: 18,
                      padding: '14px 16px',
                      background: selected ? '#eef2ff' : '#f8fafc',
                      border: `1px solid ${selected ? '#c7d2fe' : '#E5E7EB'}`,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#0A0A0A' }}>
                      {report.title || report.summary || '职业发展报告'}
                    </div>
                    <div style={{ marginTop: 6, color: '#374151', fontSize: 12, lineHeight: 1.6 }}>
                      创建时间：{formatDateTime(report.created_at)}
                      <br />
                      状态：{report.status || 'completed'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {generating && (
          <div
            style={{
              borderRadius: 11,
              padding: 18,
              background: '#ffffff',
              border: '1px solid #E5E7EB',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="skeleton-line" style={{ height: 20, width: '60%', borderRadius: 4 }} />
              <div className="skeleton-line" style={{ height: 14, width: '40%', borderRadius: 4 }} />
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--color-surface)',
                    borderRadius: 11,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div className="skeleton-line" style={{ height: 16, width: '50%', borderRadius: 4 }} />
                  <div className="skeleton-line" style={{ height: 11, width: '100%', borderRadius: 4 }} />
                  <div className="skeleton-line" style={{ height: 11, width: '80%', borderRadius: 4 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {!generating && !activeReport && !isLoadingReports && (
          <div
            style={{
              borderRadius: 11,
              padding: 18,
              background: '#ffffff',
              border: '1px solid #E5E7EB',
              color: '#374151',
              lineHeight: 1.7,
            }}
          >
            还没有可查看的报告。你可以直接生成一份新的职业发展报告，系统会复用现有画像、推荐和职业路径服务。
          </div>
        )}

        {activeReport && (
          <>
            <div
              style={{
                borderRadius: 11,
                padding: 18,
                background: '#ffffff',
                border: '1px solid #E5E7EB',
              }}
            >
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <div className="report-header-title">
                    {activeReport.title || '职业发展报告'}
                  </div>
                  <div style={{ marginTop: 8, color: '#374151', fontSize: 12, lineHeight: 1.7 }}>
                    更新时间：{formatDateTime(activeReport.updated_at)}
                    <br />
                    创建时间：{formatDateTime(activeReport.created_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 0 16px' }}>
                  {/* 主按钮：导出 PDF */}
                  <button
                    type="button"
                    onClick={() => handleExport('pdf')}
                    disabled={exportingFormat !== null}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 11,
                      background: '#4F46E5',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {exportingFormat === 'pdf' ? '导出中...' : '导出 PDF'}
                  </button>
                  {/* 次要按钮：导出 DOCX */}
                  <button
                    type="button"
                    onClick={() => handleExport('docx')}
                    disabled={exportingFormat !== null}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 11,
                      background: 'transparent',
                      color: '#4F46E5',
                      fontSize: 13,
                      fontWeight: 600,
                      border: '1.5px solid #4F46E5',
                      cursor: 'pointer',
                    }}
                  >
                    {exportingFormat === 'docx' ? '导出中...' : '导出 Word'}
                  </button>
                  {/* 行动项：文字行 */}
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', paddingTop: 4 }}>
                    <button
                      type="button"
                      onClick={handlePolish}
                      disabled={polishing || exportingFormat !== null}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 11,
                        color: '#6B7280',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {polishing ? '润色中...' : '✨ 润色报告'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCheck}
                      disabled={polishing || exportingFormat !== null}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 11,
                        color: '#6B7280',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      🔍 质量检查
                    </button>
                  </div>
                </div>
              </div>

              {checkResult && (
                <div
                  style={{
                    marginTop: 14,
                    borderRadius: 16,
                    padding: '14px 16px',
                    background: checkResult.complete ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${checkResult.complete ? '#86efac' : '#fca5a5'}`,
                  }}
                >
                  <div style={{ fontWeight: 700, color: checkResult.complete ? '#166534' : '#b91c1c' }}>
                    {checkResult.complete ? '报告完整 ✓' : '报告存在缺失项'}
                  </div>
                  {checkResult.missing_items.length > 0 && (
                    <ul style={{ margin: '8px 0 0', paddingLeft: 16, color: '#b91c1c', fontSize: 13, lineHeight: 1.7 }}>
                      {checkResult.missing_items.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {activeReport.summary && (
                <div
                  style={{
                    marginTop: 16,
                    borderRadius: 18,
                    padding: '14px 16px',
                    background: '#f8fafc',
                    color: '#334155',
                    lineHeight: 1.8,
                    fontSize: 14,
                  }}
                >
                  {activeReport.summary}
                </div>
              )}
            </div>

            {recommendationItems.length > 0 && (
              <div
                style={{
                  borderRadius: 11,
                  padding: 18,
                  background: '#ffffff',
                  border: '1px solid #E5E7EB',
                }}
              >
                <div style={{ fontWeight: 800, color: '#0A0A0A', marginBottom: 12 }}>行动建议</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recommendationItems.map((item, index) => {
                    const priority = (item as { priority?: string }).priority || 'medium'
                    const PRIORITY_COLOR: Record<string, string> = {
                      high: '#EF4444',
                      medium: '#F59E0B',
                      low: '#10B981',
                    }
                    return (
                      <div
                        key={`${item.title || 'recommendation'}-${index}`}
                        style={{
                          borderRadius: 11,
                          padding: '12px 14px',
                          marginBottom: 8,
                          borderLeft: `3px solid ${PRIORITY_COLOR[priority] ?? '#4F46E5'}`,
                          background: '#f8fafc',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#0A0A0A', fontSize: 11 }}>
                          {item.title || '建议'}
                        </div>
                        <div style={{ marginTop: 4, color: '#374151', fontSize: 10, lineHeight: 1.5 }}>
                          {item.content || '暂无详细建议'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {chapters.map((chapter, chapterIndex) => (
                <div
                  key={`${chapter.title || 'chapter'}-${chapterIndex}`}
                  style={{
                    background: 'var(--color-surface)',
                    borderRadius: 11,
                    padding: '14px 16px',
                    marginBottom: 12,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  {/* 章节标题 */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0A0A0A', marginBottom: 8 }}>
                    {chapter.title || `章节 ${chapterIndex + 1}`}
                  </div>
                  {/* 正文 */}
                  <div style={{ fontSize: 10, color: '#374151', lineHeight: 1.6 }}>
                    {(chapter as { content?: string }).content || ''}
                  </div>
                  {/* sections 渲染 */}
                  {(chapter.sections || []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      {(chapter.sections || []).map((section, sectionIndex) => (
                        <div key={`${section.title || 'section'}-${sectionIndex}`}>
                          {section.title && (
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                              {section.title}
                            </div>
                          )}
                          {section.content && (
                            <div style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.5 }}>
                              {section.content}
                            </div>
                          )}
                          {Array.isArray(section.key_points) && section.key_points.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                              {section.key_points.map((point, pointIndex) => (
                                <span
                                  key={`${point}-${pointIndex}`}
                                  style={{
                                    fontSize: 9,
                                    padding: '2px 8px',
                                    borderRadius: 20,
                                    background: '#EEF2FF',
                                    color: '#4F46E5',
                                    border: '1px solid #C7D2FE',
                                  }}
                                >
                                  {point}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* tables 渲染 */}
                  {(chapter.tables || []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                      {(chapter.tables || []).map((table, tableIndex) => (
                        <div
                          key={`${table.title || 'table'}-${tableIndex}`}
                          style={{
                            borderRadius: 11,
                            padding: '12px',
                            background: '#f8fafc',
                            overflowX: 'auto',
                            WebkitOverflowScrolling: 'touch',
                          }}
                        >
                          {table.title && (
                            <div style={{ fontWeight: 700, color: '#0A0A0A', marginBottom: 8, fontSize: 11 }}>
                              {table.title}
                            </div>
                          )}
                          <table style={{ minWidth: 520, borderCollapse: 'collapse', fontSize: 10 }}>
                            <thead>
                              <tr>
                                {(table.headers || []).map((header) => (
                                  <th
                                    key={header}
                                    style={{
                                      textAlign: 'left',
                                      padding: '6px 8px',
                                      borderBottom: '1px solid #cbd5e1',
                                      color: '#374151',
                                      fontWeight: 700,
                                    }}
                                  >
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(table.rows || []).map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  {row.map((cell, cellIndex) => (
                                    <td
                                      key={`${rowIndex}-${cellIndex}`}
                                      style={{
                                        padding: '6px 8px',
                                        borderBottom: '1px solid #E5E7EB',
                                        color: '#334155',
                                        verticalAlign: 'top',
                                      }}
                                    >
                                      {cell == null ? '-' : String(cell)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* key_points Tag列表 - 章节级别 */}
                  {Array.isArray((chapter as { key_points?: string[] }).key_points) && (chapter as { key_points?: string[] }).key_points!.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {(chapter as { key_points?: string[] }).key_points!.map((pt, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 9,
                            padding: '2px 8px',
                            borderRadius: 20,
                            background: '#EEF2FF',
                            color: '#4F46E5',
                            border: '1px solid #C7D2FE',
                          }}
                        >
                          {pt}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* 空内容提示 */}
                  {(chapter.sections || []).length === 0 &&
                    (chapter.tables || []).length === 0 &&
                    !(chapter as { content?: string }).content &&
                    !(chapter as { key_points?: string[] }).key_points && (
                      <div style={{ marginTop: 8, color: '#9CA3AF', fontSize: 10 }}>
                        该章节暂无可展示内容
                      </div>
                    )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </MobileShell>
  )
}

export default ReportPage
