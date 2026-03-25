import React, { useEffect, useRef, useState } from 'react'
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

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      setLoading(true)
      setError('')
      try {
        const session = await loadCompletionSession()
        if (!mounted) return
        if (!session || session.questions.length === 0) {
          setError('当前画像暂时没有待补全问题，可以先返回画像页。')
        }
      } catch (loadError) {
        if (!mounted) return
        const message = loadError instanceof Error ? loadError.message : '加载补全问题失败'
        setError(message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void bootstrap()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentIndex, answers])

  const questions = completionSession?.questions || []
  const currentQuestion = questions[currentIndex]
  const answeredCount = Object.values(answers).filter(Boolean).length
  const progressPct = questions.length ? (answeredCount / questions.length) * 100 : 0

  function saveCurrentAnswer(value: string) {
    if (!currentQuestion) return
    setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: value.trim() }))
  }

  function handleOptionClick(option: string) {
    saveCurrentAnswer(option)
    setDraft(option)
  }

  function handleSend() {
    if (!currentQuestion) return

    const finalValue = draft.trim() || answers[currentQuestion.question_id]?.trim()
    if (!finalValue) {
      setError('请先回答当前问题。')
      return
    }

    saveCurrentAnswer(finalValue)
    setError('')

    if (currentIndex < questions.length - 1) {
      const nextQuestion = questions[currentIndex + 1]
      setCurrentIndex((prev) => prev + 1)
      setDraft(answers[nextQuestion.question_id] || '')
      return
    }

    void handleSubmit(finalValue)
  }

  async function handleSubmit(lastAnswer?: string) {
    const payloadAnswers = questions
      .map((question) => ({
        question_id: question.question_id,
        answer: (
          question.question_id === currentQuestion?.question_id
            ? lastAnswer ?? draft
            : answers[question.question_id] || ''
        ).trim(),
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
      <div className="chat-fill-container">
        {/* Top nav */}
        <div className="top-nav">
          <div className="back-area" onClick={() => navigate('/profile')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/profile')}>
            <div className="back-dot" />
            <span className="back-text">返回</span>
          </div>
          <span className="nav-title">AI 对话补全</span>
          <div className="progress-dots">
            {questions.slice(0, 8).map((_, i) => (
              <div key={i} className={`dot ${i <= currentIndex && !loading ? 'active' : ''}`} />
            ))}
          </div>
        </div>

        {/* Sub progress */}
        <div className="sub-progress">
          <div className="progress-text">
            <span>本次补全进度</span>
            <span className="progress-status">
              {loading ? '加载中...' : `${answeredCount} / ${questions.length}`}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Messages area */}
        <div className="messages-area">
          {/* Loading state */}
          {loading && (
            <div className="message-wrapper ai">
              <div className="ai-bubble">
                <div className="typing-dots">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}

          {/* Past Q&A bubbles */}
          {!loading && questions.slice(0, currentIndex).map((q) => (
            <React.Fragment key={q.question_id}>
              <div className="message-wrapper ai">
                <div className="ai-bubble">
                  <div className="bubble-text">{q.title}</div>
                  {q.prompt && <div className="bubble-text" style={{ opacity: 0.65, marginTop: 3 }}>{q.prompt}</div>}
                </div>
                <div className="timestamp">{new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              {answers[q.question_id] && (
                <div className="message-wrapper user">
                  <div className="user-bubble">
                    <div className="bubble-text">{answers[q.question_id]}</div>
                  </div>
                  <div className="timestamp" style={{ textAlign: 'right' }}>已回答</div>
                </div>
              )}
            </React.Fragment>
          ))}

          {/* Current question */}
          {!loading && currentQuestion && (
            <div className="message-wrapper ai">
              <div className="ai-bubble">
                <div className="bubble-text" style={{ fontWeight: 700 }}>{currentQuestion.title}</div>
                {currentQuestion.prompt && (
                  <div className="bubble-text" style={{ opacity: 0.7, marginTop: 4 }}>{currentQuestion.prompt}</div>
                )}
              </div>
              {currentQuestion.options.length > 0 && (
                <div className="options-row">
                  {currentQuestion.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`option-btn pressable ${draft === option ? 'primary' : ''}`}
                      onClick={() => handleOptionClick(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No questions state */}
          {!loading && !currentQuestion && !error && (
            <div className="message-wrapper ai">
              <div className="ai-bubble">
                <div className="bubble-text">所有问题已完成！点击下方按钮返回画像页查看更新结果。</div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ alignSelf: 'center', fontSize: 9, color: '#EF4444', padding: '4px 10px', background: '#fef2f2', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area (active question) */}
        {!loading && currentQuestion && (
          <div className="input-area">
            <input
              className="message-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={currentQuestion.placeholder || '输入你的回答...'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <button
              type="button"
              className="send-btn pressable"
              onClick={handleSend}
              disabled={submitting}
              aria-label="发送"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M7 2l5 5-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Done actions */}
        {!loading && !currentQuestion && (
          <div className="action-buttons">
            <button
              type="button"
              className="action-btn secondary pressable"
              onClick={() => navigate('/profile')}
            >
              返回画像页
            </button>
            {answeredCount > 0 && (
              <button
                type="button"
                className="action-btn primary pressable"
                disabled={submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting ? '写回中...' : '提交并更新画像'}
              </button>
            )}
          </div>
        )}
      </div>
    </MobileShell>
  )
}

export default ChatFillPage
