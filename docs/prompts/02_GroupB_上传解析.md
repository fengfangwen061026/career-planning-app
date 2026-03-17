# Task B · 上传 & 解析（S-04 / S-05）

## 前置依赖
`frontend/src/styles/mobile-tokens.css` 和 `MobileShell.tsx` 由 Task A 创建，本 Task 直接 import 使用。

## 文件产出
- `frontend/src/pages/mobile/UploadPage.tsx` + `.css`（S-04）
- `frontend/src/pages/mobile/ParsingPage.tsx` + `.css`（S-05）

---

## S-04：简历上传页（/upload · Tab 1 active）

页面用 `<MobileShell hasTabBar activeTab="upload">` 包裹。

### 页面结构（从上到下）

**1. 上传拖拽区**
- border 1.5px dashed var(--color-border-primary)
- border-radius 11px
- padding 24px 12px
- text-align center
- margin-bottom 10px
- background white

**图标（SVG 32×32）：**
```svg
<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="#EEF2FF"/>
  <!-- 上传箭头 -->
  <path d="M16 10v10M11 15l5-5 5 5" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- 底横线 -->
  <path d="M10 22h12" stroke="#4F46E5" stroke-width="2" stroke-linecap="round"/>
</svg>
```

主文字「点击或拖拽上传」：font-size 11px，font-weight 700，color #0A0A0A，margin-bottom 3px，margin-top 8px

说明文字「PDF / DOCX · 最大 10MB」：font-size 9px，color #6B7280，margin-bottom 10px

选择按钮「选择文件」：padding 6px 18px，bg #4F46E5，color white，border-radius 7px，font-size 10px，font-weight 700，border none，cursor pointer，onClick → navigate('/parsing')

拖拽区整体 onClick 也触发 navigate('/parsing')（demo 模式）

**2. 分隔线（或）**
flex，两端 div height 0.5px bg #E5E7EB，中间「或」font-size 9px color #9CA3AF，margin 10px 0

**3. 手动填写链接**
「手动填写基本信息 →」：font-size 10px，color #4F46E5，font-weight 600，text-align center，margin-bottom 14px，cursor pointer，display block

**4. 解析内容展示卡片**
- bg white，border 0.5px solid var(--color-border-primary)，border-radius 10px，padding 11px

**卡片标题行：**
flex align-items center gap 6px，margin-bottom 8px
- 左色条：width 2.5px，height 10px，bg #4F46E5，border-radius 1px，flex-shrink 0
- 文字「将自动解析以下内容」：font-size 9px，font-weight 700，color #9CA3AF，text-transform uppercase，letter-spacing 0.08em

**网格（2列，gap 5px）：**
```
[蓝] 教育经历    [蓝] 技能 & 工具
[绿] 实习 & 项目  [绿] 证书 & 奖项
[橙·全宽] 软素养信号 & 量化成果
```

每个色块格式：border-radius 7px，padding 5px 7px，flex align-items center gap 5px
- 蓝色：bg #EFF6FF，圆点 5×5 bg #1D4ED8，文字 font-size 9px color #1D4ED8 font-weight 500
- 绿色：bg #D1FAE5，圆点 5×5 bg #059669，文字 color #065F46
- 橙色（全宽 grid-column 1/-1）：bg #FEF3C7，圆点 bg #D97706，文字 color #92400E

---

## S-05：简历解析等待页（/parsing · 无Tab · 全屏）

页面用 `<MobileShell hasTabBar={false}>` 包裹。背景 white。

### 页面结构：flex column，align-items center，justify-content center，padding 20px 16px，text-align center，height 100%

**1. 顶部动画进度圈**

容器：position relative，width 64px，height 64px，margin-bottom 16px

```svg
<svg width="64" height="64" viewBox="0 0 64 64">
  <!-- 轨道 -->
  <circle cx="32" cy="32" r="26" stroke="#E5E7EB" stroke-width="5" fill="none"/>
  <!-- 进度弧，animation: pulse 1.5s infinite -->
  <circle cx="32" cy="32" r="26"
    stroke="#4F46E5" stroke-width="5" fill="none"
    stroke-dasharray="163" stroke-dashoffset="40"
    stroke-linecap="round"
    transform="rotate(-90 32 32)"
    style={{animation: 'pulse 1.5s infinite'}}/>
</svg>
```

内部绝对居中放文档 SVG（22×22，rect + 横线，stroke #4F46E5）

**2. 标题**
主标题「正在解析你的简历」：font-size 13px，font-weight 800，letter-spacing -0.3px，color #0A0A0A，margin-bottom 4px

副标题「通常需要 15–30 秒」：font-size 9px，color #6B7280，margin-bottom 20px

**3. 五步流程列表**

width 100%，text-align left，display flex，flex-direction column，gap 6px

用 `useState` 控制 `currentStep: 0~4`，每1.5s 自动推进（`useEffect + setInterval`），步骤完成后 navigate('/profile')

步骤数据：
```ts
const steps = [
  '读取简历文件',
  '识别教育经历',
  '抽取技能 & 项目',
  '识别证书 & 荣誉',
  '生成学生画像',
]
```

**已完成步骤样式：** bg #D1FAE5，border-radius 8px，padding 7px 10px
- 图标 SVG 14×14：circle r=7 fill=#10B981 + 勾 stroke white 1.5px
- 文字 font-size 10px font-weight 600 color #065F46

**进行中样式：** bg #EEF2FF，border 0.5px solid rgba(79,70,229,0.2)，border-radius 8px
- 图标 SVG 14×14：外圆 stroke=#4F46E5 fill=#EEF2FF + 内圆 r=3 fill=#4F46E5，animation pulse
- 文字 font-weight 700 color #4F46E5

**待执行样式：** bg var(--color-background-tertiary)，border-radius 8px
- 图标 SVG 14×14：空心圆 stroke=#D1D5DB fill=#F3F4F6
- 文字 color #9CA3AF
- opacity 第1个待执行0.5，第2个0.35，第3个0.2

每步 padding 7px 10px，display flex，align-items center，gap 8px

**4. 底部提示**
「可以先去做别的，完成后通知你」：font-size 9px，color #9CA3AF，margin-top 16px

---

## 注意事项
- S-05 是纯 demo 演示：useEffect 中每 1.5s currentStep++，到第5步后 2s delay navigate('/profile')
- 所有 SVG 内联，不用外部图片
- 动画用 CSS animation，keyframes 从 mobile-tokens.css 继承
