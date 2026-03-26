import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STEPS = [
  { label: '读取简历文件', duration: 1200 },
  { label: '抽取技能 & 项目', duration: 2000 },
  { label: '识别证书 & 荣誉', duration: 1800 },
  { label: '分析软素养信号', duration: 1500 },
  { label: '生成学生画像', duration: 2000 },
]

export default function ParsingPage() {
  const navigate = useNavigate()
  const [doneCount, setDoneCount] = useState(0)
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    let idx = 0
    const run = () => {
      if (idx >= STEPS.length) {
        setTimeout(() => navigate('/profile'), 600)
        return
      }
      setActiveIdx(idx)
      setTimeout(() => {
        setDoneCount(idx + 1)
        idx++
        run()
      }, STEPS[idx].duration)
    }
    run()
  }, [navigate])

  const totalMs = STEPS.reduce((s, x) => s + x.duration, 0)
  const doneMs = STEPS.slice(0, doneCount).reduce((s, x) => s + x.duration, 0)
  const progress = doneMs / totalMs
  const circumference = 2 * Math.PI * 26
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px', textAlign: 'center', background: 'white',
    }}>
      {/* 环形进度圈 */}
      <div style={{ position: 'relative', width: 64, height: 64, marginBottom: 16 }}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" fill="none" stroke="#E5E7EB" strokeWidth="5"/>
          <circle
            cx="32" cy="32" r="26" fill="none" stroke="#4F46E5" strokeWidth="5"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="3" y="2" width="16" height="18" rx="3" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5"/>
            <path d="M7 8h8M7 11h6M7 14h4" stroke="#4F46E5" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.3px', color: '#0A0A0A', marginBottom: 4 }}>
        正在解析你的简历
      </div>
      <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 20 }}>通常需要 15–30 秒</div>

      <div style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {STEPS.map((step, i) => {
          const done = i < doneCount
          const active = i === activeIdx && !done
          const opacities = [0.5, 0.35, 0.2]
          const pendingIdx = i - activeIdx - 1

          if (done) {
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#D1FAE5', borderRadius: 8 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="7" fill="#10B981"/>
                  <path d="M4 7l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#065F46' }}>{step.label}</span>
              </div>
            )
          }
          if (active) {
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#EEF2FF', borderRadius: 8, border: '0.5px solid rgba(79,70,229,0.2)' }}>
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <circle cx="7" cy="7" r="7" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5"/>
                  <circle cx="7" cy="7" r="3" fill="#4F46E5" style={{ animation: 'pulse 1s infinite' }}/>
                </svg>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#4F46E5' }}>{step.label}…</span>
              </div>
            )
          }
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', background: '#F9FAFB', borderRadius: 8,
              opacity: opacities[pendingIdx] ?? 0.15,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14">
                <circle cx="7" cy="7" r="7" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="1.5"/>
              </svg>
              <span style={{ fontSize: 10, color: '#9CA3AF' }}>{step.label}</span>
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 16 }}>可以先去做别的，完成后通知你</div>
    </div>
  )
}
