import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './OnboardingFlow.css'

const OnboardingFlow: React.FC = () => {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const navigate = useNavigate()

  const handleNext = () => {
    if (step < 2) {
      setStep((s) => (s + 1) as 0 | 1 | 2)
    } else {
      navigate('/upload')
    }
  }

  const handleSkip = () => {
    navigate('/upload')
  }

  const handleDemo = () => {
    navigate('/upload')
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="onboarding-step">
            <div className="onboarding-illustration">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <rect width="80" height="80" rx="20" fill="#EEF2FF" />
                <rect x="18" y="22" width="44" height="36" rx="4" fill="#C7D2FE" stroke="#4F46E5" strokeWidth="1.5" />
                <rect x="24" y="30" width="32" height="2" rx="1" fill="#4F46E5" fillOpacity="0.6" />
                <rect x="24" y="36" width="24" height="2" rx="1" fill="#4F46E5" fillOpacity="0.4" />
                <rect x="24" y="42" width="28" height="2" rx="1" fill="#4F46E5" fillOpacity="0.4" />
                <circle cx="56" cy="52" r="12" fill="#4F46E5" />
                <path d="M50 52l4 4 8-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <h1 className="onboarding-title">上传简历<br />一键解析</h1>
            <p className="onboarding-subtitle">支持 PDF/Word，AI 自动提取<br />教育、技能、项目、证书等信息</p>
            <button className="onboarding-primary-btn" onClick={handleNext}>下一步</button>
            <button className="onboarding-skip-btn" onClick={handleSkip}>跳过引导</button>
          </div>
        )
      case 1:
        return (
          <div className="onboarding-step">
            <div className="onboarding-illustration">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <rect width="80" height="80" rx="20" fill="#D1FAE5" />
                <circle cx="40" cy="36" r="16" fill="#6EE7B7" stroke="#10B981" strokeWidth="1.5" />
                <circle cx="40" cy="36" r="8" fill="#10B981" />
                <path d="M36 36l3 3 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <rect x="22" y="56" width="36" height="4" rx="2" fill="#10B981" fillOpacity="0.3" />
                <rect x="22" y="56" width="24" height="4" rx="2" fill="#10B981" fillOpacity="0.5" />
              </svg>
            </div>
            <h1 className="onboarding-title">智能匹配<br />找准方向</h1>
            <p className="onboarding-subtitle">四维评分精准分析<br />差距一目了然，路径清晰可见</p>
            <button className="onboarding-primary-btn" onClick={handleNext}>下一步</button>
            <button className="onboarding-skip-btn" onClick={handleSkip}>跳过引导</button>
          </div>
        )
      case 2:
        return (
          <div className="onboarding-step">
            <div className="onboarding-illustration">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <rect width="80" height="80" rx="20" fill="#EEF2FF" />
                <rect x="16" y="28" width="48" height="32" rx="6" fill="#C7D2FE" stroke="#4F46E5" strokeWidth="1" />
                <rect x="22" y="36" width="36" height="2" rx="1" fill="#4F46E5" fillOpacity="0.5" />
                <rect x="22" y="42" width="28" height="2" rx="1" fill="#4F46E5" fillOpacity="0.35" />
                <circle cx="40" cy="22" r="8" fill="#818CF8" stroke="#4F46E5" strokeWidth="1" />
                <circle cx="40" cy="20" r="3" fill="#4F46E5" />
                <path d="M33 28 Q40 24 47 28" fill="#818CF8" />
              </svg>
            </div>
            <h1 className="onboarding-title">开始规划你的<br />职业之路</h1>
            <p className="onboarding-subtitle" style={{ fontSize: '9px', marginBottom: '20px' }}>数据安全存储，随时续用</p>

            <div className="onboarding-form">
              <label className="onboarding-label">手机号 / 邮箱</label>
              <input
                type="text"
                className="onboarding-input"
                placeholder="请输入账号"
              />
            </div>

            <button className="onboarding-primary-btn" onClick={handleNext}>登录 / 注册</button>

            <div className="onboarding-divider">
              <div className="onboarding-divider-line" />
              <span className="onboarding-divider-text">或</span>
              <div className="onboarding-divider-line" />
            </div>

            <button className="onboarding-secondary-btn" onClick={handleDemo}>使用 Demo 账号体验</button>
          </div>
        )
    }
  }

  return (
    <div className="onboarding-container">
      <button className="onboarding-skip-top" onClick={handleSkip}>跳过引导</button>
      {renderStep()}
      <div className="onboarding-dots">
        <span className={`dot ${step >= 0 ? 'active' : ''}`} />
        <span className={`dot ${step >= 1 ? 'active' : ''}`} />
        <span className={`dot ${step >= 2 ? 'active' : ''}`} />
      </div>
    </div>
  )
}

export default OnboardingFlow
