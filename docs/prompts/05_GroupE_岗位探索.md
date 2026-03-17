# Task E · 岗位探索（S-09 / S-10）

## 文件产出
- `frontend/src/pages/mobile/ExplorePage.tsx` + `.css`

路由：/explore
用 `<MobileShell hasTabBar activeTab="explore">` 包裹。

内部结构：height 100%，display flex，flex-direction column，background var(--color-background-secondary)

---

## 状态设计

```ts
const [searchQuery, setSearchQuery] = useState('')
const [activeFilter, setActiveFilter] = useState('全部')
const [activeSegment, setActiveSegment] = useState<'list'|'graph'>('list')
const [searchActive, setSearchActive] = useState(false)
```

---

## 1. 顶部栏（白底，padding 10px 12px 0）

**标题行：** flex justify-between align-items flex-end margin-bottom 8px
- 「岗位探索」font-size 14px font-weight 800 letter-spacing -0.4px color #0A0A0A
- 「共 51 种岗位」font-size 8px color #6B7280 align-self flex-end

---

## 2. 搜索框

容器：flex align-items center gap 6px，padding 7px 10px，margin-bottom 8px，bg var(--color-background-secondary)，border-radius 20px，cursor text

**searchActive=false：**
- border 0.5px solid var(--color-border-secondary)
- 放大镜 SVG 12×12 stroke #9CA3AF
- placeholder「搜索岗位，如「产品经理」」font-size 10px color #9CA3AF

**searchActive=true（输入「产品经理」）：**
- border 1px solid #4F46E5
- 放大镜 stroke #4F46E5
- 输入文字「产品经理」font-size 10px color #4F46E5 font-weight 600
- 右侧 × 图标 10×10 stroke #9CA3AF cursor pointer onClick → setSearchQuery('') setSearchActive(false)

实现：input 元素，onFocus → setSearchActive(true)，onBlur 不自动关闭，onChange → setSearchQuery

放大镜 SVG 12×12：
```svg
<circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/>
<path d="M9 9l2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
```

---

## 3. 行业筛选栏（仅 searchActive=false 时显示）

flex gap 4px overflow-x auto，scrollbar-width none，padding-bottom 2px，margin-bottom 8px

选项：['全部', '互联网', 'AI/算法', '数据', '金融']

选中态：padding 3px 9px，bg #4F46E5，color white，border-radius 20px，font-size 8px，font-weight 700，border none
未选中态：padding 3px 9px，border 0.5px solid #E5E7EB，border-radius 20px，font-size 8px，color #6B7280，bg transparent，cursor pointer

---

## 4. Segment Control（仅 searchActive=false 时显示）

容器：display flex，gap 3px，padding 3px，bg var(--color-background-secondary)，border-radius 9px，margin-bottom 8px

**推荐列表（active）：** flex 1，bg white，border 0.5px solid var(--color-border-tertiary)，border-radius 6px，font-size 9px，font-weight 700，color #4F46E5，padding 4px，text-align center，cursor pointer

**岗位图谱（inactive）：** flex 1，bg transparent，font-size 9px，color #6B7280，padding 4px，text-align center，cursor pointer，onClick → navigate('/explore?view=graph')（或留空）

---

## 5. 搜索结果提示条（searchActive=true 且 searchQuery 非空时显示）

padding 6px 10px，bg #EEF2FF，border-bottom 0.5px solid rgba(79,70,229,0.15)，margin-bottom 6px，border-radius 8px

「找到 4 个相关岗位」font-size 8px color #4F46E5

---

## 6. 岗位卡片列表

overflow-y auto，flex 1，padding 0 0 8px

### 卡片通用结构

```tsx
// 容器
display flex, align-items flex-start, gap 7px
padding 9px 10px
bg white
border 0.5px solid var(--color-border-primary)
border-radius 10px
margin-bottom 7px
position relative
cursor pointer
transition transform 0.2s ease, box-shadow 0.2s ease
:hover → transform translateY(-1px) box-shadow 0 4px 12px rgba(0,0,0,0.08)
onClick → navigate('/match/backend-engineer')  // 按岗位调整
```

**图标块：** 26×26，border-radius 7px，bg=对应色，display flex，align-items center，justify-content center，flex-shrink 0
- 文字：首汉字，font-size 9px，font-weight 800，color white

**内容区：** flex 1，min-width 0

岗位名：font-size 11px，font-weight 700，color #0A0A0A，margin-bottom 1px

副标题（行业 · 级别 · 城市）：font-size 8px，color #6B7280，margin-bottom 4px

