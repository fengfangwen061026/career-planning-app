import React, { useEffect, useRef, useState } from 'react'
import TabBar from '../../components/TabBar/TabBar'

interface Chapter {
  index: number
  title: string
  text: string | null
  data: Record<string, unknown> | null
}

const CHAPTERS: Omit<Chapter, 'text' | 'data'>[] = [
  { index: 1, title: '一、个人优势总结' },
  { index: 2, title: '二、目标岗位分析' },
  { index: 3, title: '三、差距与行动计划' },
  { index: 4, title: '四、职业路径规划' },
  { index: 5, title: '五、评估周期' },
]

// Demo 静态内容（真实场景从 API 轮询获取）
const DEMO_TEXTS: Record<number, string> = {
  1: '张同学就读于上海交通大学计算机科学与技术专业，综合竞争力评分 82 分，位于同类毕业生前 28%。核心优势体现在三个方面：一是扎实的 Python 工程能力，具备 2 个月算法实习经验，曾独立完成推荐算法模块开发；二是全栈工程实践，校园二手交易平台项目实现了从设计到部署的完整闭环；三是持续学习意愿强，通过阿里云 ACA 认证并摘得 ACM 区域赛铜奖。Python 工程能力与全栈经验与后端开发工程师岗位需求高度契合。',
  2: '后端开发工程师岗位要求候选人具备扎实的服务端开发能力，核心技术栈包括 Python/Java、MySQL/Redis 以及微服务架构经验，综合匹配度为 89 分，处于较高水平。',
  3: '当前与目标岗位存在 2 项必须补齐的差距，以及 1 项建议提升项，补齐后综合匹配分可提升至 94 分。',
  4: '推荐以后端开发工程师（初级）为起点，沿垂直晋升路径发展；2 年内可晋升至中级，掌握微服务与高并发；5 年后可转型为技术负责人。同时可关注数据工程师方向作为横向转岗备选。',
  5: '建议每 3 个月进行一次自我评估：第一个月末检查 Redis 是否已掌握基础用法并完成一个实践项目，第二个月末更新简历量化描述并通过 mock 面试验证，第三个月末重新运行匹配系统查看分数变化。6 个月后建议重新上传最新简历，系统将根据新技能和经历重新生成匹配报告，帮助你发现更多适配岗位。',
}

const ACTION_ITEMS = [
  { priority: '必须补齐', item: 'Redis 缺失', action: '学习 Redis 基础（缓存/分布式锁），2–3周可掌握核心用法', color: '#D1FAE5', textColor: '#065F46' },
  { priority: '必须补齐', item: '量化成果不足', action: '补充项目量化数据：用户量 300+、接口响应降低 40%', color: '#D1FAE5', textColor: '#065F46' },
  { priority: '建议提升', item: '微服务经验弱', action: '了解微服务基本概念，可结合 Spring Cloud 做一个 demo', color: '#FEF3C7', textColor: '#92400E' },
]

const PATH_NODES = [
  { title: '后端开发（初级）', cond: '补 Redis + 量化描述', current: true },
  { title: '后端开发（中级）', cond: '2年 · 微服务+高并发', current: false },
  { title: '技术负责人',       cond: '5年+ · 架构+带团队', current: false },
]

const DIMS_DATA = [
  { label: '基础', score: 95, color: '#1D4ED8' },
  { label: '技能', score: 82, color: '#3B82F6' },
  { label: '素养', score: 78, color: '#10B981' },
  { label: '潜力', score: 88, color: '#D97706' },
]

