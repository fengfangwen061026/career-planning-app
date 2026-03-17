import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileShell from '../components/MobileShell'
import './ReportPage.css'

interface Chapter {
  title: string
  content?: string
  gridData?: { label: string; value: number }[]
  actions?: { text: string; type: 'green' | 'orange'; }[]
  timeline?: { current: boolean; label?: string; name: string; cond: string; color: string }[]
}

const chapters: Chapter[] = [
  {
    title: '一、个人优势总结',
    content: `张同学就读上海交大计算机科学专业，Python 熟练度 88 分，综合竞争力 <span style={{color:'#4F46E5',fontWeight:700}}>82/100</span>，同类求职者 Top 23%。ACM 区域赛铜奖体现出扎实的算法思维，实习经历覆盖推荐算法与 A/B 测试，具备一定的工程落地经验。`
  },
  {
    title: '二、目标岗位分析',
    content: `后端开发工程师岗位综合匹配度 <span style={{color:'#4F46E5',fontWeight:700}}>89 分</span>。基础要求（学历/专业/实习）全部满足；核心技能 Python、MySQL 强匹配；缺失 Redis，微服务经验较弱。`,
    gridData: [
      { label: '学历匹配', value: 95 },
      { label: '技能匹配', value: 82 },
      { label: '经验匹配', value: 78 },
      { label: '综合竞争力', value: 88 }
    ]
  },
  {
    title: '三、差距与行动计划',
    content: `主要差距集中在 Redis 缺失（-15分）和项目量化表达不足（-8分）。建议优先行动：`,
    actions: [
      { text: '学习 Redis 基础（缓存/分布式锁），2–3周可掌握核心用法', type: 'green' },
      { text: '补充项目量化数据：用户量 300+、接口响应降低 40% 写入简历', type: 'green' },
      { text: '完成微服务入门项目，补充项目经验', type: 'orange' }
    ]
  },
  {
    title: '四、职业路径规划',
    content: `推荐主路径为垂直晋升，备选横向转岗至数据工程师（技能重叠 62%）。`,
    timeline: [
      { current: true, name: '现在 · 后端开发（初级）', cond: '补 Redis、量化简历描述', color: '#4F46E5' },
      { current: false, label: '2', name: '2年后 · 后端开发（中级）', cond: '微服务 + 高并发系统设计', color: '#9CA3AF' },
      { current: false, label: '3', name: '5年+ · 技术负责人', cond: '架构设计 + 团队管理', color: '#9CA3AF' }
    ]
  },
  {
    title: '五、评估周期',
    content: `建议每 3 个月对照行动计划自评一次：Redis 学习完成度、简历更新情况、新增项目经验。6 个月后可重新上传简历重新匹配，验证竞争力提升效果。`
  }
]

const GeneratedChapter: React.FC<{ chapter: Chapter; index: number }> = ({ chapter, index }) => {
  const hasGrid = chapter.gridData && chapter.gridData.length > 0
  const hasActions = chapter.actions && chapter.actions.length > 0
  const hasTimeline = chapter.timeline && chapter.timeline.length > 0

  return (
    <div className="chapter-card generated-chapter" style={{ animationDelay: `${index * 0.1}s` }}>
      <div className="chapter-header">
        <span className="chapter-title">{chapter.title}</span>
        <span className="chapter-tag">已生成</span>
      </div>
      <div className="chapter-content">
        {chapter.content && (
          <p
            className="chapter-text"
            dangerouslySetInnerHTML={{ __html: chapter.content }}
          />
        )}

        {hasGrid && (
          <div className="chapter-grid">
            {chapter.gridData!.map((item, i) => (
              <div key={i} className="grid-item">
                <span className="grid-label">{item.label}</span>
                <span className="grid-value">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {hasActions && (
          <div className="action-list">
            {chapter.actions!.map((action, i) => (
              <div key={i} className={`action-item action-${action.type}`}>
                <span className="action-number">{i + 1}</span>
                <span className="action-text">{action.text}</span>
              </div>
            ))}
          </div>
        )}

        {hasTimeline && (
          <div className="timeline">
            {chapter.timeline!.map((item, i) => (
              <div key={i} className="timeline-item">
                <div className="timeline-left">
                  <div className={`timeline-node ${item.current ? 'current' : ''}`}>
                    {item.current ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span className="timeline-label">{item.label}</span>
                    )}
                  </div>
                  {i < chapter.timeline!.length - 1 && <div className="timeline-line" />}
                </div>
                <div className="timeline-right">
                  <span className="timeline-name" style={{ color: item.color }}>{item.name}</span>
                  <span className="timeline-cond">{item.cond}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const LoadingChapter: React.FC<{ chapter: Chapter }> = ({ chapter }) => {
  return (
    <div className="chapter-card loading-chapter">
      <div className="chapter-header">
        <span className="chapter-title">{chapter.title}</span>
        <div className="loading-indicator">
          <span className="loading-dot" />
          <span className="loading-text">生成中</span>
        </div>
      </div>
      <div className="skeleton-content">
        <div className="skeleton-bar" style={{ width: '90%' }} />
        <div className="skeleton-bar" style={{ width: '100%' }} />
        <div className="skeleton-bar" style={{ width: '75%' }} />
        <div className="skeleton-bar" style={{ width: '85%' }} />
      </div>
    </div>
  )
}

const PendingChapter: React.FC<{ chapter: Chapter; opacity: number }> = ({ chapter, opacity }) => {
  return (
    <div className="pending-chapter" style={{ opacity }}>
      <span className="chapter-title">{chapter.title}</span>
      <span className="pending-tag">待生成</span>
    </div>
  )
}

const ReportPage: React.FC = () => {
  const navigate = useNavigate()
  const [generationState, setGenerationState] = useState<'loading' | 'done'>('loading')
  const [generatedCount, setGeneratedCount] = useState(1)

  useEffect(() => {
    if (generationState !== 'loading') return
    const timer = setInterval(() => {
      setGeneratedCount(prev => {
        if (prev >= 5) {
          clearInterval(timer)
          setTimeout(() => setGenerationState('done'), 600)
          return 5
        }
        return prev + 1
      })
    }, 1200)
    return () => clearInterval(timer)
  }, [generationState])

  const handleExport = () => {
    // Mock export functionality
    console.log('Export PDF')
  }

  return (
    <MobileShell hasTabBar activeTab="report">
      <div className="report-page">
        <div className="report-header">
          <div className="header-left">
            <div className="header-title">职业发展报告</div>
            <div className="header-subtitle">张同学 · 后端开发工程师</div>
          </div>
          <button
            className={`export-btn ${generationState === 'loading' ? 'loading' : 'done'}`}
            onClick={handleExport}
            disabled={generationState === 'loading'}
          >
            {generationState === 'loading' ? '导出 PDF' : '↓ 导出'}
          </button>
        </div>

        <div className="report-content">
          {chapters.map((chapter, i) => {
            if (i < generatedCount) {
              return <GeneratedChapter key={i} chapter={chapter} index={i} />
            }
            if (i === generatedCount) {
              return <LoadingChapter key={i} chapter={chapter} />
            }
            return (
              <PendingChapter
                key={i}
                chapter={chapter}
                opacity={i - generatedCount === 1 ? 0.35 : i - generatedCount === 2 ? 0.2 : 0.5}
              />
            )
          })}
        </div>
      </div>
    </MobileShell>
  )
}

export default ReportPage
