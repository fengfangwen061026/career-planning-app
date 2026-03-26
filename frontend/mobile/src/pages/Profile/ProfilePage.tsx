import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TabBar from '../../components/TabBar/TabBar'

const SKILLS = [
  { name: 'Python',  pct: 88, color: '#1D4ED8' },
  { name: 'React',   pct: 75, color: '#3B82F6' },
  { name: 'SQL',     pct: 70, color: '#3B82F6' },
  { name: '机器学习', pct: 60, color: '#60A5FA' },
  { name: 'Docker',  pct: 45, color: '#93C5FD' },
]

export default function ProfilePage() {
  const navigate = useNavigate()
  const [justUpdated, setJustUpdated] = useState(false)

  // 竞争力分环形进度
  const score = justUpdated ? 88 : 82
  const circumference = 2 * Math.PI * 21
  const completeness = justUpdated ? 86 : 78
  const strokeOffset = circumference * (1 - score / 100)

  return (
    <>
      {/* 固定顶部 header */}
      <div style={{ padding: '10px 12px', background: 'white', borderBottom: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.4px', color: '#0A0A0A' }}>学生画像</div>
        {justUpdated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: '#D1FAE5', borderRadius: 20 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="5" fill="#10B981"/>
              <path d="M2.5 5l2 2 3-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 8, fontWeight: 600, color: '#065F46' }}>刚刚更新</span>
          </div>
        ) : (
          <button
            onClick={() => setJustUpdated(true)}
            style={{ fontSize: 8, color: '#4F46E5', background: 'none', border: '0.5px solid #4F46E5', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit' }}
          >模拟更新</button>
        )}
      </div>

      <div className="scroll-body" style={{ padding: '10px 12px 0' }}>
        {/* 顶部用户信息行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', background: '#EEF2FF',
            color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 12, flexShrink: 0,
          }}>张</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.3px' }}>张同学</div>
            <div style={{ fontSize: 9, color: '#6B7280' }}>CS · 大三 · 上海交大</div>
          </div>
          <span className="tag tag-amber" style={{ marginLeft: 'auto' }}>完整度 {completeness}%</span>
        </div>

        {/* 综合数据卡 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
            <svg width="52" height="52" viewBox="0 0 52 52" style={{ position: 'absolute', top: 0, left: 0 }}>
              <circle cx="26" cy="26" r="21" fill="none" stroke="#E5E7EB" strokeWidth="5"/>
              <circle cx="26" cy="26" r="21" fill="none" stroke="#4F46E5" strokeWidth="5"
                strokeDasharray={`${circumference}`} strokeDashoffset={strokeOffset}
                strokeLinecap="round" transform="rotate(-90 26 26)"/>
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#4F46E5', letterSpacing: '-0.5px' }}>{score}</div>
              <div style={{ fontSize: 7, color: '#9CA3AF', lineHeight: 1.2 }}>竞争力</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: '#6B7280' }}>简历完整度</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {justUpdated && <span style={{ fontSize: 9, color: '#9CA3AF', textDecoration: 'line-through' }}>78%</span>}
                <span style={{ fontSize: 11, fontWeight: 800, color: justUpdated ? '#10B981' : '#D97706' }}>{completeness}%</span>
                {justUpdated && <span style={{ fontSize: 8, fontWeight: 700, color: '#10B981' }}>+8%</span>}
              </div>
            </div>
            <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden', marginBottom: 7 }}>
              <div style={{ width: `${completeness}%`, height: '100%', background: justUpdated ? '#10B981' : '#D97706', borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: '#6B7280' }}>竞争力评分</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {justUpdated && <span style={{ fontSize: 9, color: '#9CA3AF', textDecoration: 'line-through' }}>82</span>}
                <span style={{ fontSize: 11, fontWeight: 800, color: justUpdated ? '#10B981' : '#10B981' }}>{score}</span>
                {justUpdated && <span style={{ fontSize: 8, fontWeight: 700, color: '#10B981' }}>+6</span>}
              </div>
            </div>
          </div>
        </div>

        {/* 技术技能卡 */}
        <div className="card">
          <div className="card-hd"><div className="card-hd-bar" style={{ background: '#3B82F6' }} />技术技能</div>
          {SKILLS.map((sk, i) => (
            <div key={sk.name} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: i < SKILLS.length - 1 ? 5 : 0 }}>
              <span style={{ fontSize: 10, color: '#374151', width: 50, flexShrink: 0 }}>{sk.name}</span>
              <div style={{ flex: 1, height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${sk.pct}%`, height: '100%', background: sk.color, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 9, color: '#9CA3AF', width: 20, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sk.pct}</span>
            </div>
          ))}
        </div>

        {/* 实习&项目卡 */}
        <div className="card" style={justUpdated ? { border: '0.5px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.03)' } : {}}>
          <div className="card-hd" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div className="card-hd-bar" style={{ background: '#10B981' }} />
              实习 &amp; 项目
            </div>
            {justUpdated && <span className="tag tag-green">刚刚更新</span>}
          </div>
          <div style={{ marginBottom: 7 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#0A0A0A' }}>XX公司 · 算法实习生</div>
            <div style={{ fontSize: 9, color: '#6B7280', margin: '1px 0 4px' }}>2024.07–09 · 2个月</div>
            <div style={{ display: 'flex', gap: 3 }}>
              <span className="tag tag-green">推荐算法</span>
              <span className="tag tag-blue">A/B测试</span>
            </div>
          </div>
          <div style={{ height: '0.5px', background: '#E5E7EB', marginBottom: 7 }} />
          <div style={justUpdated ? { background: '#D1FAE5', borderLeft: '2px solid #10B981', padding: '6px 8px', borderRadius: '0 6px 6px 0' } : {}}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#0A0A0A' }}>校园二手交易平台</div>
            <div style={{ fontSize: 9, color: '#6B7280', margin: '1px 0 4px' }}>个人项目 · React + FastAPI</div>
            {justUpdated && (
              <div style={{ fontSize: 9, color: '#374151', lineHeight: 1.6, marginBottom: 4 }}>
                用户规模 <strong style={{ color: '#065F46' }}>300+</strong>，接口响应降低 <strong style={{ color: '#065F46' }}>40%</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: 3 }}>
              <span className="tag tag-blue">全栈</span>
              <span className="tag tag-amber">用户增长</span>
            </div>
          </div>
          {!justUpdated && <div className="notice">⚠ 两个项目均缺少量化成果，建议补充数据指标</div>}
        </div>

        {/* 证书&荣誉卡 */}
        <div className="card">
          <div className="card-hd"><div className="card-hd-bar" style={{ background: '#D97706' }} />证书 &amp; 荣誉</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span className="tag tag-green">CET-6 · 568</span>
            <span className="tag tag-blue">ACM 区域铜奖</span>
            <span className="tag tag-amber">国家励志奖学金</span>
            <span className="tag tag-blue">阿里云 ACA</span>
          </div>
        </div>

        {/* 软素养卡 */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-hd"><div className="card-hd-bar" style={{ background: '#4F46E5' }} />软素养</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span className="tag tag-blue">自驱学习 · 3项</span>
            <span className="tag tag-green">团队协作 · 2项</span>
            <span className="tag tag-amber">抗压 · 1项</span>
            <span className="tag tag-gray">沟通 · 待补充</span>
          </div>
        </div>

        {justUpdated && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FEF3C7', borderRadius: 9, padding: '8px 10px', marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#92400E' }}>还有 2 处未补全</div>
              <div style={{ fontSize: 8, color: '#B45309' }}>沟通能力、实习收获描述</div>
            </div>
            <button style={{ fontSize: 9, fontWeight: 700, color: '#92400E', background: 'none', border: '0.5px solid #D97706', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>继续 →</button>
          </div>
        )}
        <button className="btn-primary" onClick={() => navigate('/explore')}>
          探索匹配岗位 →
        </button>
      </div>
      <TabBar active="profile" />
    </>
  )
}
