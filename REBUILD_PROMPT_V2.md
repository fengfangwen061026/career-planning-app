# CareerAI 移动端完整重构 + 报告生成重写

## 背景

`frontend/mobile/` 已有一版移动端实现，但视觉效果与设计稿相差太远，需要**推倒重来**。
同时 `backend/app/prompts/report_generation.py` 的报告生成逻辑也需要按新的五章结构重写。

---

## PHASE 1：前端重构

### 第一步：清空现有实现

```bash
# 保留项目配置，只清空源码
cd frontend/mobile

# 备份 vite.config.ts / package.json / index.html（不动）
# 清空 src 目录
rm -rf src/*

# 重建目录结构
mkdir -p src/styles
mkdir -p src/components/TabBar
mkdir -p src/components/Card
mkdir -p src/components/Tag
mkdir -p src/components/SkillBar
mkdir -p src/components/PathTimeline
mkdir -p src/components/EmptyState
mkdir -p src/components/SkeletonCard
mkdir -p src/pages/Onboarding
mkdir -p src/pages/Upload
mkdir -p src/pages/Parsing
mkdir -p src/pages/Profile
mkdir -p src/pages/ChatFill
mkdir -p src/pages/Explore
mkdir -p src/pages/Match
mkdir -p src/pages/Report
```

---

### 第二步：建立全局 Token 系统

创建 `src/styles/tokens.css`（这是唯一的样式配置源，所有颜色/间距/字号从这里取，**任何组件中禁止硬编码颜色值**）：

```css
/* src/styles/tokens.css */
:root {
  /* 主色 */
  --p: #4F46E5;
  --pl: #EEF2FF;
  --pd: #1D4ED8;

  /* 语义色 */
  --b: #3B82F6;
  --bl: #EFF6FF;
  --g: #10B981;
  --gl: #D1FAE5;
  --a: #D97706;
  --al: #FEF3C7;
  --r: #EF4444;
  --rl: #FEE2E2;

  /* 中性色 */
  --g9: #0A0A0A;
  --g7: #374151;
  --g5: #6B7280;
  --g4: #9CA3AF;
  --g2: #E5E7EB;
  --g1: #F3F4F6;
  --g0: #F9FAFB;

  /* 字体 */
  --font: -apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif;

  /* 圆角 */
  --r-sm: 7px;
  --r-md: 10px;
  --r-lg: 11px;
  --r-xl: 20px;
  --r-full: 9999px;

  /* 间距 */
  --sp-xs: 4px;
  --sp-sm: 7px;
  --sp-md: 10px;
  --sp-lg: 12px;
  --sp-xl: 16px;

  /* 边框 */
  --border: 0.5px solid #E5E7EB;
  --border-focus: 1px solid #4F46E5;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font);
  background: var(--g1);
  color: var(--g7);
  -webkit-font-smoothing: antialiased;
}

/* 页面容器：移动端宽度限制 */
.page-root {
  max-width: 430px;
  margin: 0 auto;
  min-height: 100dvh;
  background: var(--g1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 可滚动内容区 */
.scroll-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
.scroll-body::-webkit-scrollbar { display: none; }

/* 标准卡片 */
.card {
  background: white;
  border: 0.5px solid var(--g2);
  border-radius: var(--r-lg);
  padding: 11px;
  margin-bottom: 8px;
}
.card:last-child { margin-bottom: 0; }

/* 卡片标题 */
.card-hd {
  font-size: 9px;
  font-weight: 700;
  color: var(--g4);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 9px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.card-hd-bar {
  width: 2.5px;
  height: 10px;
  border-radius: 1px;
  flex-shrink: 0;
}

/* 主按钮 */
.btn-primary {
  width: 100%;
  padding: 9px;
  background: var(--p);
  color: white;
  border: none;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font);
  letter-spacing: -0.1px;
  margin-top: 8px;
}

/* Tag 变体 */
.tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.tag-blue  { background: var(--bl); color: var(--pd); }
.tag-green { background: var(--gl); color: #065F46; }
.tag-amber { background: var(--al); color: #92400E; }
.tag-red   { background: var(--rl); color: #991B1B; }
.tag-gray  { background: var(--g1); color: var(--g5); }
.tag-purple{ background: var(--pl); color: var(--p); }

/* 进度条 */
.bar-track {
  flex: 1;
  height: 4px;
  background: var(--g1);
  border-radius: 2px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.9s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Notice 条 */
.notice {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  padding: 7px 9px;
  background: var(--al);
  border-radius: 7px;
  font-size: 9px;
  color: #92400E;
  line-height: 1.5;
  margin-top: 7px;
}

/* 动效 */
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
@keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-4px)} }

.skeleton {
  background: var(--g1);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}
.skeleton::after {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
  animation: shimmer 1.4s infinite;
}
```

---

### 第三步：TabBar 组件

`src/components/TabBar/TabBar.tsx`

```tsx
import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './TabBar.css'

const tabs = [
  {
    key: 'upload',
    label: '上传',
    path: '/upload',
    icon: (
      <svg viewBox="0 0 18 18" fill="none">
        <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M6 6h6M6 9h6M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'profile',
    label: '画像',
    path: '/profile',
    icon: (
      <svg viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 15c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'explore',
    label: '探索',
    path: '/explore',
    icon: (
      <svg viewBox="0 0 18 18" fill="none">
        <circle cx="7.5" cy="7.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M13.5 13.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'report',
    label: '报告',
    path: '/report',
    icon: (
      <svg viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 7h8M5 10h6M5 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

interface TabBarProps {
  active: 'upload' | 'profile' | 'explore' | 'report'
}

export default function TabBar({ active }: TabBarProps) {
  const navigate = useNavigate()
  return (
    <div className="tabbar">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`tabbar-item ${active === tab.key ? 'active' : ''}`}
          onClick={() => navigate(tab.path)}
        >
          <span className="tabbar-icon">{tab.icon}</span>
          <span className="tabbar-label">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
```

`src/components/TabBar/TabBar.css`

```css
.tabbar {
  height: 50px;
  border-top: 0.5px solid var(--g2);
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  background: white;
}

.tabbar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--g4);
  font-family: var(--font);
  padding: 0;
  transition: color 0.15s;
}
.tabbar-item.active { color: var(--p); }

.tabbar-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tabbar-icon svg { width: 18px; height: 18px; }

.tabbar-label { font-size: 8px; font-weight: 500; }
```

---

### 第四步：App.tsx 路由

```tsx
// src/App.tsx
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import '../styles/tokens.css'

import OnboardingPage from './pages/Onboarding/OnboardingPage'
import UploadPage     from './pages/Upload/UploadPage'
import ParsingPage    from './pages/Parsing/ParsingPage'
import ProfilePage    from './pages/Profile/ProfilePage'
import ChatFillPage   from './pages/ChatFill/ChatFillPage'
import ExplorePage    from './pages/Explore/ExplorePage'
import MatchPage      from './pages/Match/MatchPage'
import ReportPage     from './pages/Report/ReportPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="page-root">
        <Routes>
          <Route path="/"           element={<Navigate to="/onboarding" replace />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/upload"     element={<UploadPage />} />
          <Route path="/parsing"    element={<ParsingPage />} />
          <Route path="/profile"    element={<ProfilePage />} />
          <Route path="/chat-fill"  element={<ChatFillPage />} />
          <Route path="/explore"    element={<ExplorePage />} />
          <Route path="/match/:id"  element={<MatchPage />} />
          <Route path="/report"     element={<ReportPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
```

