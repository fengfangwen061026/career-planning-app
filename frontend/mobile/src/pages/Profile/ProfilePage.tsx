import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import TabBar from '../../components/TabBar/TabBar'
import { session } from '../../store/session'

interface SkillItem {
  name: string
  level: string
}

interface EducationItem {
  school?: string
  degree?: string
  major?: string
  graduation_year?: number
}

interface ProjectItem {
  name?: string
  role?: string
  description?: string
  tech_stack?: string[]
}

interface InternshipItem {
  company?: string
  role?: string
  duration?: string
  description?: string
}

interface ProfileData {
  name: string
  school: string
  major: string
  overall_score: number
  completeness_score: number
  skills: SkillItem[]
  education: EducationItem[]
  projects: ProjectItem[]
  internships: InternshipItem[]
  certifications: string[]
  awards: string[]
  missing_suggestions: string[]
  soft_competencies: Array<{ label: string; value: number }>
}

interface ProfileResponse {
  profile_json?: Record<string, unknown>
  completeness_score?: number
  missing_suggestions?: string[]
}

function scoreFromLevel(level: string): number {
  switch (level) {
    case '熟练':
      return 85
    case '掌握':
      return 70
    case '了解':
      return 50
    default:
      return 55
  }
}

function normalizePercent(value: unknown): number {
  const num = Number(value || 0)
  if (Number.isNaN(num)) {
    return 0
  }
  return Math.round(num <= 1 ? num * 100 : num)
}

