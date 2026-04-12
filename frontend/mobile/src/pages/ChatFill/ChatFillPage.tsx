import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { session } from '../../store/session'

interface Message {
  role: 'ai' | 'user'
  text: string
  options?: string[]
}

interface CompletionQuestion {
  question_id: string
  title: string
  prompt: string
  placeholder?: string
  options: string[]
}

interface CompletionSessionResponse {
  questions?: CompletionQuestion[]
}

interface CompletionApplyResponse {
  applied_updates?: string[]
  profile?: {
    completeness_score?: number
    profile_json?: Record<string, unknown>
  }
}

const FALLBACK_QUESTIONS: CompletionQuestion[] = [
  {
    question_id: 'project_outcome',
    title: '量化成果',
    prompt: '能告诉我你在项目中取得了哪些具体成果吗？比如用户量、性能提升等量化指标。',
    options: ['100人以下', '100-500人', '500人以上', '没有统计过'],
  },
  {
    question_id: 'teamwork',
    title: '协作经历',
    prompt: '在项目或实习中，你通常承担什么角色？有没有跨团队协作的经历？',
    options: ['独立完成', '2-3人协作', '跨团队协作', '正在补充'],
  },
  {
    question_id: 'learning',
    title: '学习能力',
    prompt: '最近半年你主动学习过什么技能？有没有把它真正用到项目中？',
    options: ['学过但没实践', '做过课程项目', '已经用于真实项目', '还没有系统学习'],
  },
]

function normalizePercent(value: unknown): number {
  const num = Number(value || 0)
  if (Number.isNaN(num)) {
    return 0
  }
  return Math.round(num <= 1 ? num * 100 : num)
}

