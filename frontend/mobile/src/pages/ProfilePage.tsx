import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import MobileShell from '../components/MobileShell'
import './ProfilePage.css'

const ProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [justUpdated, setJustUpdated] = useState(location.state?.justUpdated === true)
  const [completeness, setCompleteness] = useState(78)
  const [competitiveness, setCompetitiveness] = useState(82)

  useEffect(() => {
    if (justUpdated) {
      // Animate completeness from 78% to 86%
      const targetCompleteness = 86
      const completenessInterval = setInterval(() => {
        setCompleteness(prev => {
          if (prev >= targetCompleteness) {
            clearInterval(completenessInterval)
            return targetCompleteness
          }
          return prev + 1
        })
      }, 50)

      // Animate competitiveness from 82 to 88
      const targetCompetitiveness = 88
      const competitivenessInterval = setInterval(() => {
        setCompetitiveness(prev => {
          if (prev >= targetCompetitiveness) {
            clearInterval(competitivenessInterval)
            return targetCompetitiveness
          }
          return prev + 1
        })
      }, 50)

      // Clear highlight after 4 seconds
      const timer = setTimeout(() => setJustUpdated(false), 4000)

      return () => {
        clearInterval(completenessInterval)
        clearInterval(competitivenessInterval)
        clearTimeout(timer)
      }
    }
  }, [justUpdated])

  const missingItems = [
    { name: '项目量化成果', desc: '2个项目缺少数据指标', score: '-12分' },
    { name: '沟通能力证据', desc: '缺少社团、演讲、跨团队协作', score: '-6分' },
    { name: '实习收获描述', desc: 'XX公司实习描述过于简单', score: '-4分' },
  ]

  return (
    <MobileShell hasTabBar activeTab="profile">
      <div className="profile-content">
        {/* 1. 顶部用户信息行 */}
        <div className="profile-header" style={{ animationDelay: '0s' }}>
          <div className="profile-avatar">张</div>
          <div className="profile-info">
            <div className="profile-name">张同学</div>
            <div className="profile-subtitle">CS · 大三 · 上海交大</div>
          </div>
          <div className="profile-completeness-tag">
            完整度 {completeness}%
            {justUpdated && (
              <div className="updated-badge">
                <svg width="8" height="8" viewBox="0 0 8 8">
                  <circle cx="4" cy="4" r="4" fill="#10B981" />
                  <path d="M2 4l1.5 1.5 3-3" stroke="white" strokeWidth="1" strokeLinecap="round" fill="none" />
                </svg>
                <span>刚刚更新</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. 综合数据卡 */}
        <div className="profile-card" style={{ animationDelay: '0.05s' }}>
          <div className="profile-score-ring">
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="21" stroke="var(--color-border-primary)" strokeWidth="5" fill="none" />
              <circle
                cx="26"
                cy="26"
                r="21"
                stroke="var(--color-primary)"
                strokeWidth="5"
                fill="none"
                strokeDasharray="132"
                strokeDashoffset="29"
                strokeLinecap="round"
                transform="rotate(-90 26 26)"
              />
            </svg>
            <div className="profile-score-text">
              <span
                className="profile-score-value"
                style={{ color: justUpdated ? 'var(--color-success)' : 'var(--color-primary)' }}
              >
                {competitiveness}
              </span>
              <span className="profile-score-label">竞争力</span>
            </div>
          </div>
          <div className="profile-score-data">
            <div className="profile-data-row">
              <span className="profile-data-label">简历完整度</span>
              <span
                className="profile-data-value"
                style={{ color: justUpdated ? 'var(--color-success)' : 'var(--color-warning)' }}
              >
                {completeness}%
              </span>
            </div>
            <div className="profile-data-progress">
              <div
                className="profile-data-progress-fill"
                style={{
                  width: `${completeness}%`,
                  background: justUpdated ? 'var(--color-success)' : 'var(--color-warning)',
                  transition: justUpdated ? 'width 0.9s cubic-bezier(0.34,1.56,0.64,1)' : 'none'
                }}
              />
            </div>
            <div className="profile-data-row">
              <span className="profile-data-label">高匹配岗位</span>
              <span className="profile-data-value success">14个</span>
            </div>
          </div>
        </div>

        {/* 3. 技术技能卡 */}
        <div className="profile-card" style={{ animationDelay: '0.1s' }}>
          <div className="profile-card-header">
            <div className="profile-card-indicator blue" />
            <span className="profile-card-title">技术技能</span>
          </div>
          <div className="skill-list">
            {[
              { name: 'Python', level: 88, color: '#1D4ED8' },
              { name: 'React', level: 75, color: '#3B82F6' },
              { name: 'SQL', level: 70, color: '#3B82F6' },
              { name: '机器学习', level: 60, color: '#60A5FA' },
              { name: 'Docker', level: 45, color: '#93C5FD' },
            ].map((skill) => (
              <div className="skill-row" key={skill.name}>
                <span className="skill-name">{skill.name}</span>
                <div className="skill-track">
                  <div
                    className="skill-fill"
                    style={{ width: `${skill.level}%`, backgroundColor: skill.color }}
                  />
                </div>
                <span className="skill-value">{skill.level}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. 实习 & 项目卡 */}
        <div
          className="profile-card"
          style={{ animationDelay: '0.15s' }}
          data-highlight={justUpdated ? 'true' : 'false'}
        >
          <div className="profile-card-header">
            <div className="profile-card-indicator green" />
            <span className="profile-card-title">实习 & 项目</span>
            {justUpdated && <span className="updated-tag-small">刚刚更新</span>}
          </div>
          <div className="experience-item">
            <div className="experience-title">XX公司 · 算法实习生</div>
            <div className="experience-duration">2024.07–09 · 2个月</div>
            <div className="experience-tags">
              <span className="tag tag-green">推荐算法</span>
              <span className="tag tag-blue">A/B测试</span>
            </div>
          </div>
          <div className="experience-divider" />
          <div className="experience-item">
            <div className="experience-title">校园二手交易平台</div>
            <div className="experience-duration">个人项目 · React + FastAPI</div>
            {justUpdated ? (
              <div className="project-highlight">
                累计用户 <strong>300+</strong>，接口响应降低 <strong>40%</strong>，独立完成全栈开发
              </div>
            ) : (
              <div className="experience-tags">
                <span className="tag tag-blue">全栈</span>
                <span className="tag tag-orange">用户增长</span>
              </div>
            )}
          </div>
          <div className="profile-notice">
            <span className="profile-notice-icon">⚠</span>
            <span>两个项目均缺少量化成果，建议补充数据指标</span>
          </div>
        </div>

        {/* 5. 证书 & 荣誉卡 */}
        <div className="profile-card" style={{ animationDelay: '0.2s' }}>
          <div className="profile-card-header">
            <div className="profile-card-indicator orange" />
            <span className="profile-card-title">证书 & 荣誉</span>
          </div>
          <div className="tags-container">
            <span className="tag tag-green">CET-6 · 568</span>
            <span className="tag tag-blue">ACM 区域铜奖</span>
            <span className="tag tag-orange">国家励志奖学金</span>
            <span className="tag tag-blue">阿里云 ACA</span>
          </div>
        </div>

        {/* 6. 软素养卡 */}
        <div className="profile-card" style={{ animationDelay: '0.25s' }}>
          <div className="profile-card-header">
            <div className="profile-card-indicator purple" />
            <span className="profile-card-title">软素养</span>
          </div>
          <div className="tags-container">
            <span className="tag tag-blue">自驱学习 · 3项</span>
            <span className="tag tag-green">团队协作 · 2项</span>
            <span className="tag tag-orange">抗压 · 1项</span>
            <span className="tag tag-gray">沟通 · 待补充</span>
          </div>
        </div>

        {/* 7. 待补全项卡片 - 替换为缺失项提示条 */}
        {justUpdated ? (
          <div className="missing-items-prompt">
            <div>
              <div className="missing-title">还有 2 处未补全</div>
              <div className="missing-subtitle">沟通能力、实习收获描述</div>
            </div>
            <button
              className="continue-btn"
              onClick={() => navigate('/chat-fill')}
            >
              继续 →
            </button>
          </div>
        ) : (
          <div className="profile-card" style={{ animationDelay: '0.3s' }}>
            <div className="profile-card-header">
              <div className="profile-card-indicator red" />
              <span className="profile-card-title">待补全项 · 3处</span>
            </div>
            <div className="missing-items-desc">补全后预计竞争力提升 +12分</div>
            {missingItems.map((item, index) => (
              <div className="missing-item" key={item.name}>
                {index > 0 && <div className="missing-item-divider" />}
                <div className="missing-item-content">
                  <div className="missing-item-info">
                    <div className="missing-item-name">{item.name}</div>
                    <div className="missing-item-desc">{item.desc}</div>
                  </div>
                  <div className="missing-item-score">{item.score}</div>
                </div>
                <div className="missing-item-action">
                  <span className="missing-item-hint">AI 对话帮你补充 →</span>
                  <button
                    className="missing-item-btn"
                    onClick={() => navigate('/chat-fill')}
                  >
                    立即补全
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 8. 底部主操作按钮 */}
        <button
          className="profile-action-btn"
          onClick={() => navigate('/explore')}
        >
          探索匹配岗位 →
        </button>
      </div>
    </MobileShell>
  )
}

export default ProfilePage
