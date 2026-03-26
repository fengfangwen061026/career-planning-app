import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface Message {
  role: 'ai' | 'user'
  text: string
  options?: string[]
}

const INIT_MESSAGES: Message[] = [
  {
    role: 'ai',
    text: '你好！我注意到你的"校园二手交易平台"项目缺少量化成果。能告诉我这个项目的注册用户大概有多少吗？',
    options: ['100人以下', '100–500人', '500人以上', '我不记得了'],
  },
]

export default function ChatFillPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>(INIT_MESSAGES)
  const [input, setInput] = useState('')
  const [step, setStep] = useState(1)
  const [totalSteps] = useState(4)
  const [done, setDone] = useState(false)
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing, done])

  const sendMessage = (text: string) => {
    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setTyping(true)

    setTimeout(() => {
      setTyping(false)
      if (step < totalSteps) {
        const nextStep = step + 1
        setStep(nextStep)
        if (nextStep === totalSteps) {
          setMessages(prev => [...prev, {
            role: 'ai',
            text: '很好！我还想了解一下接口性能优化的效果，响应时间大约降低了多少？',
            options: ['20%以下', '20–40%', '40%以上', '没有测量过'],
          }])
        } else {
          setMessages(prev => [...prev, {
            role: 'ai',
            text: '明白了！另外，日活跃用户峰值大约是多少？',
            options: ['50人以下', '50–100人', '100人以上'],
          }])
        }
      } else {
        setDone(true)
      }
    }, 1200)
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'white' }}>
      {/* 顶部导航 */}
      <div style={{ padding: '10px 12px', background: 'white', borderBottom: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4F46E5', marginRight: -2, flexShrink: 0 }} />
        <div style={{ fontSize: 9, color: '#4F46E5', fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate('/profile')}>← 返回画像</div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0A0A0A' }}>补充项目量化成果</div>
          <div style={{ fontSize: 8, color: '#9CA3AF' }}>缺失项 1/3</div>
        </div>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ width: i === 0 ? 16 : 6, height: 4, borderRadius: 2, background: i === 0 ? '#4F46E5' : '#E5E7EB' }} />
          ))}
        </div>
      </div>

      {/* 子进度条 */}
      <div style={{ padding: '6px 10px', background: 'white', borderBottom: '0.5px solid #E5E7EB' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 8, color: '#6B7280' }}>本次补全进度</span>
          <span style={{ fontSize: 8, fontWeight: 700, color: '#4F46E5' }}>问题 {step}/{totalSteps}</span>
        </div>
        <div style={{ height: 3, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${(step / totalSteps) * 100}%`, height: '100%', background: '#4F46E5', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* 消息流 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#F9FAFB' }}>
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
                    onClick={() => sendMessage(opt)}
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
            {/* AI 生成描述 */}
            <div style={{ background: 'white', border: '1px solid #4F46E5', borderRadius: 8, padding: 10, margin: '2px 0' }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>✦ AI 生成描述</div>
              <div style={{ fontSize: 9, color: '#374151', lineHeight: 1.8 }}>
                开发校园二手交易平台（React + FastAPI），累计注册用户 <strong style={{ color: '#1D4ED8' }}>300+</strong>，日活峰值 <strong style={{ color: '#1D4ED8' }}>80人</strong>；通过接口缓存优化，响应时间降低 <strong style={{ color: '#1D4ED8' }}>40%</strong>；独立完成前后端全栈开发与上线部署。
              </div>
            </div>
            {/* 效果预测 */}
            <div style={{ background: '#D1FAE5', border: '0.5px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '8px 10px', marginTop: 6 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#065F46', marginBottom: 4 }}>补全后效果预测</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 9, color: '#065F46' }}>完整度</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: '#D97706', fontWeight: 700 }}>78%</span>
                  <span style={{ fontSize: 9, color: '#065F46' }}>→</span>
                  <span style={{ fontSize: 11, color: '#065F46', fontWeight: 800 }}>86%</span>
                  <span style={{ fontSize: 9, color: '#10B981' }}>+8%</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                <div style={{ fontSize: 9, color: '#065F46' }}>竞争力评分</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: '#D97706', fontWeight: 700 }}>82</span>
                  <span style={{ fontSize: 9, color: '#065F46' }}>→</span>
                  <span style={{ fontSize: 11, color: '#065F46', fontWeight: 800 }}>88</span>
                  <span style={{ fontSize: 9, color: '#10B981' }}>+6</span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 底部 */}
      {done ? (
        <div style={{ padding: '8px 10px', background: 'white', borderTop: '0.5px solid #E5E7EB', display: 'flex', gap: 6 }}>
          <button
            onClick={() => navigate('/profile')}
            style={{ flex: 1, padding: 8, border: '0.5px solid #D1D5DB', background: 'transparent', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            稍后再说
          </button>
          <button
            onClick={() => navigate('/profile')}
            style={{ flex: 1, padding: 8, background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            写入画像 ✓
          </button>
        </div>
      ) : (
        <div style={{ padding: '8px 10px', background: 'white', borderTop: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && input.trim() && sendMessage(input.trim())}
            placeholder="输入你的回答…"
            style={{
              flex: 1, height: 30, border: '0.5px solid #D1D5DB', borderRadius: 15,
              padding: '0 10px', fontSize: 10, background: '#F9FAFB', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => input.trim() && sendMessage(input.trim())}
            style={{ width: 28, height: 28, borderRadius: '50%', background: '#4F46E5', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 6h10M6 1l5 5-5 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
