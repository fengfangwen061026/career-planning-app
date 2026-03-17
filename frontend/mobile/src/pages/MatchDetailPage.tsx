import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MobileShell from '../components/MobileShell'
import './MatchDetailPage.css'

const MatchDetailPage: React.FC = () => {
  const navigate = useNavigate()
  const { jobId } = useParams<{ jobId: string }>()

  // Mock 数据 - 固定显示后端开发工程师
  const jobData = {
    name: '后端开发工程师',
    tags: ['互联网', '初级岗', '北京/上海'],
    overallScore: 89,
    dimensions: [
      { score: 95, color: '#1D4ED8', label: '基础\n要求' },
      { score: 82, color: '#3B82F6', label: '技术\n技能' },
      { score: 78, color: '#10B981', label: '职业\n素养' },
      { score: 88, color: '#D97706', label: '发展\n潜力' },
    ],
    skills: [
      { name: 'Python', status: 'match', suffix: '✓' },
      { name: 'MySQL', status: 'match', suffix: '✓' },
      { name: 'Redis', status: 'miss', suffix: '✗' },
      { name: '微服务', status: 'weak', suffix: '△' },
      { name: 'Kafka', status: 'bonus', suffix: '加分' },
      { name: 'K8s', status: 'bonus', suffix: '加分' },
    ],
    gaps: [
      { dot: '#EF4444', name: 'Redis 缺失', desc: '必备技能 · 影响 -15分' },
      { dot: '#EF4444', name: '量化成果不足', desc: '简历表达 · 影响 -8分' },
      { dot: '#D97706', name: '微服务经验弱', desc: '加分项 · 可补充' },
      { dot: '#10B981', name: 'Python 强匹配', desc: '核心技能完全匹配' },
      { dot: '#10B981', name: '实习经历符合', desc: '互联网岗 2个月' },
    ],
    verticalPath: [
      { label: '你', name: '后端开发（初级）', condition: '补 Redis + 量化描述' },
      { label: '2', name: '后端开发（中级）', condition: '2年 · 微服务+高并发' },
      { label: '3', name: '技术负责人', condition: '5年+ · 架构+带团队' },
    ],
    horizontalPath: [
      { label: '你', name: '后端开发（初级）', condition: '补 Redis + 量化描述' },
      { label: '→', name: '数据工程师', condition: '重叠 62% · 补 Spark' },
    ],
  }

  const getSkillClass = (status: string) => {
    switch (status) {
      case 'match':
        return 'skill-tag-match'
      case 'miss':
        return 'skill-tag-miss'
      case 'weak':
        return 'skill-tag-weak'
      case 'bonus':
        return 'skill-tag-bonus'
      default:
        return ''
    }
  }

  return (
    <MobileShell hasTabBar activeTab="explore">
      <div className="match-detail-content">
        {/* 1. 顶部信息区 */}
        <div className="match-detail-header">
          <div className="match-detail-back" onClick={() => navigate('/explore')}>
            ← 返回探索
          </div>
          <div className="match-detail-info">
            <div className="match-detail-left">
              <div className="match-detail-title">{jobData.name}</div>
              <div className="match-detail-tags">
                {jobData.tags.map((tag, index) => (
                  <span key={index} className="match-detail-tag">{tag}</span>
                ))}
              </div>
            </div>
            <div className="match-detail-score">
              <div className="match-detail-score-num">{jobData.overallScore}</div>
              <div className="match-detail-score-label">综合匹配</div>
            </div>
          </div>
        </div>

        {/* 2. 四维评分矩阵 */}
        <div className="match-detail-dimensions">
          {jobData.dimensions.map((dim, index) => (
            <div key={index} className="match-detail-dimension">
              <div className="match-detail-dimension-score" style={{ color: dim.color }}>
                {dim.score}
              </div>
              <div className="match-detail-dimension-label">{dim.label}</div>
            </div>
          ))}
        </div>

        {/* 3. 必备技能速览卡 */}
        <div className="match-detail-card">
          <div className="match-detail-card-title">
            <span className="match-detail-card-indicator" style={{ background: '#3B82F6' }}></span>
            岗位必备技能
          </div>
          <div className="match-detail-skills">
            {jobData.skills.map((skill, index) => (
              <span key={index} className={`match-detail-skill-tag ${getSkillClass(skill.status)}`}>
                {skill.name} {skill.suffix}
              </span>
            ))}
          </div>
        </div>

        {/* 4. 差距清单卡 */}
        <div className="match-detail-card">
          <div className="match-detail-card-title">
            <span className="match-detail-card-indicator" style={{ background: '#EF4444' }}></span>
            差距清单
          </div>
          <div className="match-detail-gaps">
            {jobData.gaps.map((gap, index) => (
              <div key={index} className="match-detail-gap-row">
                <div className="match-detail-gap-dot" style={{ background: gap.dot }}></div>
                <div className="match-detail-gap-content">
                  <div className="match-detail-gap-name">{gap.name}</div>
                  <div className="match-detail-gap-desc">{gap.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. 职业路径卡 */}
        <div className="match-detail-card">
          <div className="match-detail-card-title">
            <span className="match-detail-card-indicator" style={{ background: '#10B981' }}></span>
            职业路径
          </div>

          {/* 垂直晋升区 */}
          <div className="match-detail-path-section">
            <div className="match-detail-path-subtitle">垂直晋升</div>
            <div className="match-detail-path-nodes">
              {jobData.verticalPath.map((node, index) => (
                <div key={index} className="match-detail-path-node">
                  <div className="match-detail-path-left">
                    <div className={`match-detail-path-circle ${node.label === '你' ? 'current' : 'future'}`}>
                      {node.label === '你' ? (
                        <svg width="10" height="10" viewBox="0 0 10 10">
                          <path d="M2 5l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        node.label
                      )}
                    </div>
                    {index < jobData.verticalPath.length - 1 && (
                      <div className="match-detail-path-line"></div>
                    )}
                  </div>
                  <div className="match-detail-path-right">
                    <div className="match-detail-path-name">{node.name}</div>
                    <div className="match-detail-path-condition">{node.condition}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="match-detail-path-divider"></div>

          {/* 横向转岗区 */}
          <div className="match-detail-path-section">
            <div className="match-detail-path-subtitle">横向转岗</div>
            <div className="match-detail-path-nodes">
              {jobData.horizontalPath.map((node, index) => (
                <div key={index} className="match-detail-path-node">
                  <div className="match-detail-path-left">
                    <div className={`match-detail-path-circle ${index === 0 ? 'current' : 'transfer'}`}>
                      {node.label}
                    </div>
                    {index < jobData.horizontalPath.length - 1 && (
                      <div className="match-detail-path-line transfer-line"></div>
                    )}
                  </div>
                  <div className="match-detail-path-right">
                    <div className="match-detail-path-name">{node.name}</div>
                    <div className="match-detail-path-condition">{node.condition}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 6. 底部主操作按钮 */}
        <button className="match-detail-action-btn" onClick={() => navigate('/report')}>
          生成职业规划报告 →
        </button>
      </div>
    </MobileShell>
  )
}

export default MatchDetailPage