---

### 第五步：逐页实现（严格对照设计稿 HTML）

**以下是每个页面的设计稿 HTML 参考。实现时 CSS 属性必须与此一致，不得自由调整。**

---

#### [页面1] 上传页 `/upload`

设计稿 HTML 参考：

```html
<!-- 上传拖拽区 -->
<div style="border:1.5px dashed #D1D5DB;border-radius:11px;padding:24px 12px;text-align:center;margin-bottom:10px;background:white">
  <svg width="32" height="32" viewBox="0 0 32 32" style="margin:0 auto 8px;display:block" fill="none">
    <rect width="32" height="32" rx="8" fill="#EEF2FF"/>
    <path d="M16 10v10M11 15l5-5 5 5" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M10 22h12" stroke="#4F46E5" stroke-width="2" stroke-linecap="round"/>
  </svg>
  <div style="font-size:11px;font-weight:700;color:#0A0A0A;margin-bottom:3px">点击或拖拽上传</div>
  <div style="font-size:9px;color:#6B7280;margin-bottom:10px">PDF / DOCX · 最大 10MB</div>
  <button style="padding:6px 18px;background:#4F46E5;color:#fff;border:none;border-radius:7px;font-size:10px;font-weight:700;cursor:pointer">选择文件</button>
</div>

<!-- 分隔线 -->
<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
  <div style="flex:1;height:0.5px;background:#E5E7EB"></div>
  <div style="font-size:9px;color:#9CA3AF">或</div>
  <div style="flex:1;height:0.5px;background:#E5E7EB"></div>
</div>
<div style="text-align:center;font-size:10px;color:#4F46E5;font-weight:600;margin-bottom:14px;cursor:pointer">手动填写基本信息 →</div>

<!-- 解析内容展示：2x2网格 + 全宽橙色 -->
<div class="card">
  <div class="card-hd"><div class="card-hd-bar" style="background:#4F46E5"></div>将自动解析以下内容</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
    <div style="display:flex;align-items:center;gap:5px;padding:5px 7px;background:#EFF6FF;border-radius:7px">
      <div style="width:5px;height:5px;border-radius:50%;background:#1D4ED8;flex-shrink:0"></div>
      <span style="font-size:9px;color:#1D4ED8;font-weight:500">教育经历</span>
    </div>
    <div style="display:flex;align-items:center;gap:5px;padding:5px 7px;background:#EFF6FF;border-radius:7px">
      <div style="width:5px;height:5px;border-radius:50%;background:#1D4ED8;flex-shrink:0"></div>
      <span style="font-size:9px;color:#1D4ED8;font-weight:500">技能 & 工具</span>
    </div>
    <div style="display:flex;align-items:center;gap:5px;padding:5px 7px;background:#D1FAE5;border-radius:7px">
      <div style="width:5px;height:5px;border-radius:50%;background:#059669;flex-shrink:0"></div>
      <span style="font-size:9px;color:#065F46;font-weight:500">实习 & 项目</span>
    </div>
    <div style="display:flex;align-items:center;gap:5px;padding:5px 7px;background:#D1FAE5;border-radius:7px">
      <div style="width:5px;height:5px;border-radius:50%;background:#059669;flex-shrink:0"></div>
      <span style="font-size:9px;color:#065F46;font-weight:500">证书 & 奖项</span>
    </div>
    <div style="display:flex;align-items:center;gap:5px;padding:5px 7px;background:#FEF3C7;border-radius:7px;grid-column:1/-1">
      <div style="width:5px;height:5px;border-radius:50%;background:#D97706;flex-shrink:0"></div>
      <span style="font-size:9px;color:#92400E;font-weight:500">软素养信号 & 量化成果</span>
    </div>
  </div>
</div>
```

---

#### [页面2] 解析等待页 `/parsing`（无 TabBar，全屏）

```html
<!-- 整体：height 100dvh flex column align-items center justify-content center padding 20px 16px text-align center bg white -->

<!-- 环形进度圈 64x64 -->
<div style="position:relative;width:64px;height:64px;margin-bottom:16px">
  <svg width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="26" fill="none" stroke="#E5E7EB" stroke-width="5"/>
    <circle cx="32" cy="32" r="26" fill="none" stroke="#4F46E5" stroke-width="5"
      stroke-dasharray="163" stroke-dashoffset="40" stroke-linecap="round"
      transform="rotate(-90 32 32)" style="animation:pulse 1.5s ease-in-out infinite"/>
  </svg>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)">
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="2" width="16" height="18" rx="3" fill="#EEF2FF" stroke="#4F46E5" stroke-width="1.5"/>
      <path d="M7 8h8M7 11h6M7 14h4" stroke="#4F46E5" stroke-width="1.2" stroke-linecap="round"/>
    </svg>
  </div>
</div>

<!-- 标题 -->
<div style="font-size:13px;font-weight:800;letter-spacing:-0.3px;color:#0A0A0A;margin-bottom:4px">正在解析你的简历</div>
<div style="font-size:9px;color:#6B7280;margin-bottom:20px">通常需要 15–30 秒</div>

<!-- 五步列表 width 100% text-align left flex flex-direction column gap 6px -->

<!-- 已完成步骤：bg #D1FAE5 border-radius 8px padding 7px 10px -->
<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#D1FAE5;border-radius:8px">
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="7" fill="#10B981"/>
    <path d="M4 7l2 2 4-4" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  <span style="font-size:10px;font-weight:600;color:#065F46">读取简历文件</span>
</div>

<!-- 进行中步骤：bg #EEF2FF border 0.5px rgba(79,70,229,0.2) -->
<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#EEF2FF;border-radius:8px;border:0.5px solid rgba(79,70,229,0.2)">
  <svg width="14" height="14" viewBox="0 0 14 14">
    <circle cx="7" cy="7" r="7" fill="#EEF2FF" stroke="#4F46E5" stroke-width="1.5"/>
    <circle cx="7" cy="7" r="3" fill="#4F46E5" style="animation:pulse 1s infinite"/>
  </svg>
  <span style="font-size:10px;font-weight:700;color:#4F46E5">抽取技能 & 项目…</span>
</div>

<!-- 待执行步骤：bg #F9FAFB opacity 0.5/0.35/0.2 依次 -->
<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#F9FAFB;border-radius:8px;opacity:0.5">
  <svg width="14" height="14" viewBox="0 0 14 14">
    <circle cx="7" cy="7" r="7" fill="#F3F4F6" stroke="#D1D5DB" stroke-width="1.5"/>
  </svg>
  <span style="font-size:10px;color:#9CA3AF">识别证书 & 荣誉</span>
</div>

<!-- 底部提示 font-size 9px color #9CA3AF margin-top 16px -->
<div style="font-size:9px;color:#9CA3AF;margin-top:16px">可以先去做别的，完成后通知你</div>
```

---

#### [页面3] 学生画像 `/profile`

