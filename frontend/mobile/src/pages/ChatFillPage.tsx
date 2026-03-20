import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import MobileShell from '../components/MobileShell'
import { useMobileApp } from '../context/MobileAppContext'
import './ChatFillPage.css'

const ChatFillPage: React.FC = () => {
  const navigate = useNavigate()
  const { completionSession, loadCompletionSession, applyCompletionAnswers } = useMobileApp()

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      setLoading(true)
      setError('')
      try {
        const session = await loadCompletionSession()
        if (!mounted) {
          return
        }
        if (!session || session.questions.length === 0) {
          setError('当前画像暂时没有待补全问题，可以先返回画像页。')
        }
      } catch (loadError) {
        if (!mounted) {
          return
        }
        const message = loadError instanceof Error ? loadError.message : '加载补全问题失败'
        setError(message)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void bootstrap()
    return () => {
      mounted = false
    }
  }, [])

  const questions = completionSession?.questions || []
  const currentQuestion = questions[currentIndex]
  const answeredCount = Object.values(answers).filter(Boolean).length

  function saveCurrentAnswer(value: string) {
    if (!currentQuestion) {
      return
    }
    setAnswers((previous) => ({
      ...previous,
      [currentQuestion.question_id]: value.trim(),
    }))
  }

  function handleOptionClick(option: string) {
    saveCurrentAnswer(option)
    setDraft(option)
  }

  function handleNext() {
    if (!currentQuestion) {
      return
    }

    const finalValue = draft.trim() || answers[currentQuestion.question_id]?.trim()
    if (!finalValue) {
      setError('请先回答当前问题。')
      return
    }

    saveCurrentAnswer(finalValue)
    setError('')
    if (currentIndex < questions.length - 1) {
      const nextQuestion = questions[currentIndex + 1]
      setCurrentIndex((previous) => previous + 1)
      setDraft(answers[nextQuestion.question_id] || '')
      return
    }

    void handleSubmit()
  }

  async function handleSubmit() {
    const payloadAnswers = questions
      .map((question) => ({
        question_id: question.question_id,
        answer: (question.question_id === currentQuestion?.question_id ? draft : answers[question.question_id] || '').trim(),
      }))
      .filter((item) => item.answer)

    if (!payloadAnswers.length) {
      setError('至少需要完成一个补全问题。')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await applyCompletionAnswers({ answers: payloadAnswers })
      navigate('/profile', { replace: true, state: { justUpdated: true } })
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '补全写回失败'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (currentQuestion) {
      setDraft(answers[currentQuestion.question_id] || '')
    }
  }, [currentQuestion?.question_id])

  return (
    <MobileShell hasTabBar={false}>
      <div
        style={{
          minHeight: '100%',
          padding: '18px 16px 28px',
          background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 60%)',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/profile')}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#475569',
            fontWeight: 700,
            padding: '4px 0',
          }}
        >
          返回画像页
        </button>

        <div style={{ marginTop: 10, fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
          AI 对话补全
        </div>
        <p style={{ marginTop: 10, color: '#475569', fontSize: 14, lineHeight: 1.7 }}>
          问题来自当前画像的缺失项。提交后会走后端结构化 patch，并直接刷新学生画像。
        </p>

        <div
          style={{
            marginTop: 18,
            borderRadius: 20,
            padding: 14,
            background: '#ffffff',
            border: '1px solid #dbeafe',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
            <span>本次补全进度</span>
            <span>{loading ? '加载中' : `${Math.min(answeredCount + (draft.trim() ? 1 : 0), questions.length)}/${questions.length || 0}`}</span>
          </div>
          <div style={{ marginTop: 10, height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
            <div
              style={{
                width: `${questions.length ? ((answeredCount + (draft.trim() ? 1 : 0)) / questions.length) * 100 : 0}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #4f46e5 0%, #2563eb 100%)',
              }}
            />
          </div>
        </div>

        {loading && <div style={{ marginTop: 20, color: '#475569' }}>正在加载结构化补全问题...</div>}

        {!loading && currentQuestion && (
          <div
            style={{
              marginTop: 18,
              borderRadius: 24,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: 18,
              boxShadow: '0 12px 28px rgba(15, 23, 42, 0.05)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                borderRadius: 999,
                padding: '6px 10px',
                background: '#eef2ff',
                color: '#4338ca',
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              问题 {currentIndex + 1} / {questions.length}
            </div>
            <div style={{ marginTop: 12, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{currentQuestion.title}</div>
            <div style={{ marginTop: 10, color: '#334155', lineHeight: 1.8, fontSize: 14 }}>{currentQuestion.prompt}</div>

            {currentQuestion.options.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {currentQuestion.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleOptionClick(option)}
                    style={{
                      borderRadius: 999,
                      border: draft === option ? '1px solid #6366f1' : '1px solid #cbd5e1',
                      background: draft === option ? '#eef2ff' : '#ffffff',
                      color: draft === option ? '#4338ca' : '#334155',
                      padding: '10px 12px',
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={currentQuestion.placeholder || '请输入你的补充信息'}
              rows={6}
              style={{
                marginTop: 16,
                width: '100%',
                borderRadius: 18,
                border: '1px solid #dbe3f0',
                padding: '14px 16px',
                resize: 'vertical',
                fontSize: 14,
                lineHeight: 1.7,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {error && (
              <div
                style={{
                  marginTop: 12,
                  borderRadius: 16,
                  padding: '12px 14px',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                style={{
                  flex: 1,
                  borderRadius: 16,
                  padding: '14px 16px',
                  background: '#ffffff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  fontWeight: 700,
                }}
              >
                稍后再补
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleNext}
                style={{
                  flex: 1.2,
                  border: 'none',
                  borderRadius: 16,
                  padding: '14px 16px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                }}
              >
                {submitting ? '正在写回画像...' : currentIndex === questions.length - 1 ? '完成并写回画像' : '下一题'}
              </button>
            </div>
          </div>
        )}

        {!loading && !currentQuestion && (
          <div
            style={{
              marginTop: 18,
              borderRadius: 24,
              padding: 18,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              color: '#475569',
              lineHeight: 1.7,
            }}
          >
            当前没有可补全的问题，可以先回画像页查看最新状态。
          </div>
        )}
      </div>
    </MobileShell>
  )
}

export default ChatFillPage