**四维迷你条（4行）：** flex flex-direction column gap 2px
每行 flex align-items center gap 4px：
- dim-label：font-size 7px，color #9CA3AF，width 10px，flex-shrink 0，font-variant-numeric tabular-nums
- 轨道 div：flex 1，height 2.5px，bg #F3F4F6，border-radius 2px
  - fill div：height 100%，border-radius 2px，对应色，宽度 = score%
- 无百分数字（空间太窄）

**综合分：** font-size 18px，font-weight 900，letter-spacing -0.8px，flex-shrink 0，对应语义色，align-self center，margin-left auto，margin-right 12px

**右箭头「›」：** position absolute，right 8px，top 50%，transform translateY(-50%)，font-size 10px，color #9CA3AF

### S-09 默认4张卡片数据

```ts
const jobs = [
  {
    id: 'backend-engineer',
    name: '后端开发工程师',
    icon: '后',
    iconColor: '#4F46E5',
    industry: '互联网',
    level: '初级',
    city: '北京/上海',
    score: 89,
    scoreColor: '#4F46E5',
    dims: [
      { label: '基', score: 95, color: '#1D4ED8' },
      { label: '技', score: 82, color: '#3B82F6' },
      { label: '素', score: 78, color: '#10B981' },
      { label: '潜', score: 88, color: '#D97706' },
    ]
  },
  {
    id: 'data-analyst',
    name: '数据分析师',
    icon: '数',
    iconColor: '#059669',
    industry: '金融/电商',
    level: '初级',
    city: '全国',
    score: 83,
    scoreColor: '#10B981',
    dims: [
      { label: '基', score: 90, color: '#1D4ED8' },
      { label: '技', score: 76, color: '#3B82F6' },
      { label: '素', score: 72, color: '#10B981' },
      { label: '潜', score: 80, color: '#D97706' },
    ]
  },
  {
    id: 'algorithm-engineer',
    name: '算法工程师',
    icon: '算',
    iconColor: '#D97706',
    industry: 'AI/大模型',
    level: '初级',
    city: '北京',
    score: 76,
    scoreColor: '#D97706',
    dims: [
      { label: '基', score: 88, color: '#1D4ED8' },
      { label: '技', score: 60, color: '#3B82F6' },
      { label: '素', score: 75, color: '#10B981' },
      { label: '潜', score: 85, color: '#D97706' },
    ]
  },
  {
    id: 'frontend-engineer',
    name: '前端开发工程师',
    icon: '前',
    iconColor: '#3B82F6',
    industry: '互联网',
    level: '初级',
    city: '全国',
    score: 72,
    scoreColor: '#3B82F6',
    dims: [
      { label: '基', score: 85, color: '#1D4ED8' },
      { label: '技', score: 68, color: '#3B82F6' },
      { label: '素', score: 74, color: '#10B981' },
      { label: '潜', score: 70, color: '#D97706' },
    ]
  },
]
```

### S-10 搜索态（searchQuery='产品经理' 时）

搜索结果（覆盖默认列表，过滤显示）：

```ts
const searchResults = [
  {
    id: 'product-manager',
    name: '产品经理',
    icon: '产',
    iconColor: '#7C3AED',
    industry: '互联网',
    level: '初级',
    city: '全国',
    score: 71,
    scoreColor: '#7C3AED',
    tags: [{ text: '匹配', bg: '#EEF2FF', color: '#4F46E5' }, { text: '需补充需求分析', bg: '#F3F4F6', color: '#9CA3AF' }],
    dims: [/* 任意合理值 */]
  },
  {
    id: 'growth-pm',
    name: '增长产品经理',
    icon: '增',
    iconColor: '#7C3AED',
    industry: '互联网',
    level: '初级',
    city: '全国',
    score: 65,
    scoreColor: '#7C3AED',
    tags: [{ text: '需 A/B测试经验', bg: '#F3F4F6', color: '#9CA3AF' }],
    dims: [/* 任意合理值 */]
  }
]
```

搜索结果卡片额外显示 Tags 行（在副标题后）：flex gap 4px flex-wrap wrap，Tag 为小胶囊。

底部提示「还有 2 个结果」：font-size 8px，color #9CA3AF，text-align center，padding 6px 0

---

## 逻辑控制

```ts
const displayedJobs = searchQuery ? searchResults : jobs.filter(j => activeFilter === '全部' || j.industry.includes(activeFilter))
```

卡片 fadeInUp 动画，各延迟 0.05s × index。