```html
<!-- 顶部用户信息行：padding 12px 12px 0 bg white -->
<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
  <!-- Avatar：34x34 border-radius 50% bg #EEF2FF color #4F46E5 font-weight 800 font-size 12px -->
  <div style="width:34px;height:34px;border-radius:50%;background:#EEF2FF;color:#4F46E5;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0">张</div>
  <div>
    <div style="font-size:13px;font-weight:800;color:#0A0A0A;letter-spacing:-0.3px">张同学</div>
    <div style="font-size:9px;color:#6B7280">CS · 大三 · 上海交大</div>
  </div>
  <span class="tag tag-amber" style="margin-left:auto">完整度 78%</span>
</div>

<!-- 综合数据卡：flex align-items center gap 8px padding 10px 12px -->
<div style="display:flex;align-items:center;gap:8px;background:white;border:0.5px solid #E5E7EB;border-radius:11px;padding:10px 12px;margin-bottom:8px">
  <!-- 环形进度圈 52x52 -->
  <div style="position:relative;width:52px;height:52px;flex-shrink:0">
    <svg width="52" height="52" viewBox="0 0 52 52" style="position:absolute;top:0;left:0">
      <circle cx="26" cy="26" r="21" fill="none" stroke="#E5E7EB" stroke-width="5"/>
      <circle cx="26" cy="26" r="21" fill="none" stroke="#4F46E5" stroke-width="5"
        stroke-dasharray="132" stroke-dashoffset="24"
        stroke-linecap="round" transform="rotate(-90 26 26)"/>
    </svg>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
      <div style="font-size:14px;font-weight:900;color:#4F46E5;letter-spacing:-0.5px">82</div>
      <div style="font-size:7px;color:#9CA3AF;line-height:1.2">竞争力</div>
    </div>
  </div>
  <!-- 右侧数据 -->
  <div style="flex:1">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
      <span style="font-size:9px;color:#6B7280">简历完整度</span>
      <span style="font-size:11px;font-weight:800;color:#D97706">78%</span>
    </div>
    <div style="height:4px;background:#F3F4F6;border-radius:2px;overflow:hidden;margin-bottom:7px">
      <div style="width:78%;height:100%;background:#D97706;border-radius:2px"></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:9px;color:#6B7280">高匹配岗位</span>
      <span style="font-size:11px;font-weight:800;color:#10B981">14个</span>
    </div>
  </div>
</div>

<!-- 技术技能卡 -->
<div class="card">
  <div class="card-hd"><div class="card-hd-bar" style="background:#3B82F6"></div>技术技能</div>
  <!-- 每行：flex align-items center gap 5px margin-bottom 5px（最后行 0）
       技能名：font-size 10px color #374151 width 50px flex-shrink 0
       进度条：flex 1 height 4px bg #F3F4F6 border-radius 2px overflow hidden
       百分值：font-size 9px color #9CA3AF width 20px text-align right tabular-nums -->
  <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
    <span style="font-size:10px;color:#374151;width:50px;flex-shrink:0">Python</span>
    <div style="flex:1;height:4px;background:#F3F4F6;border-radius:2px;overflow:hidden">
      <div style="width:88%;height:100%;background:#1D4ED8;border-radius:2px"></div>
    </div>
    <span style="font-size:9px;color:#9CA3AF;width:20px;text-align:right;font-variant-numeric:tabular-nums">88</span>
  </div>
  <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
    <span style="font-size:10px;color:#374151;width:50px;flex-shrink:0">React</span>
    <div style="flex:1;height:4px;background:#F3F4F6;border-radius:2px;overflow:hidden">
      <div style="width:75%;height:100%;background:#3B82F6;border-radius:2px"></div>
    </div>
    <span style="font-size:9px;color:#9CA3AF;width:20px;text-align:right">75</span>
  </div>
  <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
    <span style="font-size:10px;color:#374151;width:50px;flex-shrink:0">SQL</span>
    <div style="flex:1;height:4px;background:#F3F4F6;border-radius:2px;overflow:hidden">
      <div style="width:70%;height:100%;background:#3B82F6;border-radius:2px"></div>
    </div>
    <span style="font-size:9px;color:#9CA3AF;width:20px;text-align:right">70</span>
  </div>
  <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px">
    <span style="font-size:10px;color:#374151;width:50px;flex-shrink:0">机器学习</span>
    <div style="flex:1;height:4px;background:#F3F4F6;border-radius:2px;overflow:hidden">
      <div style="width:60%;height:100%;background:#60A5FA;border-radius:2px"></div>
    </div>
    <span style="font-size:9px;color:#9CA3AF;width:20px;text-align:right">60</span>
  </div>
  <div style="display:flex;align-items:center;gap:5px">
    <span style="font-size:10px;color:#374151;width:50px;flex-shrink:0">Docker</span>
    <div style="flex:1;height:4px;background:#F3F4F6;border-radius:2px;overflow:hidden">
      <div style="width:45%;height:100%;background:#93C5FD;border-radius:2px"></div>
    </div>
    <span style="font-size:9px;color:#9CA3AF;width:20px;text-align:right">45</span>
  </div>
</div>

<!-- 实习&项目卡 -->
<div class="card">
  <div class="card-hd"><div class="card-hd-bar" style="background:#10B981"></div>实习 & 项目</div>
  <div style="margin-bottom:7px">
    <div style="font-size:10px;font-weight:700;color:#0A0A0A">XX公司 · 算法实习生</div>
    <div style="font-size:9px;color:#6B7280;margin:1px 0 4px">2024.07–09 · 2个月</div>
    <div style="display:flex;gap:3px"><span class="tag tag-green">推荐算法</span><span class="tag tag-blue">A/B测试</span></div>
  </div>
  <div style="height:0.5px;background:#E5E7EB;margin-bottom:7px"></div>
  <div>
    <div style="font-size:10px;font-weight:700;color:#0A0A0A">校园二手交易平台</div>
    <div style="font-size:9px;color:#6B7280;margin:1px 0 4px">个人项目 · React + FastAPI</div>
    <div style="display:flex;gap:3px"><span class="tag tag-blue">全栈</span><span class="tag tag-amber">用户增长</span></div>
  </div>
  <div class="notice">⚠ 两个项目均缺少量化成果，建议补充数据指标</div>
</div>

<!-- 证书&荣誉卡 -->
<div class="card">
  <div class="card-hd"><div class="card-hd-bar" style="background:#D97706"></div>证书 & 荣誉</div>
  <div style="display:flex;flex-wrap:wrap;gap:4px">
    <span class="tag tag-green">CET-6 · 568</span>
    <span class="tag tag-blue">ACM 区域铜奖</span>
    <span class="tag tag-amber">国家励志奖学金</span>
    <span class="tag tag-blue">阿里云 ACA</span>
  </div>
</div>

<!-- 软素养卡 -->
<div class="card" style="margin-bottom:0">
  <div class="card-hd"><div class="card-hd-bar" style="background:#4F46E5"></div>软素养</div>
  <div style="display:flex;flex-wrap:wrap;gap:4px">
    <span class="tag tag-blue">自驱学习 · 3项</span>
    <span class="tag tag-green">团队协作 · 2项</span>
    <span class="tag tag-amber">抗压 · 1项</span>
    <span class="tag tag-gray">沟通 · 待补充</span>
  </div>
</div>

<button class="btn-primary">探索匹配岗位 →</button>
```

---

#### [页面4] 对话补全 `/chat-fill`（无 TabBar，全屏）

