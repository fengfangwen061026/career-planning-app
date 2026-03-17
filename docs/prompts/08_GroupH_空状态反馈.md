# Task H · 空状态 & 补全写入反馈（S-14 / S-15）

## 文件产出
- `frontend/src/components/mobile/EmptyState.tsx` + `.css`（S-14，复用组件）
- 在 `ProfilePage.tsx` 中增加 `justUpdated` 状态支持（S-15）

---

## S-14：EmptyState 通用组件

路径：`frontend/src/components/mobile/EmptyState.tsx`

该组件用于探索/画像/报告三个 Tab 在未上传简历时显示。

### Props

```ts
interface EmptyStateProps {
  type: 'explore' | 'profile' | 'report'
  onNavigate: () => void  // 点击「去上传简历」跳转
}
```

### 布局

容器：height 280px，display flex，flex-direction column，align-items center，justify-content center，padding 16px，text-align center

---

### 插图区（SVG 56×56）

外层：`<rect width="56" height="56" rx="14" fill="#F3F4F6"/>`

**explore 图标（放大镜+加号）：**
```svg
<circle cx="25" cy="23" r="10" stroke="#D1D5DB" stroke-width="2" fill="none"/>
<path d="M32 30l8 8" stroke="#D1D5DB" stroke-width="2.5" stroke-linecap="round"/>
<!-- 加号 -->
<path d="M20 23h10M25 18v10" stroke="#D1D5DB" stroke-width="1.5" stroke-linecap="round"/>
```

**profile 图标（用户）：**
```svg
<circle cx="28" cy="20" r="7" stroke="#D1D5DB" stroke-width="2" fill="none"/>
<path d="M14 42c0-7.7 6.3-14 14-14s14 6.3 14 14" stroke="#D1D5DB" stroke-width="2" fill="none" stroke-linecap="round"/>
```

**report 图标（文档）：**
```svg
<rect x="14" y="10" width="28" height="36" rx="4" stroke="#D1D5DB" stroke-width="2" fill="none"/>
<path d="M20 20h16M20 27h16M20 34h10" stroke="#D1D5DB" stroke-width="1.5" stroke-linecap="round"/>
```

---

### 文字组

标题「还没有简历」：font-size 13px，font-weight 700，color #0A0A0A，margin-bottom 6px，margin-top 12px

说明文字（按 type）：
- explore：「上传简历后，我们会为你\n推荐最匹配的岗位」
- profile：「上传简历后，\n我们会为你生成专属画像」
- report：「完成匹配后，\n可以在这里查看职业规划报告」

font-size 10px，color #6B7280，line-height 1.7，margin-bottom 16px，white-space pre-line

按钮「去上传简历」：padding 8px 20px，bg #4F46E5，color white，border-radius 8px，font-size 10px，font-weight 700，border none，cursor pointer，onClick → onNavigate()

---

## S-15：ProfilePage 补全写入后反馈

修改 `ProfilePage.tsx`，增加 `justUpdated` 状态（从 /chat-fill 写入后路由传参或 localStorage flag 触发）。

### 触发条件

在 `useEffect` 中检测：
```ts
// 方式：useLocation().state?.justUpdated
const location = useLocation()
const [justUpdated, setJustUpdated] = useState(location.state?.justUpdated === true)

useEffect(() => {
  if (justUpdated) {
    // 3秒后清除高亮状态
    const timer = setTimeout(() => setJustUpdated(false), 4000)
    return () => clearTimeout(timer)
  }
}, [justUpdated])
```

---

### 顶部标题行变化（justUpdated=true）

右侧完整度 Tag 旁边追加「刚刚更新」Badge：

```tsx
{justUpdated && (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '3px 8px', background: '#D1FAE5', borderRadius: '20px',
    marginLeft: '4px'
  }}>
    <svg width="8" height="8" viewBox="0 0 8 8">
      <circle cx="4" cy="4" r="4" fill="#10B981"/>
      <path d="M2 4l1.5 1.5 3-3" stroke="white" stroke-width="1" stroke-linecap="round" fill="none"/>
    </svg>
    <span style={{fontSize:'8px', fontWeight:700, color:'#065F46'}}>刚刚更新</span>
  </div>
)}
```

---

### 综合数据卡（动画更新）

justUpdated=true 时：
- 完整度数值从「78%」改为「86%」，color #10B981
- 进度条 width 从 78% 动画到 86%（transition: width 0.9s cubic-bezier(0.34,1.56,0.64,1)）
- 竞争力「82」改为「88」，color #10B981
  实现：用 `useEffect` + `useState(82)` → 到 88 的计数动画（setInterval 每 50ms +1）

---

### 实习 & 项目卡（高亮更新，justUpdated=true）

卡片 border-color: rgba(16,185,129,0.4)，bg: rgba(16,185,129,0.03)

标题行右侧追加「刚刚更新」Tag（同 badge 样式，稍小）

条目2（校园二手平台）替换描述为新增内容块：

```tsx
<div style={{
  background: '#D1FAE5', borderRadius: '6px',
  borderLeft: '2px solid #10B981', padding: '5px 7px',
  fontSize: '9px', color: '#374151', lineHeight: 1.7,
  marginTop: '4px'
}}>
  累计用户 <strong style={{color:'#065F46'}}>300+</strong>，接口响应降低 <strong style={{color:'#065F46'}}>40%</strong>，独立完成全栈开发
</div>
```

---

### 剩余缺失项提示条（justUpdated=true，替换原待补全项卡的位置）

```tsx
<div style={{
  padding: '8px 10px', background: '#FEF3C7', borderRadius: '9px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
}}>
  <div>
    <div style={{fontSize:'9px', fontWeight:700, color:'#92400E'}}>还有 2 处未补全</div>
    <div style={{fontSize:'8px', color:'#92400E', marginTop:'1px'}}>沟通能力、实习收获描述</div>
  </div>
  <button style={{
    padding: '5px 10px', background: '#D97706', color: 'white',
    borderRadius: '7px', fontSize: '9px', fontWeight: 700, border: 'none', cursor: 'pointer'
  }}
    onClick={() => navigate('/chat-fill')}
  >
    继续 →
  </button>
</div>
```

---

## 注意

- EmptyState 组件被 ExplorePage / ProfilePage / ReportPage 各自在「未上传简历」状态下复用
- Demo 中暂时不接入后端，所有页面默认显示「已上传」状态（即不显示 EmptyState）
- S-15 状态由 ChatFillPage 完成后 navigate('/profile', { state: { justUpdated: true } }) 触发