function compactText(value: unknown, fallback = ''): string {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || fallback
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const studentId = session.getStudentId()
    if (!studentId) {
      navigate('/onboarding')
      return
    }

    const load = async () => {
      try {
        const res = await fetch(`/api/students/${studentId}/profile`)
        if (!res.ok) {
          throw new Error('Profile not found')
        }

        const data = await res.json() as ProfileResponse
        const pj = (data.profile_json || {}) as Record<string, unknown>
        const basicInfo = (pj.basic_info || {}) as Record<string, unknown>
        const skills = Array.isArray(pj.skills) ? pj.skills : []
        const education = Array.isArray(pj.education) ? pj.education : []
        const projects = Array.isArray(pj.projects) ? pj.projects : []
        const internships = Array.isArray(pj.internships)
          ? pj.internships
          : Array.isArray(pj.experience)
            ? pj.experience
            : []
        const certifications = Array.isArray(pj.certifications) ? pj.certifications : []
        const awards = Array.isArray(pj.awards) ? pj.awards : []
        const soft = (pj.soft_competencies || {}) as Record<string, { value?: number }>

        const softCompetencies = Object.entries(soft)
          .map(([key, value]) => ({
            label: key === 'communication'
              ? '沟通'
              : key === 'teamwork'
                ? '协作'
                : key === 'learning_ability'
                  ? '学习'
                  : key === 'stress_tolerance'
                    ? '抗压'
                    : key === 'innovation'
                      ? '创新'
                      : key,
            value: Number(value?.value || 0),
          }))
          .filter(item => item.value > 0)

        const normalizedProfile: ProfileData = {
          name: compactText(session.getName(), compactText(basicInfo.name, '同学')),
          school: compactText(basicInfo.school),
          major: compactText(basicInfo.major),
          overall_score: normalizePercent(pj.competitiveness_score),
          completeness_score: normalizePercent(data.completeness_score || pj.completeness_score),
          skills: skills.slice(0, 8).map(item => {
            const skill = item as Record<string, unknown>
            return {
              name: compactText(skill.name, '未命名技能'),
              level: compactText(skill.level, '了解'),
            }
          }),
          education: education as EducationItem[],
          projects: projects as ProjectItem[],
          internships: internships as InternshipItem[],
          certifications: certifications.map(item => {
            if (typeof item === 'string') {
              return item
            }
            return compactText((item as Record<string, unknown>).name)
          }).filter(Boolean),
          awards: awards.map(item => {
            if (typeof item === 'string') {
              return item
            }
            return compactText((item as Record<string, unknown>).name)
          }).filter(Boolean),
          missing_suggestions: (
            data.missing_suggestions ||
            (Array.isArray(pj.missing_suggestions) ? pj.missing_suggestions : [])
          ).map(item => String(item)),
          soft_competencies: softCompetencies,
        }

        if (compactText(basicInfo.name)) {
          session.setName(compactText(basicInfo.name))
        }

        setProfile(normalizedProfile)
      } catch {
        setError('加载画像失败')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [navigate])

  const score = profile?.overall_score || 0
  const circumference = 2 * Math.PI * 21
  const completeness = profile?.completeness_score || 0
  const strokeOffset = circumference * (1 - score / 100)
  const avatarChar = profile?.name?.trim().charAt(0) || '同'
  const subtitle = [profile?.major, profile?.school].filter(Boolean).join(' · ') || '等待补充画像信息'

  const renderExperienceBlock = () => {
    const internship = profile?.internships?.[0]
    const project = profile?.projects?.[0]

    return (
      <div className="card" style={{ marginBottom: 7 }}>
        <div className="card-hd" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div className="card-hd-bar" style={{ background: '#10B981' }} />
            实习 &amp; 项目
          </div>
          <span className="tag tag-green">真实数据</span>
        </div>

        {internship ? (
          <div style={{ marginBottom: project ? 7 : 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#0A0A0A' }}>
              {compactText(internship.company, '实习经历')} · {compactText(internship.role, '岗位')}
            </div>
            <div style={{ fontSize: 9, color: '#6B7280', margin: '1px 0 4px' }}>
              {compactText(internship.duration, '时长待补充')}
            </div>
            <div style={{ fontSize: 9, color: '#374151', lineHeight: 1.6 }}>
              {compactText(internship.description, '暂无实习描述')}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 9, color: '#9CA3AF', marginBottom: project ? 7 : 0 }}>
            暂无实习经历
          </div>
        )}

        {project && (
          <>
            <div style={{ height: '0.5px', background: '#E5E7EB', marginBottom: 7 }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#0A0A0A' }}>
                {compactText(project.name, '项目经历')}
              </div>
              <div style={{ fontSize: 9, color: '#6B7280', margin: '1px 0 4px' }}>
                {compactText(project.role, '角色待补充')}
              </div>
              <div style={{ fontSize: 9, color: '#374151', lineHeight: 1.6, marginBottom: project.tech_stack?.length ? 4 : 0 }}>
                {compactText(project.description, '暂无项目描述')}
              </div>
              {project.tech_stack?.length ? (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {project.tech_stack.slice(0, 4).map(tag => (
                    <span key={tag} className="tag tag-blue">{tag}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}

        {!internship && !project ? (
          <div className="notice">
            当前画像还缺少实习或项目内容，建议先上传完整简历或继续补全信息。
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <div style={{ padding: '10px 12px', background: 'white', borderBottom: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.4px', color: '#0A0A0A' }}>学生画像</div>
        <button
          onClick={() => navigate('/chat-fill')}
          style={{ fontSize: 8, color: '#4F46E5', background: 'none', border: '0.5px solid #4F46E5', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          完善画像
        </button>
      </div>

      <div className="scroll-body" style={{ padding: '10px 12px 0' }}>
        {loading && (
          <div className="card" style={{ padding: 12 }}>
            <div className="skeleton" style={{ height: 18, width: '36%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: '55%', marginBottom: 14 }} />
            <div className="skeleton" style={{ height: 80, width: '100%' }} />
          </div>
        )}

        {error && !loading && (
          <div className="card">
            <div style={{ fontSize: 10, color: '#EF4444', marginBottom: 8 }}>{error}</div>
            <button className="btn-primary" onClick={() => window.location.reload()}>
              重新加载
            </button>
          </div>
        )}

        {!loading && !error && profile && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', background: '#EEF2FF',
                color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 12, flexShrink: 0,
              }}>{avatarChar}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.3px' }}>{profile.name}</div>
                <div style={{ fontSize: 9, color: '#6B7280' }}>{subtitle}</div>
              </div>
              <span className="tag tag-amber" style={{ marginLeft: 'auto' }}>完整度 {completeness}%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
                <svg width="52" height="52" viewBox="0 0 52 52" style={{ position: 'absolute', top: 0, left: 0 }}>
                  <circle cx="26" cy="26" r="21" fill="none" stroke="#E5E7EB" strokeWidth="5" />
                  <circle cx="26" cy="26" r="21" fill="none" stroke="#4F46E5" strokeWidth="5"
                    strokeDasharray={`${circumference}`} strokeDashoffset={strokeOffset}
                    strokeLinecap="round" transform="rotate(-90 26 26)" />
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#4F46E5', letterSpacing: '-0.5px' }}>{score}</div>
                  <div style={{ fontSize: 7, color: '#9CA3AF', lineHeight: 1.2 }}>竞争力</div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 9, color: '#6B7280' }}>简历完整度</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: completeness >= 80 ? '#10B981' : '#D97706' }}>{completeness}%</span>
                </div>
                <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden', marginBottom: 7 }}>
                  <div style={{ width: `${completeness}%`, height: '100%', background: completeness >= 80 ? '#10B981' : '#D97706', borderRadius: 2 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#6B7280' }}>竞争力评分</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#10B981' }}>{score}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-hd"><div className="card-hd-bar" style={{ background: '#3B82F6' }} />技术技能</div>
              {profile.skills.length > 0 ? profile.skills.map((sk, i) => (
                <div key={`${sk.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: i < profile.skills.length - 1 ? 5 : 0 }}>
                  <span style={{ fontSize: 10, color: '#374151', width: 50, flexShrink: 0 }}>{sk.name}</span>
                  <div style={{ flex: 1, height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${scoreFromLevel(sk.level)}%`, height: '100%', background: '#3B82F6', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 9, color: '#9CA3AF', width: 26, textAlign: 'right' }}>{sk.level}</span>
                </div>
              )) : (
                <div style={{ fontSize: 9, color: '#9CA3AF' }}>暂无技能数据</div>
              )}
            </div>

            {renderExperienceBlock()}

            <div className="card">
              <div className="card-hd"><div className="card-hd-bar" style={{ background: '#D97706' }} />证书 &amp; 荣誉</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[...profile.certifications, ...profile.awards].length > 0 ? (
                  [...profile.certifications, ...profile.awards].map(item => (
                    <span key={item} className="tag tag-amber">{item}</span>
                  ))
                ) : (
                  <span className="tag tag-gray">暂无证书与荣誉</span>
                )}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-hd"><div className="card-hd-bar" style={{ background: '#4F46E5' }} />软素养</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {profile.soft_competencies.length > 0 ? (
                  profile.soft_competencies.map(item => (
                    <span key={item.label} className="tag tag-blue">{item.label} · {item.value}/5</span>
                  ))
                ) : (
                  <span className="tag tag-gray">暂无软素养评估</span>
                )}
              </div>
            </div>

            {profile.missing_suggestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#FEF3C7', borderRadius: 9, padding: '8px 10px', marginBottom: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#92400E' }}>建议继续补全以下信息</div>
                {profile.missing_suggestions.slice(0, 3).map(item => (
                  <div key={item} style={{ fontSize: 8, color: '#B45309' }}>{item}</div>
                ))}
                <button
                  onClick={() => navigate('/chat-fill')}
                  style={{ alignSelf: 'flex-end', fontSize: 9, fontWeight: 700, color: '#92400E', background: 'none', border: '0.5px solid #D97706', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  继续 →
                </button>
              </div>
            )}

            <button className="btn-primary" onClick={() => navigate('/explore')}>
              探索匹配岗位 →
            </button>
          </>
        )}
      </div>
      <TabBar active="profile" />
    </>
  )
}