```html
<!-- 顶部导航：padding 10px 12px bg white border-bottom 0.5px flex align-items center gap 8px -->
<div style="padding:10px 12px;background:white;border-bottom:0.5px solid #E5E7EB;display:flex;align-items:center;gap:8px;flex-shrink:0">
  <div style="width:8px;height:8px;border-radius:50%;background:#4F46E5;margin-right:-2px;flex-shrink:0"></div>
  <div style="font-size:9px;color:#4F46E5;font-weight:600;cursor:pointer">← 返回画像</div>
  <div style="flex:1;text-align:center">
    <div style="font-size:11px;font-weight:700;color:#0A0A0A">补充项目量化成果</div>
    <div style="font-size:8px;color:#9CA3AF">缺失项 1/3</div>
  </div>
  <!-- 进度点：active 16x4 bg #4F46E5，inactive 6x4 bg #E5E7EB，gap 3px -->
  <div style="display:flex;gap:3px;flex-shrink:0">
    <div style="width:16px;height:4px;border-radius:2px;background:#4F46E5"></div>
    <div style="width:6px;height:4px;border-radius:2px;background:#E5E7EB"></div>
    <div style="width:6px;height:4px;border-radius:2px;background:#E5E7EB"></div>
  </div>
</div>

<!-- 子进度条：padding 6px 10px bg white border-bottom 0.5px -->
<div style="padding:6px 10px;background:white;border-bottom:0.5px solid #E5E7EB">
  <div style="display:flex;justify-content:space-between;margin-bottom:3px">
    <span style="font-size:8px;color:#6B7280">本次补全进度</span>
    <span style="font-size:8px;font-weight:700;color:#4F46E5">问题 2/4</span>
  </div>
  <div style="height:3px;background:#F3F4F6;border-radius:2px;overflow:hidden">
    <div style="width:50%;height:100%;background:#4F46E5;border-radius:2px"></div>
  </div>
</div>

<!-- 消息流：flex 1 overflow-y auto padding 10px flex flex-direction column gap 8px bg #F9FAFB -->

<!-- AI 气泡：align-self flex-start max-width 80%
     bubble：bg white border 0.5px #E5E7EB border-radius 4px 12px 12px 12px padding 8px 10px font-size 10px color #374151 line-height 1.7 -->

<!-- 用户气泡：align-self flex-end
     bubble：bg #4F46E5 border-radius 12px 4px 12px 12px padding 8px 10px font-size 10px color white -->

<!-- 快速选项行：display flex flex-wrap wrap gap 5px margin-top 2px
     每个：padding 5px 10px border 1px solid #4F46E5 border-radius 20px font-size 9px font-weight 600 color #4F46E5 bg #EEF2FF -->

<!-- 三点 typing：同 AI 气泡，内部 flex gap 3px
     每点：width 5px height 5px border-radius 50% bg #9CA3AF
     animation bounce 1.2s infinite，delay 0/0.2s/0.4s -->

<!-- 底部输入栏：padding 8px 10px bg white border-top 0.5px flex align-items center gap 6px flex-shrink 0 -->
<!-- 输入框：flex 1 height 30px border 0.5px #D1D5DB border-radius 15px padding 0 10px font-size 10px bg #F9FAFB -->
<!-- 发送按钮：28x28 border-radius 50% bg #4F46E5 flex center -->
<button style="width:28px;height:28px;border-radius:50%;background:#4F46E5;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M1 6h10M6 1l5 5-5 5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</button>

<!-- 完成态：生成文案预览卡 -->
<div style="background:white;border:1px solid #4F46E5;border-radius:8px;padding:10px;margin:2px 0">
  <div style="font-size:8px;font-weight:700;color:#4F46E5;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">✦ AI 生成描述</div>
  <div style="font-size:9px;color:#374151;line-height:1.8">
    开发校园二手交易平台（React + FastAPI），累计注册用户 <strong style="color:#1D4ED8">300+</strong>，日活峰值 <strong style="color:#1D4ED8">80人</strong>；通过接口缓存优化，响应时间降低 <strong style="color:#1D4ED8">40%</strong>；独立完成前后端全栈开发与上线部署。
  </div>
</div>

<!-- 效果预测框 -->
<div style="background:#D1FAE5;border:0.5px solid rgba(16,185,129,0.2);border-radius:8px;padding:8px 10px">
  <div style="font-size:8px;font-weight:700;color:#065F46;margin-bottom:4px">补全后效果预测</div>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:9px;color:#065F46">完整度</div>
    <div style="display:flex;align-items:center;gap:4px">
      <span style="font-size:10px;color:#D97706;font-weight:700">78%</span>
      <span style="font-size:9px;color:#065F46">→</span>
      <span style="font-size:11px;color:#065F46;font-weight:800">86%</span>
      <span style="font-size:9px;color:#10B981">+8%</span>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px">
    <div style="font-size:9px;color:#065F46">竞争力评分</div>
    <div style="display:flex;align-items:center;gap:4px">
      <span style="font-size:10px;color:#D97706;font-weight:700">82</span>
      <span style="font-size:9px;color:#065F46">→</span>
      <span style="font-size:11px;color:#065F46;font-weight:800">88</span>
      <span style="font-size:9px;color:#10B981">+6</span>
    </div>
  </div>
</div>

<!-- 底部双按钮：padding 8px 10px bg white border-top 0.5px flex gap 6px -->
<div style="padding:8px 10px;background:white;border-top:0.5px solid #E5E7EB;display:flex;gap:6px">
  <button style="flex:1;padding:8px;border:0.5px solid #D1D5DB;background:transparent;border-radius:8px;font-size:10px;font-weight:600;cursor:pointer">稍后再说</button>
  <button style="flex:1;padding:8px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer">写入画像 ✓</button>
</div>
```

---

#### [页面5] 岗位探索 `/explore`

