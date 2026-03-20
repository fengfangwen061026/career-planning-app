import React from 'react'
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

const ProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    profile,
    currentStudent,
    recommendations,
    isLoadingProfile,
  } = useMobileApp()

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
    ? (profileJson.awards as Array<Record<string, unknown>>).map((item) => String(item.name || '')).filter(Boolean)
    : []
  const softSkills = Array.isArray(profileJson.soft_skills) ? profileJson.soft_skills : []
  const missingSuggestions = profile?.missing_suggestions || []
  const completeness = Math.round(profile?.completeness_score || 0)
  const competitiveness = toPercentScore(profileJson.competitiveness_score)
  const strongMatches = recommendations.filter((item) => item.total_score >= 75).length

  if (isLoadingProfile && !profile) {
    return (
      <MobileShell hasTabBar activeTab="profile">
        <div style={{ padding: 24, color: '#334155' }}>正在加载学生画像...</div>
      </MobileShell>
    )
  }

  if (!profile) {
    return (
      <MobileShell hasTabBar activeTab="profile">
        <div
          style={{
            padding: '24px 18px 120px',
            background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 45%)',
            minHeight: '100%',
          }}
        >
          <div
            style={{
              borderRadius: 28,
              padding: 22,
              background: '#ffffff',
              border: '1px solid #dbeafe',
              boxShadow: '0 14px 32px rgba(15, 23, 42, 0.06)',
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              还没有可用画像
            </div>
            <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.7, marginTop: 10 }}>
              {currentStudent?.name || '当前学生'} 还没有生成学生画像。先上传简历，系统会自动完成解析、画像生成和缺失建议提取。
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => navigate('/upload')}
                style={{
                  flex: 1,
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
              <button
                type="button"
                onClick={() => navigate('/explore')}
                style={{
                  flex: 1,
                  borderRadius: 16,
                  padding: '14px 16px',
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: 700,
                  border: '1px solid #cbd5e1',
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
      <div
        style={{
          padding: '20px 18px 120px',
          background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 45%)',
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
                {String(basicInfo.name || currentStudent?.name || '未命名同学')}
              </div>
              <div style={{ marginTop: 8, color: '#475569', lineHeight: 1.7, fontSize: 13 }}>
                {[basicInfo.school, basicInfo.degree, basicInfo.major].filter(Boolean).join(' · ') || '已生成基础学生画像'}
              </div>
            </div>
            <div
              style={{
                borderRadius: 999,
                padding: '8px 12px',
                background: justUpdated ? '#dcfce7' : '#eef2ff',
                color: justUpdated ? '#166534' : '#4338ca',
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              完整度 {completeness}%
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
            <div
              style={{
                borderRadius: 20,
                padding: 16,
                background: '#f8fafc',
              }}
            >
              <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>竞争力</div>
              <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: '#1d4ed8' }}>{competitiveness}</div>
              <div style={{ marginTop: 6, color: '#475569', fontSize: 12 }}>来自真实画像计算结果</div>
            </div>
            <div
              style={{
                borderRadius: 20,
                padding: 16,
                background: '#f8fafc',
              }}
            >
              <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>高匹配岗位</div>
              <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: '#0f766e' }}>{strongMatches}</div>
              <div style={{ marginTop: 6, color: '#475569', fontSize: 12 }}>当前推荐中 75 分以上岗位数</div>
            </div>
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
          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>技能画像</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {(skills as Array<Record<string, unknown>>).slice(0, 6).map((skill, index) => {
              const score = proficiencyToScore(skill.proficiency || skill.level)
              return (
                <div key={`${String(skill.name || 'skill')}-${index}`} style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#0f172a', fontWeight: 700 }}>{String(skill.name || '未命名技能')}</span>
                    <span style={{ color: '#475569' }}>{score}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${score}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #1d4ed8 0%, #60a5fa 100%)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
            {skills.length === 0 && <div style={{ color: '#64748b', fontSize: 13 }}>当前画像还没有识别出明确技能。</div>}
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
          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>项目与经历</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {(experiences as Array<Record<string, unknown>>).slice(0, 5).map((experience, index) => (
              <div
                key={`${String(experience.title || 'experience')}-${index}`}
                style={{
                  borderRadius: 18,
                  padding: 14,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{String(experience.title || '未命名经历')}</div>
                <div style={{ color: '#475569', fontSize: 12, marginTop: 6 }}>
                  {[experience.type, experience.company, experience.duration].filter(Boolean).join(' · ')}
                </div>
                {Boolean(experience.description) && (
                  <div style={{ color: '#334155', fontSize: 13, lineHeight: 1.7, marginTop: 8 }}>
                    {String(experience.description)}
                  </div>
                )}
              </div>
            ))}
            {experiences.length === 0 && <div style={{ color: '#64748b', fontSize: 13 }}>当前画像还没有提取到项目或实习内容。</div>}
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
          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>证书、奖项与软技能</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[...certificates, ...awards].slice(0, 8).map((item) => (
              <span
                key={item}
                style={{
                  borderRadius: 999,
                  padding: '9px 12px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {item}
              </span>
            ))}
            {!certificates.length && !awards.length && (
              <span style={{ color: '#64748b', fontSize: 13 }}>暂未识别到证书或奖项。</span>
            )}
          </div>

          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            {(softSkills as Array<Record<string, unknown>>).slice(0, 5).map((item, index) => (
              <div
                key={`${String(item.dimension || 'soft-skill')}-${index}`}
                style={{
                  borderRadius: 16,
                  padding: '12px 14px',
                  background: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{String(item.dimension || '软技能')}</span>
                  <span style={{ color: '#0f766e', fontWeight: 700 }}>{toPercentScore(item.score)}%</span>
                </div>
                <div style={{ color: '#475569', fontSize: 12, lineHeight: 1.6, marginTop: 6 }}>
                  {String(item.evidence || '暂无证据')}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            borderRadius: 24,
            padding: 18,
            background: missingSuggestions.length ? '#fff7ed' : '#ecfdf5',
            border: `1px solid ${missingSuggestions.length ? '#fed7aa' : '#bbf7d0'}`,
          }}
        >
          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
            {missingSuggestions.length ? `待补全项 · ${missingSuggestions.length} 条` : '画像已经比较完整'}
          </div>
          {missingSuggestions.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {missingSuggestions.map((item) => (
                <div
                  key={item}
                  style={{
                    borderRadius: 16,
                    padding: '12px 14px',
                    background: '#ffffff',
                    color: '#9a3412',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#166534', fontSize: 13, lineHeight: 1.7 }}>
              当前缺失建议已经较少，可以直接进入岗位探索和报告生成环节。
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <button
            type="button"
            onClick={() => navigate('/chat-fill')}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 18,
              padding: '15px 16px',
              background: '#0f172a',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            AI 对话补全画像
          </button>
          <button
            type="button"
            onClick={() => navigate('/explore')}
            style={{
              width: '100%',
              borderRadius: 18,
              padding: '15px 16px',
              background: '#ffffff',
              color: '#1d4ed8',
              fontWeight: 800,
              fontSize: 15,
              border: '1px solid #bfdbfe',
            }}
          >
            查看真实岗位推荐
          </button>
        </div>
      </div>
    </MobileShell>
  )
}

export default ProfilePage
