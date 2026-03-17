# Task A · 引导流程 & 登录（S-01 / S-02 / S-03）

## 职责范围
- 创建 `frontend/src/styles/mobile-tokens.css`（公共 token，其他所有页面依赖）
- 创建 `frontend/src/components/mobile/MobileShell.tsx`（手机容器 + Tab Bar）
- 创建 `frontend/src/components/mobile/TabBar.tsx`
- 创建 `frontend/src/pages/mobile/OnboardingFlow.tsx`（含 S-01/S-02/S-03 三步）

---

## Step 1：创建 mobile-tokens.css

路径：`frontend/src/styles/mobile-tokens.css`

```css
:root {
  --color-primary: #4F46E5;
  --color-primary-light: #EEF2FF;
  --color-primary-dark: #1D4ED8;
  --color-success: #10B981;
  --color-success-text: #065F46;
  --color-success-bg: #D1FAE5;
  --color-warning: #D97706;
  --color-warning-text: #92400E;
  --color-warning-bg: #FEF3C7;
  --color-danger: #EF4444;
  --color-blue-mid: #3B82F6;
  --color-text-primary: #0A0A0A;
  --color-text-secondary: #374151;
  --color-text-tertiary: #6B7280;
  --color-text-placeholder: #9CA3AF;
  --color-border-primary: #E5E7EB;
  --color-border-secondary: rgba(0,0,0,0.08);
  --color-border-tertiary: rgba(0,0,0,0.05);
  --color-background-primary: #FFFFFF;
  --color-background-secondary: #F9FAFB;
  --color-background-tertiary: #F3F4F6;
  --font-family: -apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-4px); }
}
```

---

## Step 2：创建 MobileShell.tsx

路径：`frontend/src/components/mobile/MobileShell.tsx`

手机外壳容器，包裹所有移动端页面。规格：
- 外层容器居中，背景 #E5E7EB（模拟桌面）
- 手机容器：width 210px · height 455px · border-radius 30px · overflow hidden · box-shadow 0 20px 60px rgba(0,0,0,0.25)
- 内部：flex column，内容区 flex 1 overflow-y auto，底部 Tab Bar 高 48px（仅 hasTabBar prop 为 true 时显示）
- Props：`children: ReactNode, hasTabBar?: boolean, activeTab?: 'upload'|'profile'|'explore'|'report'`

---

## Step 3：创建 TabBar.tsx

路径：`frontend/src/components/mobile/TabBar.tsx`

底部导航栏，高 48px，border-top 0.5px var(--color-border-primary)，背景白。

4个 Tab，每个 flex 1，flex-direction column，align-items center，justify-content center，gap 2px：

| Tab | 标签 | 路由 | SVG 图标描述 |
|-----|------|------|-------------|
| 上传 | 上传 | /upload | `<rect x="3" y="2" width="12" height="14" rx="2"/>` + 3条横线 |
| 画像 | 画像 | /profile | `<circle cx="9" cy="6" r="3"/>` + `<path d="M3 18c0-3.3 2.7-6 6-6s6 2.7 6 6"/>` |
| 探索 | 探索 | /explore | `<circle cx="7.5" cy="7.5" r="4.5"/>` + `<path d="M13.5 13.5l2.5 2.5"/>` |
| 报告 | 报告 | /report | `<rect x="2" y="2" width="14" height="14" rx="2"/>` + 3条横线 |

SVG 尺寸 18×18，stroke-width 1.5，fill none，stroke-linecap round。
active 态：stroke/fill color #4F46E5，label color #4F46E5，font-weight 700。
inactive 态：color #9CA3AF。
font-size 7px。
点击调用 `useNavigate()`。

---

## Step 4：创建 OnboardingFlow.tsx

路径：`frontend/src/pages/mobile/OnboardingFlow.tsx`

使用内部状态 `step: 0|1|2`（0=S-01, 1=S-02, 2=S-03），无路由，组件内切换。用 `useNavigate` 在最后一步完成后跳转 `/upload`。

**公共样式：**
- 全屏 flex column align-items center justify-content center，padding 20px 16px，text-align center，background white
- 右上角绝对定位「跳过引导」：font-size 9px，color #9CA3AF，top 12px right 12px，cursor pointer
- 底部进度点：active 18px × 4px bg #4F46E5 border-radius 2px；inactive 6px × 4px bg #E5E7EB；gap 5px；margin-bottom 20px

---

### S-01：上传简历