```html
<!-- 顶部（bg white padding 12px 12px 0） -->
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
  <div style="font-size:14px;font-weight:800;letter-spacing:-0.4px;color:#0A0A0A">岗位探索</div>
  <div style="font-size:8px;color:#6B7280">共 51 种岗位</div>
</div>

<!-- 搜索框：flex align-items center gap 6px padding 7px 10px bg #F9FAFB border 0.5px #D1D5DB border-radius 20px margin-bottom 8px -->
<div style="display:flex;align-items:center;gap:6px;padding:7px 10px;background:#F9FAFB;border:0.5px solid #D1D5DB;border-radius:20px;margin-bottom:8px">
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="5" cy="5" r="4" stroke="#9CA3AF" stroke-width="1.2"/><path d="M9 9l2 2" stroke="#9CA3AF" stroke-width="1.2" stroke-linecap="round"/></svg>
  <span style="font-size:10px;color:#9CA3AF">搜索岗位，如「产品经理」</span>
</div>

<!-- 筛选行：flex gap 4px overflow-x auto scrollbar-width none margin-bottom 10px -->
<div style="display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin-bottom:10px">
  <!-- 选中 -->
  <span style="padding:3px 9px;background:#4F46E5;color:#fff;border-radius:20px;font-size:8px;font-weight:700;white-space:nowrap;flex-shrink:0">全部</span>
  <!-- 未选中 -->
  <span style="padding:3px 9px;border:0.5px solid #E5E7EB;border-radius:20px;font-size:8px;color:#6B7280;white-space:nowrap;flex-shrink:0">互联网</span>
  <span style="padding:3px 9px;border:0.5px solid #E5E7EB;border-radius:20px;font-size:8px;color:#6B7280;white-space:nowrap;flex-shrink:0">AI/算法</span>
  <span style="padding:3px 9px;border:0.5px solid #E5E7EB;border-radius:20px;font-size:8px;color:#6B7280;white-space:nowrap;flex-shrink:0">数据</span>
  <span style="padding:3px 9px;border:0.5px solid #E5E7EB;border-radius:20px;font-size:8px;color:#6B7280;white-space:nowrap;flex-shrink:0">金融</span>
</div>

<!-- 岗位卡片（每张）：
  flex align-items flex-start gap 7px padding 9px 10px bg white border 0.5px #E5E7EB
  border-radius 10px margin-bottom 7px cursor pointer position relative -->

<!-- 图标块：26x26 border-radius 7px bg 纯色 display flex align-items center justify-content center
  文字：首汉字 font-size 9px font-weight 800 color white flex-shrink 0 -->

<!-- 内容区：flex 1 min-width 0 -->
<!-- 岗位名：font-size 11px font-weight 700 color #0A0A0A -->
<!-- 副标题：font-size 8px color #6B7280 margin-bottom 4px -->
<!-- 四维迷你条（每行）：
  display flex align-items center gap 3px margin 1.5px 0
  标签：font-size 8px color #9CA3AF width 13px flex-shrink 0
  轨道：flex 1 height 2.5px bg #F3F4F6 border-radius 2px overflow hidden
  填充：height 100% border-radius 2px （颜色按维度）
-->
<!-- 综合分：font-size 18px font-weight 900 letter-spacing -0.8px flex-shrink 0 line-height 1 -->
<!-- 箭头：position absolute right 10px top 50% translateY(-50%) font-size 10px color #9CA3AF "›" -->

<!-- 四张卡片数据：
  后端开发工程师：图标色 #4F46E5，文字"后"，分数 89 color #4F46E5，行业"互联网 · 初级 · 北京/上海"
    四维（填充宽度/颜色）：基础 95% #1D4ED8 / 技能 82% #3B82F6 / 素养 78% #10B981 / 潜力 88% #D97706

  数据分析师：图标色 #059669，文字"数"，分数 83 color #10B981，行业"金融/电商 · 初级 · 上海"
    四维：90% #1D4ED8 / 76% #3B82F6 / 72% #10B981 / 80% #D97706

  算法工程师：图标色 #D97706，文字"算"，分数 76 color #D97706，行业"AI/大模型 · 初级 · 北京"
    四维：88% #1D4ED8 / 60% #60A5FA / 75% #10B981 / 85% #D97706

  前端开发工程师：图标色 #3B82F6，文字"前"，分数 72 color #3B82F6，行业"互联网 · 初级 · 全国"
    四维：85% #1D4ED8 / 68% #60A5FA / 74% #10B981 / 70% #D97706
-->
```

---

#### [页面6] 匹配详情 `/match/:id`

```html
<!-- 顶部（bg white padding 12px 12px 0） -->
<!-- 返回行："← 返回探索" font-size 9px font-weight 600 color #4F46E5 margin-bottom 2px cursor pointer -->
<!-- 岗位名："后端开发工程师" font-size 13px font-weight 800 letter-spacing -0.3px -->
<!-- 标签行：flex gap 4px margin-top 4px -->
<!-- 右侧大分："89" font-size 28px font-weight 900 color #4F46E5 letter-spacing -1px line-height 1，下方"综合匹配" font-size 8px color #9CA3AF -->

<!-- 四维评分：flex gap 5px margin-bottom 8px
  每格：flex 1 bg #F9FAFB border-radius 8px padding 7px 4px text-align center
  数字：font-size 18px font-weight 900 letter-spacing -0.8px line-height 1
  标签：font-size 7px color #9CA3AF margin-top 2px line-height 1.3
  基础 95 #1D4ED8 / 技能 82 #3B82F6 / 素养 78 #10B981 / 潜力 88 #D97706 -->

<!-- 必备技能卡 -->
<div class="card">
  <div class="card-hd"><div class="card-hd-bar" style="background:#3B82F6"></div>岗位必备技能</div>
  <div style="display:flex;flex-wrap:wrap;gap:4px">
    <span class="tag tag-green">Python ✓</span>
    <span class="tag tag-green">MySQL ✓</span>
    <span class="tag tag-red">Redis ✗</span>
    <span class="tag tag-amber">微服务 △</span>
    <span class="tag tag-gray">Kafka 加分</span>
    <span class="tag tag-gray">K8s 加分</span>
  </div>
</div>

<!-- 差距清单卡 -->
<div class="card">
  <div class="card-hd"><div class="card-hd-bar" style="background:#EF4444"></div>差距清单</div>
  <!-- 每行：flex align-items flex-start gap 6px padding 6px 0 border-bottom 0.5px #E5E7EB（最后行无）
    圆点：6x6 border-radius 50% flex-shrink 0 margin-top 3px
    右：项目名 font-size 10px font-weight 700 / 说明 font-size 9px color #6B7280 -->
  <div style="display:flex;align-items:flex-start;gap:6px;padding:6px 0;border-bottom:0.5px solid #E5E7EB">
    <div style="width:6px;height:6px;border-radius:50%;background:#EF4444;flex-shrink:0;margin-top:3px"></div>
    <div><div style="font-size:10px;font-weight:700;color:#0A0A0A">Redis 缺失</div><div style="font-size:9px;color:#6B7280">必备技能 · 影响 -15分</div></div>
  </div>
  <div style="display:flex;align-items:flex-start;gap:6px;padding:6px 0;border-bottom:0.5px solid #E5E7EB">
    <div style="width:6px;height:6px;border-radius:50%;background:#EF4444;flex-shrink:0;margin-top:3px"></div>
    <div><div style="font-size:10px;font-weight:700;color:#0A0A0A">量化成果不足</div><div style="font-size:9px;color:#6B7280">简历表达 · 影响 -8分</div></div>
  </div>
  <div style="display:flex;align-items:flex-start;gap:6px;padding:6px 0;border-bottom:0.5px solid #E5E7EB">
    <div style="width:6px;height:6px;border-radius:50%;background:#D97706;flex-shrink:0;margin-top:3px"></div>
    <div><div style="font-size:10px;font-weight:700;color:#0A0A0A">微服务经验弱</div><div style="font-size:9px;color:#6B7280">加分项 · 可补充</div></div>
  </div>
  <div style="display:flex;align-items:flex-start;gap:6px;padding:6px 0">
    <div style="width:6px;height:6px;border-radius:50%;background:#10B981;flex-shrink:0;margin-top:3px"></div>
    <div><div style="font-size:10px;font-weight:700;color:#0A0A0A">Python · 强匹配</div><div style="font-size:9px;color:#6B7280">核心技能完全匹配</div></div>
  </div>
</div>

<!-- 路径规划卡 -->
<div class="card" style="margin-bottom:0">
  <div class="card-hd"><div class="card-hd-bar" style="background:#10B981"></div>职业路径</div>

  <!-- 垂直晋升标题："垂直晋升" font-size 8px font-weight 700 color #9CA3AF uppercase letter-spacing 0.06em margin-bottom 7px -->

  <!-- 路径节点结构：flex align-items flex-start gap 7px
    左列：flex flex-direction column align-items center
      节点圆：22x22 border-radius 50%
      连接线：1.5px height 18px bg #E5E7EB margin-left 10px
    右列：岗位名 font-size 10px font-weight 700 / 条件 font-size 9px color #6B7280 -->

  <!-- 当前节点：bg #4F46E5 color white，内容"你"（白色勾） -->
  <!-- 未来节点：bg white border 1.5px #4F46E5 color #4F46E5，内容序号 -->

  <!-- 节点1（当前）-->
  <div style="display:flex;align-items:flex-start;gap:7px">
    <div style="display:flex;flex-direction:column;align-items:center">
      <div style="width:22px;height:22px;border-radius:50%;background:#4F46E5;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 4.5l2 2 4-4" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div style="width:1.5px;height:18px;background:#E5E7EB;margin-left:0"></div>
    </div>
    <div style="padding-top:2px"><div style="font-size:10px;font-weight:700;color:#4F46E5">后端开发（初级）</div><div style="font-size:9px;color:#6B7280">补 Redis + 量化描述</div></div>
  </div>

  <!-- 节点2 -->
  <div style="display:flex;align-items:flex-start;gap:7px">
    <div style="display:flex;flex-direction:column;align-items:center">
      <div style="width:22px;height:22px;border-radius:50%;background:white;border:1.5px solid #4F46E5;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#4F46E5;flex-shrink:0">2</div>
      <div style="width:1.5px;height:18px;background:#E5E7EB"></div>
    </div>
    <div style="padding-top:2px"><div style="font-size:10px;font-weight:700;color:#0A0A0A">后端开发（中级）</div><div style="font-size:9px;color:#6B7280">2年 · 微服务+高并发</div></div>
  </div>

  <!-- 节点3 -->
  <div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:8px">
    <div style="width:22px;height:22px;border-radius:50%;background:white;border:1.5px solid #4F46E5;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#4F46E5;flex-shrink:0">3</div>
    <div style="padding-top:2px"><div style="font-size:10px;font-weight:700;color:#0A0A0A">技术负责人</div><div style="font-size:9px;color:#6B7280">5年+ · 架构+带团队</div></div>
  </div>

  <!-- 分隔线 -->
  <div style="height:0.5px;background:#E5E7EB;margin-bottom:7px"></div>

  <!-- 横向转岗标题 + 节点（同上，连接线颜色 #D1FAE5，节点 border/color #10B981，内容"→"） -->
</div>

<button class="btn-primary">生成职业规划报告 →</button>
```