export default function ChatFillPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [questions, setQuestions] = useState<CompletionQuestion[]>([])
  const [currentQIdx, setCurrentQIdx] = useState(0)
  const [answers, setAnswers] = useState<Array<{ question_id: string; answer: string }>>([])
  const [input, setInput] = useState('')
  const [done, setDone] = useState(false)
  const [typing, setTyping] = useState(false)
  const [loading, setLoading] = useState(true)
  const [applyUpdates, setApplyUpdates] = useState<string[]>([])
  const [updatedCompleteness, setUpdatedCompleteness] = useState<number | null>(null)
  const [updatedCompetitiveness, setUpdatedCompetitiveness] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeQuestions = questions.length > 0 ? questions : FALLBACK_QUESTIONS
  const totalSteps = Math.max(activeQuestions.length, 1)
  const currentStep = Math.min(currentQIdx + 1, totalSteps)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing, done])

  useEffect(() => {
    const studentId = session.getStudentId()
    if (!studentId) {
      navigate('/onboarding')
      return
    }

    const init = async () => {
      try {
        const res = await fetch(`/api/student-app/students/${studentId}/profile-completion/session`, {
          method: 'POST',
        })
        if (!res.ok) {
          throw new Error('Failed to get questions')
        }
        const data = await res.json() as CompletionSessionResponse
        const qs = data.questions || []
        setQuestions(qs)

        if (qs.length === 0) {
          navigate('/profile')
          return
        }

        setMessages([{
          role: 'ai',
          text: qs[0].prompt,
          options: qs[0].options,
        }])
      } catch {
        setMessages([{
          role: 'ai',
          text: FALLBACK_QUESTIONS[0].prompt,
          options: FALLBACK_QUESTIONS[0].options,
        }])
      } finally {
        setLoading(false)
      }
    }

    void init()
  }, [navigate])

  const sendMessage = async (text: string) => {
    const question = activeQuestions[currentQIdx]
    const newAnswers = [
      ...answers,
      {
        question_id: question?.question_id || `q_${currentQIdx}`,
        answer: text,
      },
    ]

    setAnswers(newAnswers)
    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setTyping(true)

    const nextIdx = currentQIdx + 1
    window.setTimeout(async () => {
      setTyping(false)
      if (nextIdx < activeQuestions.length) {
        setCurrentQIdx(nextIdx)
        setMessages(prev => [...prev, {
          role: 'ai',
          text: activeQuestions[nextIdx].prompt,
          options: activeQuestions[nextIdx].options,
        }])
        return
      }

      const studentId = session.getStudentId()
      if (studentId) {
        try {
          const res = await fetch(`/api/student-app/students/${studentId}/profile-completion/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: newAnswers }),
          })
          if (res.ok) {
            const data = await res.json() as CompletionApplyResponse
            session.setHasProfile(true)
            setApplyUpdates((data.applied_updates || []).slice(0, 4))
            setUpdatedCompleteness(normalizePercent(data.profile?.completeness_score))
            setUpdatedCompetitiveness(
              normalizePercent((data.profile?.profile_json || {}).competitiveness_score)
            )
          }
        } catch {
          // keep fallback confirmation view
        }
      }
      setDone(true)
    }, 1200)
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'white' }}>
      <div style={{ padding: '10px 12px', background: 'white', borderBottom: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4F46E5', marginRight: -2, flexShrink: 0 }} />
        <div style={{ fontSize: 9, color: '#4F46E5', fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate('/profile')}>← 返回画像</div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0A0A0A' }}>补全画像信息</div>
          <div style={{ fontSize: 8, color: '#9CA3AF' }}>
            {loading ? '正在获取问题…' : `缺失项 ${currentStep}/${totalSteps}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {Array.from({ length: Math.min(totalSteps, 4) }).map((_, i) => (
            <div key={i} style={{ width: i < currentStep ? 16 : 6, height: 4, borderRadius: 2, background: i < currentStep ? '#4F46E5' : '#E5E7EB' }} />
          ))}
        </div>
      </div>

      <div style={{ padding: '6px 10px', background: 'white', borderBottom: '0.5px solid #E5E7EB' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 8, color: '#6B7280' }}>本次补全进度</span>
          <span style={{ fontSize: 8, fontWeight: 700, color: '#4F46E5' }}>
            {loading ? '准备中' : `问题 ${currentStep}/${totalSteps}`}
          </span>
        </div>
        <div style={{ height: 3, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${(currentStep / totalSteps) * 100}%`, height: '100%', background: '#4F46E5', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#F9FAFB' }}>
        {loading && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
            <div style={{ padding: '8px 10px', background: 'white', border: '0.5px solid #E5E7EB', borderRadius: '4px 12px 12px 12px', fontSize: 10, color: '#6B7280' }}>
              正在获取你的缺失问题…
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%',
                padding: '8px 10px',
                background: msg.role === 'ai' ? 'white' : '#4F46E5',
                color: msg.role === 'ai' ? '#374151' : 'white',
                borderRadius: msg.role === 'ai' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                fontSize: 10, lineHeight: 1.7,
                border: msg.role === 'ai' ? '0.5px solid #E5E7EB' : 'none',
              }}>
                {msg.text}
              </div>
            </div>
            {msg.options && !done && i === messages.length - 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                {msg.options.map(opt => (
                  <button
                    key={opt}
                    onClick={() => { void sendMessage(opt) }}
                    style={{
                      padding: '5px 10px', border: '1px solid #4F46E5', borderRadius: 20,
                      fontSize: 9, fontWeight: 600, color: '#4F46E5', background: '#EEF2FF',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {typing && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
            <div style={{ padding: '8px 10px', background: 'white', border: '0.5px solid #E5E7EB', borderRadius: '4px 12px 12px 12px', display: 'flex', gap: 3 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 5, height: 5, borderRadius: '50%', background: '#9CA3AF',
                  animation: 'bounce 1.2s infinite',
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
          </div>
        )}

        {done && (
          <div>
            <div style={{ background: 'white', border: '1px solid #4F46E5', borderRadius: 8, padding: 10, margin: '2px 0' }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>AI 写入结果</div>
              <div style={{ fontSize: 9, color: '#374151', lineHeight: 1.8 }}>
                {applyUpdates.length > 0 ? applyUpdates.join('；') : '补充回答已提交，系统会在画像页展示最新结果。'}
              </div>
            </div>
            <div style={{ background: '#D1FAE5', border: '0.5px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '8px 10px', marginTop: 6 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#065F46', marginBottom: 4 }}>更新后状态</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 9, color: '#065F46' }}>完整度</div>
                <div style={{ fontSize: 11, color: '#065F46', fontWeight: 800 }}>
                  {updatedCompleteness !== null ? `${updatedCompleteness}%` : '已提交'}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                <div style={{ fontSize: 9, color: '#065F46' }}>竞争力评分</div>
                <div style={{ fontSize: 11, color: '#065F46', fontWeight: 800 }}>
                  {updatedCompetitiveness !== null ? updatedCompetitiveness : '待刷新'}
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {done ? (
        <div style={{ padding: '8px 10px', background: 'white', borderTop: '0.5px solid #E5E7EB', display: 'flex', gap: 6 }}>
          <button
            onClick={() => navigate('/profile')}
            style={{ flex: 1, padding: 8, border: '0.5px solid #D1D5DB', background: 'transparent', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            返回画像
          </button>
          <button
            onClick={() => navigate('/profile')}
            style={{ flex: 1, padding: 8, background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            完成 ✓
          </button>
        </div>
      ) : (
        <div style={{ padding: '8px 10px', background: 'white', borderTop: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && input.trim() && void sendMessage(input.trim())}
            placeholder={activeQuestions[currentQIdx]?.placeholder || '输入你的回答…'}
            disabled={loading}
            style={{
              flex: 1, height: 30, border: '0.5px solid #D1D5DB', borderRadius: 15,
              padding: '0 10px', fontSize: 10, background: '#F9FAFB', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => input.trim() && void sendMessage(input.trim())}
            disabled={loading || !input.trim()}
            style={{ width: 28, height: 28, borderRadius: '50%', background: '#4F46E5', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: loading || !input.trim() ? 0.45 : 1 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 6h10M6 1l5 5-5 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
