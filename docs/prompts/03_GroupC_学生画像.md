# Task C · 学生画像仪表盘（S-06）

## 文件产出
- `frontend/src/pages/mobile/ProfilePage.tsx` + `.css`

用 `<MobileShell hasTabBar activeTab="profile">` 包裹。
内容区 overflow-y auto，padding 10px 10px 0，display flex，flex-direction column，gap 7px，background var(--color-background-secondary)

---

## 1. 顶部用户信息行

容器：padding 12px 12px 8px，bg white，display flex，align-items center

**Avatar：** 34×34px，border-radius 50%，bg #EEF2FF，color #4F46E5，font-weight 800，font-size 12px，display flex，align-items center，justify-content center，flex-shrink 0，文字「张」

**文字组：** margin-left 8px
- 姓名「张同学」：font-size 13px，font-weight 800，letter-spacing -0.3px，color #0A0A0A
- 副标题「CS · 大三 · 上海交大」：font-size 9px，color #6B7280

**右侧完整度 Tag：** margin-left auto，bg #FEF3C7，color #92400E，font-size 8px，font-weight 600，padding 2px 7px，border-radius 10px，flex-shrink 0，文字「完整度 78%」

---

## 2. 综合数据卡

容器：bg white，border 0.5px solid var(--color-border-primary)，border-radius 11px，padding 10px 12px，display flex，align-items center，gap 8px

**左侧环形进度圈（52×52）：**

```svg
<svg width="52" height="52" viewBox="0 0 52 52">
  <!-- 轨道 -->
  <circle cx="26" cy="26" r="21" stroke="#E5E7EB" stroke-width="5" fill="none"/>
  <!-- 进度（78% → stroke-dashoffset = 132 * (1-0.78) ≈ 29） -->
  <circle cx="26" cy="26" r="21"
    stroke="#4F46E5" stroke-width="5" fill="none"
    stroke-dasharray="132" stroke-dashoffset="29"
    stroke-linecap="round"
    transform="rotate(-90 26 26)"/>
</svg>
```

绝对居中文字：「82」font-size 14px font-weight 900 color #4F46E5，下方「竞争力」font-size 7px color #9CA3AF

**右侧数据组（flex 1）：**

行1：flex justify-between align-items center，margin-bottom 4px
- 「简历完整度」font-size 9px color #6B7280
- 「78%」font-size 11px font-weight 800 color #D97706

进度条：height 4px，bg #F3F4F6，border-radius 2px，margin-bottom 7px
- fill div width 78%，bg #D97706，height 100%，border-radius 2px

行2：flex justify-between align-items center
- 「高匹配岗位」font-size 9px color #6B7280
- 「14个」font-size 11px font-weight 800 color #10B981

---

## 3. 技术技能卡

容器：bg white，border 0.5px solid var(--color-border-primary)，border-radius 11px，padding 11px

**卡片标题行：** flex align-items center gap 6px，margin-bottom 8px
- 左色条：width 2.5px，height 10px，bg #3B82F6，border-radius 1px
- 「技术技能」font-size 9px font-weight 700 color #9CA3AF text-transform uppercase letter-spacing 0.08em

**技能列表（5条）：** flex flex-direction column gap 5px

每行 flex align-items center gap 5px：
- 技能名：font-size 10px color #374151 width 36px flex-shrink 0
- 进度轨道：flex 1 height 4px bg #F3F4F6 border-radius 2px
  - fill div：height 100%，border-radius 2px，对应颜色和宽度
- 百分值：font-size 9px color #9CA3AF width 22px text-align right font-variant-numeric tabular-nums

数据：
```
Python  88%  #1D4ED8
React   75%  #3B82F6
SQL     70%  #3B82F6
机器学习 60%  #60A5FA
Docker  45%  #93C5FD
```

---

## 4. 实习 & 项目卡

同容器规格。左色条 bg #10B981，标题「实习 & 项目」

**条目1：**
- 「XX公司 · 算法实习生」font-size 10px font-weight 700 color #0A0A0A
- 「2024.07–09 · 2个月」font-size 9px color #6B7280 margin-bottom 4px
- Tag行：flex gap 4px flex-wrap wrap
  - 绿色 Tag「推荐算法」：bg #D1FAE5，color #065F46，font-size 8px，padding 2px 6px，border-radius 10px
  - 蓝色 Tag「A/B测试」：bg #EFF6FF，color #1D4ED8

**分隔线：** height 0.5px bg #E5E7EB margin 7px 0

**条目2：**
- 「校园二手交易平台」font-size 10px font-weight 700 color #0A0A0A
- 「个人项目 · React + FastAPI」font-size 9px color #6B7280 margin-bottom 4px
- Tag行：蓝色「全栈」+ 橙色「用户增长」（橙色：bg #FEF3C7 color #92400E）

**Notice 条：** display flex align-items flex-start gap 5px padding 7px 9px bg #FEF3C7 border-radius 7px font-size 9px color #92400E margin-top 7px
- 前缀「⚠」
- 「两个项目均缺少量化成果，建议补充数据指标」

---

## 5. 证书 & 荣誉卡

左色条 bg #D97706，标题「证书 & 荣誉」

Tag列表（flex flex-wrap gap 4px，margin-top 6px）：
- 「CET-6 · 568」绿色
- 「ACM 区域铜奖」蓝色
- 「国家励志奖学金」橙色
- 「阿里云 ACA」蓝色

Tag 通用样式：font-size 8px，padding 2px 7px，border-radius 10px，font-weight 500

---

## 6. 软素养卡

左色条 bg #4F46E5，标题「软素养」

Tag列表：
- 「自驱学习 · 3项」蓝色
- 「团队协作 · 2项」绿色
- 「抗压 · 1项」橙色
- 「沟通 · 待补充」灰色（bg #F3F4F6 color #9CA3AF）

---

## 7. 待补全项卡片

左色条 bg #EF4444，标题「待补全项 · 3处」

顶部说明「补全后预计竞争力提升 +12分」：font-size 9px color #6B7280 margin-bottom 8px

**3个缺失项（循环渲染）：**

每项结构：
- 分隔线 0.5px 首项不显示
- padding 8px 0
- flex justify-between align-items flex-start

左侧：
- 项目名 font-size 10px font-weight 700 color #0A0A0A
- 描述 font-size 9px color #6B7280 margin-top 1px

右侧影响分：font-size 8px color #EF4444 font-weight 700 flex-shrink 0 margin-left 8px

Notice 行（每项下方）：
- 容器：display flex justify-between align-items center bg #FEF3C7 border-radius 8px padding 7px 9px margin-top 5px
- 左「AI 对话帮你补充 →」font-size 9px color #92400E font-weight 500
- 右按钮「立即补全」：padding 4px 10px bg #D97706 color white border-radius 6px font-size 9px font-weight 700 border none cursor pointer onClick → navigate('/chat-fill')

数据：
```ts
const missingItems = [
  { name: '项目量化成果', desc: '2个项目缺少数据指标', score: '-12分' },
  { name: '沟通能力证据', desc: '缺少社团、演讲、跨团队协作', score: '-6分' },
  { name: '实习收获描述', desc: 'XX公司实习描述过于简单', score: '-4分' },
]
```

---

## 8. 底部主操作按钮

margin-top 8px，margin-bottom 10px

「探索匹配岗位 →」：width 100%，padding 9px，bg #4F46E5，color white，border-radius 9px，font-size 11px，font-weight 700，border none，cursor pointer，onClick → navigate('/explore')

---

## 动效
卡片首次渲染时依次 fadeInUp，delay 各差 0.05s（用 animation-delay inline style）