---

#### [页面7] 职业报告 `/report`（**纯展示，无任何编辑入口**）

```html
<!-- 顶部（固定白底 padding 10px 12px border-bottom 0.5px） -->
<div style="padding:10px 12px;background:white;border-bottom:0.5px solid #E5E7EB;display:flex;justify-content:space-between;align-items:flex-start;flex-shrink:0">
  <div>
    <div style="font-size:14px;font-weight:800;letter-spacing:-0.4px;color:#0A0A0A">职业发展报告</div>
    <div style="font-size:9px;color:#6B7280;margin-top:2px">张同学 · 后端开发工程师</div>
  </div>
  <!-- 生成中：bg #F3F4F6 color #9CA3AF cursor not-allowed -->
  <!-- 完成后：bg #4F46E5 color white cursor pointer -->
  <button style="padding:5px 12px;background:#4F46E5;color:#fff;border:none;border-radius:7px;font-size:9px;font-weight:700;cursor:pointer">↓ 导出</button>
</div>

<!-- 生成中骨架屏（章节逐步点亮） -->
<!-- 已生成章节：animation fadeUp 0.4s ease -->
<div style="background:white;border:0.5px solid #E5E7EB;border-radius:10px;padding:11px;margin-bottom:7px;animation:fadeUp 0.4s ease forwards">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
    <div style="font-size:10px;font-weight:800;color:#0A0A0A;letter-spacing:-0.2px">一、个人优势总结</div>
    <span style="padding:2px 7px;border-radius:20px;font-size:8px;font-weight:600;background:#D1FAE5;color:#065F46">已生成</span>
  </div>
  <div style="font-size:9px;color:#374151;line-height:1.9">[第一章正文内容]</div>
</div>

<!-- 正在生成章节（骨架屏） -->
<div style="background:white;border:0.5px solid rgba(79,70,229,0.2);border-radius:10px;padding:11px;margin-bottom:7px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <div style="font-size:10px;font-weight:800;color:#0A0A0A">二、目标岗位分析</div>
    <div style="display:flex;align-items:center;gap:4px">
      <div style="width:5px;height:5px;border-radius:50%;background:#4F46E5;animation:pulse 1s infinite"></div>
      <span style="font-size:8px;color:#4F46E5;font-weight:600">生成中</span>
    </div>
  </div>
  <!-- 骨架条：.skeleton height 8px margin-bottom 5px，宽度依次 90%/100%/75%/85% -->
  <div class="skeleton" style="height:8px;width:90%;margin-bottom:5px"></div>
  <div class="skeleton" style="height:8px;width:100%;margin-bottom:5px"></div>
  <div class="skeleton" style="height:8px;width:75%;margin-bottom:5px"></div>
  <div class="skeleton" style="height:8px;width:85%"></div>
</div>

<!-- 待生成章节（递减透明度） -->
<!-- opacity 0.5 / 0.35 / 0.2 -->
<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 11px;background:white;border:0.5px solid #E5E7EB;border-radius:10px;opacity:0.5">
  <div style="font-size:10px;color:#6B7280">三、差距与行动计划</div>
  <span style="padding:2px 7px;border-radius:20px;font-size:8px;background:#F3F4F6;color:#6B7280">待生成</span>
</div>

<!-- 完成后阅读态 -->
<!-- 第三章：差距与行动计划（内嵌色块列表） -->
<div style="display:flex;flex-direction:column;gap:4px">
  <div style="display:flex;align-items:flex-start;gap:6px;padding:6px 8px;background:#D1FAE5;border-radius:7px">
    <div style="font-size:8px;font-weight:700;color:#065F46;min-width:14px">1</div>
    <div style="font-size:9px;color:#065F46;line-height:1.6">学习 Redis 基础（缓存/分布式锁），2–3周可掌握核心用法</div>
  </div>
  <div style="display:flex;align-items:flex-start;gap:6px;padding:6px 8px;background:#D1FAE5;border-radius:7px">
    <div style="font-size:8px;font-weight:700;color:#065F46;min-width:14px">2</div>
    <div style="font-size:9px;color:#065F46;line-height:1.6">补充项目量化数据：用户量 300+、接口响应降低 40%</div>
  </div>
  <div style="display:flex;align-items:flex-start;gap:6px;padding:6px 8px;background:#FEF3C7;border-radius:7px">
    <div style="font-size:8px;font-weight:700;color:#92400E;min-width:14px">3</div>
    <div style="font-size:9px;color:#92400E;line-height:1.6">了解微服务基本概念，可结合 Spring Cloud 做一个 demo</div>
  </div>
</div>

<!-- 第四章：路径时间轴（内嵌，同匹配详情页时间轴结构，节点 18x18） -->

<!-- 第二章：内嵌四维数字格 -->
<div style="display:flex;gap:4px">
  <div style="flex:1;text-align:center;padding:5px;background:#F9FAFB;border-radius:7px">
    <div style="font-size:14px;font-weight:900;color:#1D4ED8;letter-spacing:-0.5px">95</div>
    <div style="font-size:7px;color:#9CA3AF;margin-top:1px">基础</div>
  </div>
  <div style="flex:1;text-align:center;padding:5px;background:#F9FAFB;border-radius:7px">
    <div style="font-size:14px;font-weight:900;color:#3B82F6;letter-spacing:-0.5px">82</div>
    <div style="font-size:7px;color:#9CA3AF;margin-top:1px">技能</div>
  </div>
  <div style="flex:1;text-align:center;padding:5px;background:#F9FAFB;border-radius:7px">
    <div style="font-size:14px;font-weight:900;color:#10B981;letter-spacing:-0.5px">78</div>
    <div style="font-size:7px;color:#9CA3AF;margin-top:1px">素养</div>
  </div>
  <div style="flex:1;text-align:center;padding:5px;background:#F9FAFB;border-radius:7px">
    <div style="font-size:14px;font-weight:900;color:#D97706;letter-spacing:-0.5px">88</div>
    <div style="font-size:7px;color:#9CA3AF;margin-top:1px">潜力</div>
  </div>
</div>
```

