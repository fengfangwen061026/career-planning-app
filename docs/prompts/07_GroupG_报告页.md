# Task G · 职业发展报告页（S-12 / S-13）

## 文件产出
- `frontend/src/pages/mobile/ReportPage.tsx` + `.css`

路由：/report
用 `<MobileShell hasTabBar activeTab="report">` 包裹。

---

## 状态设计

```ts
// S-12 骨架态 → S-13 阅读态
const [generationState, setGenerationState] = useState<'loading'|'done'>('loading')
const [generatedCount, setGeneratedCount] = useState(1) // 已生成章节数（1→5）

// 页面挂载后模拟流式生成
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
```

---

## 1. 顶部栏（固定，白底）

padding 10px 12px，bg white，border-bottom 0.5px solid var(--color-border-primary)，flex-shrink 0

flex justify-between align-items flex-start

**左侧：**
- 「职业发展报告」font-size 14px font-weight 800 letter-spacing -0.4px color #0A0A0A
- 「张同学 · 后端开发工程师」font-size 9px color #6B7280 margin-top 2px

**右侧导出按钮：**
- loading 态：「导出 PDF」bg #F3F4F6 color #9CA3AF border-radius 7px font-size 9px font-weight 700 padding 5px 10px border none cursor not-allowed
- done 态：「↓ 导出」bg #4F46E5 color white border-radius 7px font-size 9px font-weight 700 padding 5px 10px border none cursor pointer

---

## 2. 内容区（overflow-y auto，flex 1）

padding 10px，display flex，flex-direction column，gap 7px，bg var(--color-background-secondary)

---

## 章节渲染逻辑

```ts
const chapters = [
  { title: '一、个人优势总结', ... },
  { title: '二、目标岗位分析', ... },
  { title: '三、差距与行动计划', ... },
  { title: '四、职业路径规划', ... },
  { title: '五、评估周期', ... },
]

chapters.map((ch, i) => {
  if (i < generatedCount) return <GeneratedChapter key={i} chapter={ch} index={i}/>
  if (i === generatedCount) return <LoadingChapter key={i} chapter={ch}/>  // 正在生成
  return <PendingChapter key={i} chapter={ch} opacity={(i - generatedCount) <= 0 ? 0.5 : i - generatedCount === 1 ? 0.35 : 0.2}/>
})
```

---

### GeneratedChapter（已生成）

卡片：bg white，border 0.5px solid var(--color-border-primary)，border-radius 10px，padding 11px，animation fadeInUp 0.4s ease

**标题行：** flex justify-between align-items center margin-bottom 6px
- 章节标题 font-size 10px font-weight 800 letter-spacing -0.2px color #0A0A0A
- 「已生成」Tag：bg #D1FAE5 color #065F46 font-size 8px padding 2px 6px border-radius 10px font-weight 600

**正文：** font-size 9px color #374151 line-height 1.9

#### 各章节内容

**第一章正文：**
「张同学就读上海交大计算机科学专业，Python 熟练度 88 分，综合竞争力 <span style={{color:'#4F46E5',fontWeight:700}}>82/100</span>，同类求职者 Top 23%。ACM 区域赛铜奖体现出扎实的算法思维，实习经历覆盖推荐算法与 A/B 测试，具备一定的工程落地经验。」

**第二章正文：**
「后端开发工程师岗位综合匹配度 <span color=#4F46E5 fontWeight=700>89 分</span>。基础要求（学历/专业/实习）全部满足；核心技能 Python、MySQL 强匹配；缺失 Redis，微服务经验较弱。」

第二章内嵌四维格（2×2 grid，同 S-11 规格，数值 95/82/78/88，margin-top 8px）

**第三章内容：**
引言「主要差距集中在 Redis 缺失（-15分）和项目量化表达不足（-8分）。建议优先行动：」margin-bottom 6px

行动项列表（3个）：display flex flex-direction column gap 5px

- 行动项1（绿色）：bg #D1FAE5，border-radius 7px，padding 6px 8px，display flex，gap 6px，align-items flex-start
  - 序号「1」：font-size 8px font-weight 700 color #065F46 flex-shrink 0 margin-top 1px
  - 「学习 Redis 基础（缓存/分布式锁），2–3周可掌握核心用法」font-size 9px color #065F46 line-height 1.6

- 行动项2（绿色，同上）：「补充项目量化数据：用户量 300+、接口响应降低 40% 写入简历」

- 行动项3（橙色）：bg #FEF3C7，border-radius 7px，padding 6px 8px
  - 序号 color #92400E，文字 color #92400E

**第四章内容：**
引言「推荐主路径为垂直晋升，备选横向转岗至数据工程师（技能重叠 62%）。」margin-bottom 8px

时间轴（简化版，3节点）：

```ts
const timeline = [
  { current: true,  name: '现在 · 后端开发（初级）', cond: '补 Redis、量化简历描述', color: '#4F46E5' },
  { current: false, label: '2', name: '2年后 · 后端开发（中级）', cond: '微服务 + 高并发系统设计', color: '#9CA3AF' },
  { current: false, label: '3', name: '5年+ · 技术负责人', cond: '架构设计 + 团队管理', color: '#9CA3AF' },
]
```

每步：flex align-items flex-start gap 7px

左列：flex flex-direction column align-items center width 20px
- 当前节点圆 18×18：bg #4F46E5，border-radius 50%，flex center，SVG 8×8 勾 stroke white 1.5px
- 待节点圆 18×18：bg var(--color-background-secondary)，border 1.5px solid #E5E7EB，flex center
  文字「2」「3」font-size 8px color #9CA3AF
- 连接线：width 1.5px height 20px bg #E5E7EB（最后节点不显示）

右列：padding-top 2px margin-bottom 8px
- 岗位名 font-size 10px font-weight 700 对应color
- 条件 font-size 8px color #6B7280 margin-top 1px

**第五章正文：**
「建议每 3 个月对照行动计划自评一次：Redis 学习完成度、简历更新情况、新增项目经验。6 个月后可重新上传简历重新匹配，验证竞争力提升效果。」

---

### LoadingChapter（生成中，S-12 骨架屏）

卡片：同上 + border-color rgba(79,70,229,0.2)

标题行：
- 章节标题 + 右侧「生成中」指示器
  - 5px 圆点 bg #4F46E5 animation pulse border-radius 50%
  - 「生成中」font-size 8px color #4F46E5

骨架条（4条）：display flex flex-direction column gap 5px margin-top 6px

每条：height 8px，bg #F3F4F6，border-radius 3px，overflow hidden，position relative

shimmer 效果（::after 伪元素在 CSS 里定义）：
```css
.skeleton-bar::after {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
  animation: shimmer 1.4s infinite;
}
```

宽度依次：90% / 100% / 75% / 85%

---

### PendingChapter（待生成）

容器：display flex，justify-content space-between，align-items center，padding 9px 11px，bg white，border 0.5px solid var(--color-border-primary)，border-radius 10px

章节名 font-size 10px color #6B7280

「待生成」Tag：bg #F3F4F6 color #9CA3AF font-size 8px padding 2px 6px border-radius 10px

opacity 按规范：0.5 / 0.35 / 0.2

---

## 底部 padding

最后一个章节后 margin-bottom 10px
