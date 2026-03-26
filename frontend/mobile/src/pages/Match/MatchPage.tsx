import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const DIMS = [
  { label: '基础', score: 95, color: '#1D4ED8' },
  { label: '技能', score: 82, color: '#3B82F6' },
  { label: '素养', score: 78, color: '#10B981' },
  { label: '潜力', score: 88, color: '#D97706' },
]

const GAPS = [
  { color: '#EF4444', title: 'Redis 缺失',   desc: '必备技能 · 影响 -15分' },
  { color: '#EF4444', title: '量化成果不足', desc: '简历表达 · 影响 -8分' },
  { color: '#D97706', title: '微服务经验弱', desc: '加分项 · 可补充' },
  { color: '#10B981', title: 'Python · 强匹配', desc: '核心技能完全匹配' },
]

const PATH_VERTICAL = [
  { label: '后端开发（初级）', cond: '补 Redis + 量化描述', current: true },
  { label: '后端开发（中级）', cond: '2年 · 微服务+高并发', current: false },
  { label: '技术负责人',       cond: '5年+ · 架构+带团队', current: false },
]

const PATH_LATERAL = [
  { label: '数据工程师 →',    cond: '技能重叠 68%', color: '#10B981' },
  { label: '全栈工程师 →',    cond: '技能重叠 72%', color: '#10B981' },
]

export default function MatchPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  return (
    <>
      <div className="scroll-body" style={{ padding: '12px 12px 0' }}>
        {/* 顶部 */}
        <div style={{ background: 'white', borderRadius: 11, padding: '10px 11px', marginBottom: 8, border: '0.5px solid #E5E7EB' }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#4F46E5', marginBottom: 2, cursor: 'pointer' }} onClick={() => navigate('/explore')}>
            ← 返回探索
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.3px', color: '#0A0A0A' }}>后端开发工程师</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <span className="tag tag-blue">互联网</span>
                <span className="tag tag-gray">初级</span>
                <span className="tag tag-gray">北京/上海</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#4F46E5', letterSpacing: '-1px', lineHeight: 1 }}>89</div>
              <div style={{ fontSize: 8, color: '#9CA3AF' }}>综合匹配</div>
            </div>
          </div>
        </div>

        {/* 四维评分 */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          {DIMS.map(d => (
            <div key={d.label} style={{ flex: 1, background: '#F9FAFB', borderRadius: 8, padding: '7px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.8px', lineHeight: 1, color: d.color }}>{d.score}</div>
              <div style={{ fontSize: 7, color: '#9CA3AF', marginTop: 2, lineHeight: 1.3 }}>{d.label}</div>
            </div>
          ))}
        </div>

        {/* 必备技能卡 */}
        <div className="card">
          <div className="card-hd"><div className="card-hd-bar" style={{ background: '#3B82F6' }} />岗位必备技能</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span className="tag tag-green">Python ✓</span>
            <span className="tag tag-green">MySQL ✓</span>
            <span className="tag tag-red">Redis ✗</span>
            <span className="tag tag-amber">微服务 △</span>
            <span className="tag tag-gray">Kafka 加分</span>
            <span className="tag tag-gray">K8s 加分</span>
          </div>
        </div>

        {/* 差距清单卡 */}
        <div className="card">
          <div className="card-hd"><div className="card-hd-bar" style={{ background: '#EF4444' }} />差距清单</div>
          {GAPS.map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 0', borderBottom: i < GAPS.length - 1 ? '0.5px solid #E5E7EB' : 'none' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: g.color, flexShrink: 0, marginTop: 3 }} />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0A0A0A' }}>{g.title}</div>
                <div style={{ fontSize: 9, color: '#6B7280' }}>{g.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 路径规划卡 */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-hd"><div className="card-hd-bar" style={{ background: '#10B981' }} />职业路径</div>

          {/* 垂直晋升 */}
          <div style={{ fontSize: 8, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>垂直晋升</div>
          {PATH_VERTICAL.map((node, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: i < PATH_VERTICAL.length - 1 ? 0 : 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: node.current ? '#4F46E5' : 'white',
                  border: node.current ? 'none' : '1.5px solid #4F46E5',
                  fontSize: 9, fontWeight: 800, color: node.current ? 'white' : '#4F46E5',
                }}>
                  {node.current ? (
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                      <path d="M2 4.5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : i + 1}
                </div>
                {i < PATH_VERTICAL.length - 1 && (
                  <div style={{ width: 1.5, height: 18, background: '#E5E7EB' }} />
                )}
              </div>
              <div style={{ paddingTop: 2 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: node.current ? '#4F46E5' : '#0A0A0A' }}>{node.label}</div>
                <div style={{ fontSize: 9, color: '#6B7280' }}>{node.cond}</div>
              </div>
            </div>
          ))}

          <div style={{ height: '0.5px', background: '#E5E7EB', marginBottom: 7 }} />

          {/* 横向转岗 */}
          <div style={{ fontSize: 8, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>横向转岗</div>
          {PATH_LATERAL.map((node, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: i < PATH_LATERAL.length - 1 ? 0 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'white', border: `1.5px solid ${node.color}`,
                  fontSize: 9, fontWeight: 800, color: node.color,
                }}>→</div>
                {i < PATH_LATERAL.length - 1 && (
                  <div style={{ width: 1.5, height: 18, background: '#D1FAE5' }} />
                )}
              </div>
              <div style={{ paddingTop: 2 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0A0A0A' }}>{node.label}</div>
                <div style={{ fontSize: 9, color: '#6B7280' }}>{node.cond}</div>
              </div>
            </div>
          ))}
        </div>

        <button className="btn-primary" onClick={() => navigate('/report')}>
          生成职业规划报告 →
        </button>
      </div>
    </>
  )
}