---

#### [页面8] 引导页 `/onboarding`（无 TabBar）

```html
<!-- 三屏共同容器：height 100dvh flex flex-direction column align-items center justify-content center
  padding 20px 16px text-align center bg white -->

<!-- 引导屏1插图 -->
<svg width="80" height="80" viewBox="0 0 80 80" style="margin-bottom:16px">
  <rect width="80" height="80" rx="20" fill="#EEF2FF"/>
  <rect x="18" y="22" width="44" height="36" rx="4" fill="#C7D2FE" stroke="#4F46E5" stroke-width="1.5"/>
  <rect x="24" y="30" width="32" height="3" rx="1.5" fill="#4F46E5" opacity="0.6"/>
  <rect x="24" y="36" width="24" height="3" rx="1.5" fill="#4F46E5" opacity="0.4"/>
  <rect x="24" y="42" width="28" height="3" rx="1.5" fill="#4F46E5" opacity="0.4"/>
  <circle cx="56" cy="52" r="12" fill="#4F46E5"/>
  <path d="M51 52l3 3 6-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

<!-- 主标题：font-size 16px font-weight 900 letter-spacing -0.6px color #0A0A0A margin-bottom 8px -->
<!-- 副标题：font-size 10px color #6B7280 line-height 1.7 margin-bottom 20px -->

<!-- 进度点：active 18x4 bg #4F46E5，inactive 6x4 bg #E5E7EB，gap 5px，margin-bottom 20px -->
<div style="display:flex;gap:5px;margin-bottom:20px">
  <div style="width:18px;height:4px;border-radius:2px;background:#4F46E5"></div>
  <div style="width:6px;height:4px;border-radius:2px;background:#E5E7EB"></div>
  <div style="width:6px;height:4px;border-radius:2px;background:#E5E7EB"></div>
</div>

<!-- 主按钮："下一步" width 100% -->
<!-- 跳过："跳过引导" font-size 9px color #9CA3AF margin-top 10px cursor pointer -->

<!-- 登录屏输入框：
  标签 font-size 9px color #6B7280 margin-bottom 4px
  框：height 32px border 0.5px #D1D5DB border-radius 8px padding 0 10px font-size 10px
  placeholder color #9CA3AF -->

<!-- 次要按钮："使用 Demo 账号体验"
  width 100% border 0.5px #E5E7EB bg transparent border-radius 8px font-size 10px color #6B7280 -->
```

---

#### [页面9] 空状态组件（三个 Tab 共用）

```html
<!-- 容器：height 280px flex column align-items center justify-content center padding 16px text-align center -->

<!-- 探索页图标 -->
<svg width="56" height="56" viewBox="0 0 56 56" style="margin-bottom:12px">
  <rect width="56" height="56" rx="14" fill="#F3F4F6"/>
  <circle cx="25" cy="23" r="10" fill="none" stroke="#D1D5DB" stroke-width="2"/>
  <path d="M32 30l8 8" stroke="#D1D5DB" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M20 23h10M25 18v10" stroke="#D1D5DB" stroke-width="1.5" stroke-linecap="round"/>
</svg>

<!-- 标题：font-size 13px font-weight 700 color #0A0A0A margin-bottom 6px -->
<!-- 说明：font-size 10px color #6B7280 line-height 1.7 margin-bottom 16px -->
<!-- 按钮："去上传简历" width auto padding 8px 20px bg #4F46E5 color white border-radius 8px font-size 10px font-weight 700 -->
```

---

### 实现顺序

```
Step 1: tokens.css + 全局 reset
Step 2: TabBar 组件
Step 3: App.tsx 路由
Step 4: Upload 页
Step 5: Parsing 页（含动画）
Step 6: Profile 页
Step 7: ChatFill 页（两个状态）
Step 8: Explore 页
Step 9: Match 页
Step 10: Report 页（生成中 + 阅读态）
Step 11: Onboarding 页
Step 12: EmptyState 组件，接入三个 Tab
```

---

## PHASE 2：后端报告生成重写

### 修改文件：`backend/app/prompts/report_generation.py`

**报告结构约定（与前端 ReportPage 严格对应）：**

- 第一章：个人优势总结（纯文字段落，关键数字加粗）
- 第二章：目标岗位分析（文字 + 末尾输出四维分数 JSON）
- 第三章：差距与行动计划（文字引言 + 结构化行动项 JSON）
- 第四章：职业路径规划（文字 + 结构化路径节点 JSON）
- 第五章：评估周期（纯文字段落）

前端渲染规则：章节文字展示为纯文本，结构化 JSON 由前端解析后渲染为对应组件（四维格、行动色块、时间轴）。