**插图区（SVG 80×80）：**
```svg
<svg width="80" height="80" viewBox="0 0 80 80">
  <!-- 背景 -->
  <rect width="80" height="80" rx="20" fill="#EEF2FF"/>
  <!-- 蓝色文档 -->
  <rect x="18" y="22" width="44" height="36" rx="4" fill="#C7D2FE" stroke="#4F46E5" stroke-width="1.5"/>
  <!-- 三行横线 -->
  <rect x="24" y="30" width="32" height="2" rx="1" fill="#4F46E5" fill-opacity="0.6"/>
  <rect x="24" y="36" width="24" height="2" rx="1" fill="#4F46E5" fill-opacity="0.4"/>
  <rect x="24" y="42" width="28" height="2" rx="1" fill="#4F46E5" fill-opacity="0.4"/>
  <!-- 绿色勾圆 -->
  <circle cx="56" cy="52" r="12" fill="#4F46E5"/>
  <path d="M50 52l4 4 8-8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
```

主标题：「上传简历\n一键解析」，font-size 16px，font-weight 900，letter-spacing -0.6px，color #0A0A0A，margin-bottom 8px，white-space pre-line

副标题：「支持 PDF/Word，AI 自动提取\n教育、技能、项目、证书等信息」，font-size 10px，color #6B7280，line-height 1.7，margin-bottom 20px

进度点：active=第1个

主按钮「下一步」：width 100%，padding 8px，bg #4F46E5，color white，border-radius 8px，font-size 10px，font-weight 700，border none，cursor pointer

跳过链接：font-size 9px，color #9CA3AF，margin-top 10px，cursor pointer，background none，border none

---

### S-02：智能匹配

**插图区（SVG 80×80）：**
```svg
<svg width="80" height="80" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#D1FAE5"/>
  <!-- 外圆 -->
  <circle cx="40" cy="36" r="16" fill="#6EE7B7" stroke="#10B981" stroke-width="1.5"/>
  <!-- 内圆 -->
  <circle cx="40" cy="36" r="8" fill="#10B981"/>
  <!-- 勾 -->
  <path d="M36 36l3 3 6-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <!-- 底部进度条 -->
  <rect x="22" y="56" width="36" height="4" rx="2" fill="#10B981" fill-opacity="0.3"/>
  <rect x="22" y="56" width="24" height="4" rx="2" fill="#10B981" fill-opacity="0.5"/>
</svg>
```

主标题：「智能匹配\n找准方向」，同 S-01 样式

副标题：「四维评分精准分析\n差距一目了然，路径清晰可见」

进度点：active=第2个

按钮/跳过：同 S-01

---

### S-03：开始规划（含登录表单）

**插图区（SVG 80×80）：**
```svg
<svg width="80" height="80" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="20" fill="#EEF2FF"/>
  <!-- 卡片 -->
  <rect x="16" y="28" width="48" height="32" rx="6" fill="#C7D2FE" stroke="#4F46E5" stroke-width="1"/>
  <!-- 横线 -->
  <rect x="22" y="36" width="36" height="2" rx="1" fill="#4F46E5" fill-opacity="0.5"/>
  <rect x="22" y="42" width="28" height="2" rx="1" fill="#4F46E5" fill-opacity="0.35"/>
  <!-- 头像圆 -->
  <circle cx="40" cy="22" r="8" fill="#818CF8" stroke="#4F46E5" stroke-width="1"/>
  <circle cx="40" cy="20" r="3" fill="#4F46E5"/>
  <!-- 半圆身体 -->
  <path d="M33 28 Q40 24 47 28" fill="#818CF8"/>
</svg>
```

主标题：「开始规划你的\n职业之路」

副标题：「数据安全存储，随时续用」，font-size 9px，margin-bottom 20px

进度点：active=第3个（全3个）

**输入框：**
- label「手机号 / 邮箱」font-size 9px color #6B7280 margin-bottom 4px
- input: height 32px，border 0.5px solid var(--color-border-secondary)，border-radius 8px，padding 0 10px，font-size 10px，color #9CA3AF，placeholder「请输入账号」，width 100%，box-sizing border-box，margin-bottom 10px

主按钮「登录 / 注册」：同 S-01

**分隔线（或）：**flex，两端各 `<div style={{flex:1, height:'0.5px', background:'#E5E7EB'}}>`，中间「或」font-size 9px color #9CA3AF，margin 10px 0

次要按钮「使用 Demo 账号体验」：width 100%，border 0.5px solid #E5E7EB，bg transparent，font-size 10px，color #6B7280，border-radius 8px，padding 8px，cursor pointer

点击「登录/注册」或「Demo 账号」→ `navigate('/upload')`

---

## 文件产出清单

完成后确认以下文件存在：
- [ ] `frontend/src/styles/mobile-tokens.css`
- [ ] `frontend/src/components/mobile/MobileShell.tsx`
- [ ] `frontend/src/components/mobile/MobileShell.css`
- [ ] `frontend/src/components/mobile/TabBar.tsx`
- [ ] `frontend/src/components/mobile/TabBar.css`
- [ ] `frontend/src/pages/mobile/OnboardingFlow.tsx`
- [ ] `frontend/src/pages/mobile/OnboardingFlow.css`
