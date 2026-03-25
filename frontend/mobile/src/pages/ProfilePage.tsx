import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import MobileShell from '../components/MobileShell'
import { useMobileApp } from '../context/MobileAppContext'
import './ProfilePage.css'

function toPercentScore(value: unknown): number {
  if (typeof value === 'number') {
    return value <= 1 ? Math.round(value * 100) : Math.round(value)
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed)
    }
  }
  return 0
}

function proficiencyToScore(value: unknown): number {
  const map: Record<string, number> = {
    精通: 95,
    熟练: 88,
    掌握: 75,
    了解: 60,
    入门: 45,
  }
  return map[String(value || '')] || 65
}

function getSkillColor(pct: number): string {
  if (pct >= 80) return '#1D4ED8'
  if (pct >= 60) return '#3B82F6'
  if (pct >= 40) return '#60A5FA'
  return '#93C5FD'
}

const PILL_COLORS = [
  { bg: '#EEF2FF', text: '#4F46E5', border: '#C7D2FE' },
  { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
  { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  { bg: '#FDF4FF', text: '#9333EA', border: '#E9D5FF' },
];

const ProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    profile,
    currentStudent,
    recommendations,
    isLoadingProfile,
  } = useMobileApp()

  const [animated, setAnimated] = useState(false)
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    animTimerRef.current = setTimeout(() => setAnimated(true), 80)
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current)
    }
  }, [])

  const justUpdated = Boolean(location.state?.justUpdated)
  const profileJson = (profile?.profile_json || {}) as Record<string, unknown>
  const basicInfo = (profileJson.basic_info || {}) as Record<string, unknown>
  const skills = Array.isArray(profileJson.skills) ? profileJson.skills : []
  const experiences = Array.isArray(profileJson.experiences) ? profileJson.experiences : []
  const certificates = Array.isArray(profileJson.certificate_names)
    ? profileJson.certificate_names
    : Array.isArray(profileJson.certificates)
      ? (profileJson.certificates as Array<Record<string, unknown>>).map((item) => String(item.name || '')).filter(Boolean)
      : []
  const awards = Array.isArray(profileJson.awards)
    ? (profileJson.awards as Array<Record<string, unknown> | string>).map((item) =>
        typeof item === 'string' ? item : String(item.name || item.title || '')
      ).filter(Boolean)
    : []
  const softSkills = Array.isArray(profileJson.soft_skills) ? profileJson.soft_skills : []
  const missingSuggestions = profile?.missing_suggestions || []
  const completeness = Math.round(profile?.completeness_score || 0)
  const competitiveness = toPercentScore(profileJson.competitiveness_score)
  const strongMatches = recommendations.filter((item) => item.total_score >= 75).length

  const circumference = 132
  const ringOffset = circumference * (1 - competitiveness / 100)

  const nameStr = String(basicInfo.name || currentStudent?.name || profile?.name ?? profile?.student_name || '未命名同学')
  const avatarChar = nameStr.charAt(0)

  if (isLoadingProfile && !profile) {
    return (
      <MobileShell hasTabBar activeTab="profile">
        <div className="profile-content">
          <div className="skeleton-line" style={{ height: 60, marginBottom: 8 }} />
          <div className="skeleton-line" style={{ height: 100, marginBottom: 8 }} />
          <div className="skeleton-line" style={{ height: 120 }} />
        </div>
      </MobileShell>
    )
  }

  if (!profile) {
    return (
      <MobileShell hasTabBar activeTab="profile">
        <div className="profile-content">
          <div className="profile-card card-bounce pressable" style={{ '--ci': 0 } as React.CSSProperties}>
            <div className="profile-card-header">
              <div className="profile-card-indicator purple" />
              <span className="profile-card-title">尚未生成画像</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
              {currentStudent?.name || '当前学生'} 还没有学生画像，先上传简历，系统会自动完成解析和画像生成。
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => navigate('/upload')}
                className="profile-action-btn pressable"
                style={{ flex: 1 }}
              >
                去上传简历
              </button>
              <button
                type="button"
                onClick={() => navigate('/explore')}
                className="pressable"
                style={{
                  flex: 1,
                  border: '0.5px solid var(--color-border-primary)',
                  borderRadius: 9,
                  padding: 9,
                  background: 'white',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                }}
              >
                看看推荐页
              </button>
            </div>
          </div>
        </div>
      </MobileShell>
    )
  }

  return (
    <MobileShell hasTabBar activeTab="profile">
      <div className="profile-content">
        {/* Header */}
        <div className="profile-header page-header-anim">
          <div className="profile-avatar">{avatarChar}</div>
          <div className="profile-info">
            <div className="profile-name">{nameStr}</div>
            <div className="profile-subtitle">
              {[basicInfo.school, basicInfo.degree, basicInfo.major].filter(Boolean).join(' · ') || '已生成基础学生画像'}
            </div>
          </div>
          <div className={`profile-completeness-tag${justUpdated ? '' : ''}`} style={justUpdated ? { background: 'var(--color-success-bg)', color: 'var(--color-success-text)' } : {}}>
            {justUpdated && <span>✓ </span>}完整度 {completeness}%
          </div>
        </div>

        {/* Comprehensive score card with SVG ring */}
        <div className="profile-card comprehensive card-bounce pressable" style={{ '--ci': 0 } as React.CSSProperties}>
          <div className="profile-score-ring">
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="21" stroke="#E5E7EB" strokeWidth="5" fill="none" />
              <circle
                cx="26" cy="26" r="21"
                stroke="var(--color-primary)" strokeWidth="5" fill="none"
                strokeDasharray={String(circumference)}
                strokeDashoffset={animated ? ringOffset : circumference}
                strokeLinecap="round"
                transform="rotate(-90 26 26)"
                style={{ transition: 'stroke-dashoffset 0.8s var(--spring-smooth)' }}
              />
            </svg>
            <div className="profile-score-text">
              <span className="profile-score-value">{competitiveness}</span>
              <span className="profile-score-label">竞争力</span>
            </div>
          </div>
          <div className="profile-score-data">
            <div className="profile-data-row">
              <span className="profile-data-label">高匹配岗位</span>
              <span className="profile-data-value success">{strongMatches} 个</span>
            </div>
            <div className="profile-data-row">
              <span className="profile-data-label">待补全项</span>
              <span className="profile-data-value warning">{missingSuggestions.length} 条</span>
            </div>
            <div className="profile-data-progress">
              <div
                className="profile-data-progress-fill"
                style={{
                  width: animated ? `${completeness}%` : '0%',
                  transition: 'width 0.8s var(--spring-smooth)',
                  background: completeness >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Skills card */}
        <div className="profile-card card-bounce pressable" style={{ '--ci': 1 } as React.CSSProperties}>
          <div className="profile-card-header">
            <div className="profile-card-indicator blue" />
            <span className="profile-card-title">技能画像</span>
          </div>
          <div className="skill-list">
            {(skills as Array<Record<string, unknown>>).slice(0, 6).map((skill, index) => {
              const score = proficiencyToScore(skill.proficiency || skill.level)
              const color = getSkillColor(score)
              return (
                <div key={`${String(skill.name || 'skill')}-${index}`} className="skill-row">
                  <span className="skill-name">{String(skill.name || '技能').slice(0, 4)}</span>
                  <div className="skill-track">
                    <div
                      className="skill-fill"
                      style={{
                        width: animated ? `${score}%` : '0%',
                        background: color,
                        transition: `width 0.7s var(--spring-smooth) ${index * 80}ms`,
                      }}
                    />
                  </div>
                  <span className="skill-value">{score}%</span>
                </div>
              )
            })}
            {skills.length === 0 && (
              <div style={{ color: 'var(--color-text-tertiary)', fontSize: 10 }}>当前画像还没有识别出明确技能。</div>
            )}
          </div>
        </div>

        {/* Experiences card */}
        {experiences.length > 0 && (
          <div className="profile-card card-bounce pressable" style={{ '--ci': 2 } as React.CSSProperties}>
            <div className="profile-card-header">
              <div className="profile-card-indicator green" />
              <span className="profile-card-title">项目与经历</span>
            </div>
            {(experiences as Array<Record<string, unknown>>).slice(0, 5).map((experience, index) => (
              <div key={`${String(experience.title || 'exp')}-${index}`} className="experience-item">
                {index > 0 && <div className="experience-divider" />}
                <div className="experience-title">{String(experience.title || '未命名经历')}</div>
                <div className="experience-duration">
                  {[experience.type, experience.company, experience.duration].filter(Boolean).join(' · ')}
                </div>
                {Boolean(experience.description) && (
                  <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', lineHeight: 1.6 }}>
                    {String(experience.description)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Certs, awards, soft skills */}
        <div className="profile-card card-bounce pressable" style={{ '--ci': 3 } as React.CSSProperties}>
          <div className="profile-card-header">
            <div className="profile-card-indicator orange" />
            <span className="profile-card-title">证书与软技能</span>
          </div>
          {([...certificates, ...awards] as string[]).length > 0 && (
            <div className="tags-container">
              {([...certificates, ...awards] as string[]).slice(0, 8).map((item) => (
                <span key={item} className="tag tag-blue">{item}</span>
              ))}
            </div>
          )}
          {(softSkills as Array<Record<string, unknown>>).slice(0, 3).map((item, index) => {
            const c = PILL_COLORS[index % PILL_COLORS.length]
            const label = String(item.dimension || item.name || item.key || '素养')
            const score = toPercentScore(item.score)
            return (
              <span key={`${label}-${index}`} style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '3px 8px', borderRadius: 20,
                fontSize: 10, fontWeight: 500,
                background: c.bg, color: c.text,
                border: `1px solid ${c.border}`,
                marginRight: 6, marginBottom: 6,
              }}>
                {label}·{score}分
              </span>
            )
          })}
          {!certificates.length && !awards.length && softSkills.length === 0 && (
            <div style={{ color: 'var(--color-text-tertiary)', fontSize: 10 }}>暂未识别到证书、奖项或软技能。</div>
          )}
        </div>

        {/* Missing items */}
        <div
          className="profile-card card-bounce"
          style={{
            '--ci': 4,
            background: missingSuggestions.length ? 'var(--color-warning-bg)' : '#ecfdf5',
            borderColor: missingSuggestions.length ? '#fed7aa' : '#bbf7d0',
          } as React.CSSProperties}
        >
          <div className="profile-card-header">
            <div className={`profile-card-indicator ${missingSuggestions.length ? 'orange' : 'green'}`} />
            <span className="profile-card-title">
              {missingSuggestions.length ? `待补全 · ${missingSuggestions.length} 条` : '画像已较完整'}
            </span>
          </div>
          {missingSuggestions.length > 0 ? (
            missingSuggestions.map((item, index) => (
              <div key={item} className="missing-item">
                {index > 0 && <div className="missing-item-divider" />}
                <div className="missing-item-content">
                  <div>
                    <div className="missing-item-name">{item}</div>
                  </div>
                  <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 600, marginLeft: 'auto' }}>
                    {index === 0 ? '·12分' : index === 1 ? '·6分' : '·4分'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 9, color: 'var(--color-success-text)', lineHeight: 1.6 }}>
              当前缺失建议已经较少，可以直接进入岗位探索和报告生成环节。
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'grid', gap: 8, paddingBottom: 10 }}>
          <button
            type="button"
            onClick={() => navigate('/chat-fill')}
            className="profile-action-btn pressable"
          >
            AI 对话补全画像
          </button>
        </div>
      </div>
    </MobileShell>
  )
}

export default ProfilePage