```python
# backend/app/prompts/report_generation.py
"""
报告生成 Prompt 模板
每章独立生成，按顺序调用。
输出规范：纯文字段落 + 末尾（如需）一个 JSON 块，JSON 用 ```json ``` 包裹。
前端按章节分别解析正文和 JSON。
"""

REPORT_SYSTEM_PROMPT = """你是一个专业的大学生职业规划顾问，语言风格专业但亲切。

核心要求：
1. 内容必须基于提供的实际数据，禁止编造不存在的技能或经历
2. 建议必须具体可操作，禁止空话套话
3. 涉及技能差距必须明确：缺什么、影响多少分、怎么补、需要多长时间
4. 除第二/三/四章末尾的结构化 JSON 外，正文全部输出纯文本，不使用 Markdown 标记符（不用 ##、**、- 等）
5. 每章正文 150–300 字，简洁有力
"""

# 第一章：个人优势总结
CHAPTER_1_PROMPT = """根据以下学生画像，生成"个人优势总结"章节正文。

要求：
- 2–3 段纯文字，共 150–250 字
- 第一段：总体定位一句话（学校/专业/竞争力分位）
- 第二段：列举 3 个核心优势，每个优势必须附上简历中的具体证据
- 第三段：指出与目标岗位最匹配的 1–2 个优势点
- 禁止使用列表符号，全部写成自然段落

学生画像：
姓名：{name}
学校/专业/年级：{school}
综合竞争力：{overall_score}/100，同类 Top {percentile}%
技能（前5）：{top_skills}
实习经历：{internships}
项目经历：{projects}
证书/奖项：{certificates}
软素养：{soft_skills}

目标岗位：{target_job_name}
"""

# 第二章：目标岗位分析
CHAPTER_2_PROMPT = """根据以下匹配数据，生成"目标岗位分析"章节。

输出格式（严格遵守）：
[正文段落，100–150字，说明岗位核心要求和综合匹配情况]

```json
{{
  "overall_score": 数字,
  "dimensions": {{
    "basic": {{"score": 数字, "reason": "一句话说明得失分原因"}},
    "skills": {{"score": 数字, "reason": "一句话"}},
    "competency": {{"score": 数字, "reason": "一句话"}},
    "potential": {{"score": 数字, "reason": "一句话"}}
  }}
}}
```

匹配数据：
目标岗位：{target_job_name}
综合匹配分：{overall_score}
四维分数：基础要求 {basic_score} / 技术技能 {skills_score} / 职业素养 {competency_score} / 发展潜力 {potential_score}
匹配亮点：{match_highlights}
主要差距：{main_gaps}
"""

# 第三章：差距与行动计划
CHAPTER_3_PROMPT = """根据以下差距清单，生成"差距与行动计划"章节。

输出格式（严格遵守）：
[正文引言，50–80字，总结主要差距]

```json
[
  {{
    "priority": "必须补齐",
    "item": "差距项名称",
    "gap_desc": "缺什么",
    "score_impact": -数字,
    "action": "具体行动（一句话）",
    "timeline": "X周/月内"
  }},
  ...
]
```

优先级规则：
- "必须补齐"：必备技能缺失，影响 ≥ 10分
- "建议提升"：加分项缺口，影响 < 10分

差距清单：
{gap_list}

学生当前技能：
{student_skills}
"""

# 第四章：职业路径规划
CHAPTER_4_PROMPT = """根据以下信息，生成"职业路径规划"章节。

输出格式（严格遵守）：
[正文引言，50–80字，说明推荐主路径和理由]

```json
{{
  "primary_path": [
    {{
      "stage": "现在",
      "title": "{target_job_name}（初级）",
      "condition": "需要完成的事项（一句话）",
      "is_current": true
    }},
    {{
      "stage": "2年后",
      "title": "岗位名（中级）",
      "condition": "需要掌握的能力",
      "is_current": false
    }},
    {{
      "stage": "5年+",
      "title": "岗位名（高级/负责人）",
      "condition": "需要掌握的能力",
      "is_current": false
    }}
  ],
  "alt_paths": [
    {{
      "title": "可转岗位名",
      "skill_overlap": 数字,
      "gap_skills": ["缺失技能1", "缺失技能2"]
    }}
  ]
}}
```

学生画像摘要：{student_summary}
目标岗位：{target_job_name}
可选相关岗位：{related_jobs}
学生主要技能：{student_skills}
"""

# 第五章：评估周期
CHAPTER_5_PROMPT = """根据以下行动计划，生成"评估周期"章节正文。

要求：
- 2 段纯文字，共 100–150 字
- 第一段：建议 3 个月自评一次，给出 3 个具体的短期检查点（直接写在句子里，不用列表符号）
- 第二段：6 个月后建议重新上传简历重新匹配，说明意义
- 禁止使用任何列表符号

行动计划摘要：{action_summary}
主要差距项：{main_gaps}
"""
```

### 修改文件：`backend/app/services/report_generator.py`

报告生成服务按以下逻辑重写：

```python
async def generate_report(self, ...):
    # 1. 创建 report 记录，status="generating"
    # 2. 按顺序生成五章，每章完成后立即 commit（前端可轮询看到进度）
    # 3. 每章调用对应 CHAPTER_N_PROMPT
    # 4. 第2/3/4章：从响应中分离正文和 JSON 块，分别存储
    #    正文 → chapter_N_text 字段
    #    JSON → chapter_N_data 字段（JSON string）
    # 5. 全部完成后 status="done"

    chapter_configs = [
        (1, CHAPTER_1_PROMPT, False),   # (章节号, prompt模板, 是否含JSON)
        (2, CHAPTER_2_PROMPT, True),
        (3, CHAPTER_3_PROMPT, True),
        (4, CHAPTER_4_PROMPT, True),
        (5, CHAPTER_5_PROMPT, False),
    ]

    for ch_num, prompt_tpl, has_json in chapter_configs:
        prompt_vars = self._prepare_vars(ch_num, student_profile, job_profile, matching_result)
        prompt = prompt_tpl.format(**prompt_vars)
        raw = await self.llm.generate_text(REPORT_SYSTEM_PROMPT, prompt)

        if has_json:
            text, json_data = self._split_text_and_json(raw)
        else:
            text, json_data = raw, None

        # 更新对应字段
        setattr(report, f"chapter_{ch_num}_text", text)
        if json_data:
            setattr(report, f"chapter_{ch_num}_data", json_data)
        report.chapters_done = ch_num
        await db.commit()

def _split_text_and_json(self, raw: str) -> tuple[str, str | None]:
    """从 LLM 输出中分离正文和 JSON 块"""
    import re
    json_match = re.search(r'```json\s*([\s\S]*?)\s*```', raw)
    if not json_match:
        return raw.strip(), None
    json_str = json_match.group(1).strip()
    text = raw[:json_match.start()].strip()
    return text, json_str
```

### 对应数据库字段（需要 Alembic migration）

```python
# 在 CareerReport model 中新增字段（替换原有的 chapter_N 单字段）
chapter_1_text = Column(Text, nullable=True)   # 第一章正文
chapter_2_text = Column(Text, nullable=True)
chapter_2_data = Column(Text, nullable=True)   # JSON string
chapter_3_text = Column(Text, nullable=True)
chapter_3_data = Column(Text, nullable=True)
chapter_4_text = Column(Text, nullable=True)
chapter_4_data = Column(Text, nullable=True)
chapter_5_text = Column(Text, nullable=True)
chapters_done  = Column(Integer, default=0)    # 已完成章节数，前端轮询用
```

### 前端报告页 API 接入

前端每 3 秒轮询 `GET /api/reports/{report_id}/status`，返回：

```json
{
  "chapters_done": 2,
  "chapters": [
    {"index": 1, "text": "...", "data": null},
    {"index": 2, "text": "...", "data": {"overall_score": 89, "dimensions": {...}}},
    ...
  ]
}
```

前端根据 `chapters_done` 决定哪些章节显示内容，哪些显示骨架屏，哪些显示待生成态。

---

## 执行验证

每个页面实现完成后运行：

```bash
cd frontend/mobile
npm run dev
# 在浏览器中对照设计稿截图检查每个页面
```

报告生成重写后运行：

```bash
cd backend
python -m pytest tests/test_report_generation.py -v
# 或直接测试端到端
python -c "
import asyncio
from app.services.report_generator import ReportGeneratorService
# 用 demo 数据跑一次完整生成
asyncio.run(test_full_report())
"
```
