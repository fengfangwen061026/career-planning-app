import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileShell from '../components/MobileShell'
import './ChatFillPage.css'

interface Message {
  role: 'ai' | 'user'
  text: string
  options?: string[]
  timestamp?: string
}

type ChatState = 'chatting' | 'done'

const ChatFillPage: React.FC = () => {
  const navigate = useNavigate()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [chatState, setChatState] = useState<ChatState>('chatting')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      text: '你好！我来帮你补充校园二手平台项目的量化成果。请问这个项目上线后，累计注册用户大约有多少？',
      options: ['100人以下', '100–500人', '500人以上', '不清楚']
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, { ...message, timestamp: '刚刚' }])
  }

  const handleOptionClick = (option: string) => {
    addMessage({ role: 'user', text: option })
    setIsTyping(true)

    setTimeout(() => {
      setIsTyping(false)
      if (currentQuestion === 0) {
        addMessage({
          role: 'ai',
          text: '很好！300+ 用户是个不错的数据。项目运行期间有没有做过性能优化？比如接口响应时间、并发数提升之类的？',
          options: ['有，接口提速', '有，减少了Bug', '没有做优化']
        })
        setCurrentQuestion(1)
      } else {
        setChatState('done')
        // Add completion messages
        setTimeout(() => {
          addMessage({
            role: 'ai',
            text: '非常棒！我已经收集到足够的信息了。基于你的回答，已为你生成优化后的项目描述：'
          })
        }, 100)
      }
    }, 1200)
  }

  const handleSend = () => {
    if (!inputValue.trim()) return
    handleOptionClick(inputValue.trim())
    setInputValue('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  const handleContinue = () => {
    // Continue to next set of questions - mock behavior
    console.log('Continue to next question')
  }

  const handleLater = () => {
    navigate('/profile')
  }

  const handleWriteProfile = () => {
    navigate('/profile')
  }

  // Calculate progress bar width
  const progressWidth = chatState === 'done' ? '100%' : currentQuestion === 0 ? '25%' : '50%'

  return (
    <MobileShell hasTabBar={false}>
      <div className="chat-fill-container">
        {/* 1. Top Navigation Bar */}
        <div className="top-nav">
          <div className="back-area" onClick={() => navigate('/profile')}>
            <span className="back-dot"></span>
            <span className="back-text">← 返回画像</span>
          </div>
          <div className="nav-title">补充项目量化成果</div>
          <div className="progress-dots">
            {chatState === 'done' ? (
              <>
                <span className="dot active"></span>
                <span className="dot active"></span>
                <span className="dot active"></span>
              </>
            ) : (
              <>
                <span className={`dot ${currentQuestion === 0 ? 'active' : ''}`}></span>
                <span className={`dot ${currentQuestion === 1 ? 'active' : ''}`}></span>
                <span className="dot"></span>
              </>
            )}
          </div>
        </div>

        {/* 2. Sub Progress Bar */}
        <div className="sub-progress">
          <div className="progress-text">
            <span>本次补全进度</span>
            <span className="progress-status">
              {chatState === 'done' ? '完成' : `问题 ${currentQuestion + 1}/4`}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: progressWidth }}></div>
          </div>
        </div>

        {/* Done state title addition */}
        {chatState === 'done' && (
          <div className="done-title">✓ 对话完成</div>
        )}

        {/* 3. Messages Area */}
        <div className="messages-area">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-wrapper ${msg.role}`}>
              {msg.role === 'ai' && (
                <div className="ai-bubble">
                  <div className="bubble-text">{msg.text}</div>
                  {msg.timestamp && <div className="timestamp">{msg.timestamp}</div>}
                  {msg.options && (
                    <div className="options-row">
                      {msg.options.map((opt, optIdx) => (
                        <button
                          key={optIdx}
                          className="option-btn"
                          onClick={() => handleOptionClick(opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {msg.role === 'user' && (
                <div className="user-bubble">
                  <div className="bubble-text">{msg.text}</div>
                  {msg.timestamp && <div className="timestamp">{msg.timestamp}</div>}
                </div>
              )}

              {/* Show generated content after completion */}
              {idx === messages.length - 1 && chatState === 'done' && msg.role === 'ai' && (
                <div className="generated-card">
                  <div className="card-title">✦ AI 生成描述</div>
                  <div className="card-content">
                    开发校园二手交易平台（React + FastAPI），累计注册用户 <span className="highlight">300+</span>，日活峰值 80人；通过接口缓存优化，响应时间降低 <span className="highlight">40%</span>；独立完成前后端全栈开发与上线部署。
                  </div>
                </div>
              )}

              {/* AI guidance after generated content */}
              {idx === messages.length - 1 && chatState === 'done' && msg.role === 'ai' && (
                <div className="ai-bubble">
                  <div className="bubble-text">这样写比原来更有说服力。你可以直接写入简历，也可以手动微调。</div>
                  <div className="options-row">
                    <button className="option-btn primary">✓ 直接写入画像</button>
                    <button className="option-btn">✏ 手动编辑</button>
                  </div>
                </div>
              )}

              {/* Effect prediction box */}
              {idx === messages.length - 1 && chatState === 'done' && msg.role === 'ai' && (
                <div className="effect-prediction">
                  <div className="prediction-title">补全后效果预测</div>
                  <div className="prediction-row">
                    <span>完整度</span>
                    <span className="old-value">78%</span>
                    <span>→</span>
                    <span className="new-value">86%</span>
                    <span className="increase">+8%</span>
                  </div>
                  <div className="prediction-row">
                    <span>竞争力</span>
                    <span className="old-value">82%</span>
                    <span>→</span>
                    <span className="new-value">88%</span>
                    <span className="increase">+6%</span>
                  </div>
                </div>
              )}

              {/* AI continue prompt */}
              {idx === messages.length - 1 && chatState === 'done' && msg.role === 'ai' && (
                <div className="ai-bubble">
                  <div className="bubble-text">还有 2 处缺失项（沟通能力、实习收获），要继续补充吗？</div>
                  <div className="options-row">
                    <button className="option-btn primary" onClick={handleContinue}>继续补全</button>
                    <button className="option-btn" onClick={handleLater}>稍后再说</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="message-wrapper ai">
              <div className="ai-bubble typing">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef}></div>
        </div>

        {/* 4. Bottom Input Bar (Chatting State) or Action Buttons (Done State) */}
        {chatState === 'chatting' ? (
          <div className="input-area">
            <input
              type="text"
              className="message-input"
              placeholder="输入回答，或选择上方选项..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button className="send-btn" onClick={handleSend}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6h8M6 2l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        ) : (
          <div className="action-buttons">
            <button className="action-btn secondary" onClick={handleLater}>稍后再说</button>
            <button className="action-btn primary" onClick={handleWriteProfile}>写入画像 ✓</button>
          </div>
        )}
      </div>
    </MobileShell>
  )
}

export default ChatFillPage
