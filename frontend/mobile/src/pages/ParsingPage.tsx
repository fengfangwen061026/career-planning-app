import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileShell from '../components/MobileShell'
import './ParsingPage.css'

const steps = [
  '读取简历文件',
  '识别教育经历',
  '抽取技能 & 项目',
  '识别证书 & 荣誉',
  '生成学生画像',
]

const ParsingPage: React.FC = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1
        }
        clearInterval(timer)
        // 所有步骤完成后，延迟 2 秒跳转到 profile
        setTimeout(() => {
          navigate('/profile')
        }, 2000)
        return prev
      })
    }, 1500)

    return () => clearInterval(timer)
  }, [navigate])

  const renderStepIcon = (index: number) => {
    if (index < currentStep) {
      // 已完成
      return (
        <svg width="14" height="14" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="7" fill="#10B981"/>
          <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      )
    } else if (index === currentStep) {
      // 进行中
      return (
        <svg width="14" height="14" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="6" stroke="#4F46E5" fill="#EEF2FF"/>
          <circle cx="7" cy="7" r="3" fill="#4F46E5" style={{ animation: 'pulse 1.5s infinite' }}/>
        </svg>
      )
    } else {
      // 待执行
      const opacity = 0.5 - (index - currentStep - 1) * 0.15
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" style={{ opacity }}>
          <circle cx="7" cy="7" r="6" stroke="#D1D5DB" fill="#F3F4F6"/>
        </svg>
      )
    }
  }

  const getStepClass = (index: number) => {
    if (index < currentStep) return 'step-completed'
    if (index === currentStep) return 'step-active'
    return 'step-pending'
  }

  return (
    <MobileShell hasTabBar={false}>
      <div className="parsing-page">
        {/* 顶部动画进度圈 */}
        <div className="parsing-progress-container">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" stroke="#E5E7EB" strokeWidth="5" fill="none"/>
            <circle
              cx="32"
              cy="32"
              r="26"
              stroke="#4F46E5"
              strokeWidth="5"
              fill="none"
              strokeDasharray="163"
              strokeDashoffset="40"
              strokeLinecap="round"
              transform="rotate(-90 32 32)"
              style={{ animation: 'pulse 1.5s infinite' }}
            />
          </svg>
          <div className="parsing-document-icon">
            <svg width="22" height="22" viewBox="0 0 22 22">
              <rect x="3" y="2" width="16" height="18" rx="2" stroke="#4F46E5" strokeWidth="1.5" fill="none"/>
              <line x1="7" y1="7" x2="15" y2="7" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="7" y1="11" x2="15" y2="11" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="7" y1="15" x2="12" y2="15" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* 标题 */}
        <h1 className="parsing-title">正在解析你的简历</h1>
        <p className="parsing-subtitle">通常需要 15–30 秒</p>

        {/* 五步流程列表 */}
        <div className="parsing-steps">
          {steps.map((step, index) => (
            <div key={index} className={`parsing-step ${getStepClass(index)}`}>
              <div className="parsing-step-icon">
                {renderStepIcon(index)}
              </div>
              <span className="parsing-step-text">{step}</span>
            </div>
          ))}
        </div>

        {/* 底部提示 */}
        <p className="parsing-hint">可以先去做别的，完成后通知你</p>
      </div>
    </MobileShell>
  )
}

export default ParsingPage