export default function ReportPage() {
  const [doneCount, setDoneCount] = useState(0)
  const [generating, setGenerating] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // 模拟逐章生成
  useEffect(() => {
    let ch = 0
    const tick = () => {
      if (ch >= CHAPTERS.length) {
        setGenerating(false)
        return
      }
      ch++
      setDoneCount(ch)
      timerRef.current = setTimeout(tick, 1600)
    }
    timerRef.current = setTimeout(tick, 1200)
    return () => clearTimeout(timerRef.current)
  }, [])

  const renderChapterContent = (idx: number) => {
    if (idx === 2) {
      return (
        <div>
          <p style={{ fontSize: 9, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>{DEMO_TEXTS[2]}</p>
          <div style={{ display: 'flex', gap: 4 }}>
            {DIMS_DATA.map(d => (
              <div key={d.label} style={{ flex: 1, textAlign: 'center', padding: 5, background: '#F9FAFB', borderRadius: 7 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: d.color, letterSpacing: '-0.5px' }}>{d.score}</div>
                <div style={{ fontSize: 7, color: '#9CA3AF', marginTop: 1 }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      )
    }
    if (idx === 3) {
      return (
        <div>
          <p style={{ fontSize: 9, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>{DEMO_TEXTS[3]}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ACTION_ITEMS.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 8px', background: item.color, borderRadius: 7 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: item.textColor, minWidth: 14 }}>{i + 1}</div>
                <div style={{ fontSize: 9, color: item.textColor, lineHeight: 1.6 }}>{item.action}</div>
              </div>
            ))}
          </div>
        </div>
      )
    }
    if (idx === 4) {
      return (
        <div>
          <p style={{ fontSize: 9, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>{DEMO_TEXTS[4]}</p>
          {PATH_NODES.map((node, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: i < PATH_NODES.length - 1 ? 0 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: node.current ? '#4F46E5' : 'white',
                  border: node.current ? 'none' : '1.5px solid #4F46E5',
                  fontSize: 8, fontWeight: 800, color: node.current ? 'white' : '#4F46E5',
                }}>
                  {node.current ? '✓' : i + 1}
                </div>
                {i < PATH_NODES.length - 1 && <div style={{ width: 1.5, height: 14, background: '#E5E7EB' }} />}
              </div>
              <div style={{ paddingTop: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: node.current ? '#4F46E5' : '#0A0A0A' }}>{node.title}</div>
                <div style={{ fontSize: 8, color: '#6B7280', marginBottom: i < PATH_NODES.length - 1 ? 2 : 0 }}>{node.cond}</div>
              </div>
            </div>
          ))}
        </div>
      )
    }
    return <div style={{ fontSize: 9, color: '#374151', lineHeight: 1.9 }}>{DEMO_TEXTS[idx]}</div>
  }

  return (
    <>
      {/* 顶部固定栏 */}
      <div style={{ padding: '10px 12px', background: 'white', borderBottom: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.4px', color: '#0A0A0A' }}>职业发展报告</div>
          <div style={{ fontSize: 9, color: '#6B7280', marginTop: 2 }}>张同学 · 后端开发工程师</div>
        </div>
        <button style={{
          padding: '5px 12px', background: generating ? '#F3F4F6' : '#4F46E5',
          color: generating ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 7,
          fontSize: 9, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer',
        }}>
          ↓ 导出
        </button>
      </div>

      <div className="scroll-body" style={{ padding: '10px 12px' }}>
        {CHAPTERS.map((ch, idx) => {
          const done = doneCount > idx
          const active = doneCount === idx && generating

          if (done) {
            return (
              <div key={ch.index} style={{ background: 'white', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: 11, marginBottom: 7, animation: 'fadeUp 0.4s ease forwards' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.2px' }}>{ch.title}</div>
                  <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 8, fontWeight: 600, background: '#D1FAE5', color: '#065F46' }}>已生成</span>
                </div>
                {renderChapterContent(ch.index)}
              </div>
            )
          }

          if (active) {
            return (
              <div key={ch.index} style={{ background: 'white', border: '0.5px solid rgba(79,70,229,0.2)', borderRadius: 10, padding: 11, marginBottom: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#0A0A0A' }}>{ch.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4F46E5', animation: 'pulse 1s infinite' }} />
                    <span style={{ fontSize: 8, color: '#4F46E5', fontWeight: 600 }}>生成中</span>
                  </div>
                </div>
                {['90%', '100%', '75%', '85%'].map((w, i) => (
                  <div key={i} className="skeleton" style={{ height: 8, width: w, marginBottom: i < 3 ? 5 : 0 }} />
                ))}
              </div>
            )
          }

          const pendingIdx = idx - doneCount
          const opacities = [0.5, 0.35, 0.2, 0.15]
          return (
            <div key={ch.index} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 11px', background: 'white', border: '0.5px solid #E5E7EB',
              borderRadius: 10, marginBottom: 7, opacity: opacities[pendingIdx] ?? 0.1,
            }}>
              <div style={{ fontSize: 10, color: '#6B7280' }}>{ch.title}</div>
              <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 8, background: '#F3F4F6', color: '#6B7280' }}>待生成</span>
            </div>
          )
        })}
      </div>
      <TabBar active="report" />
    </>
  )
}
