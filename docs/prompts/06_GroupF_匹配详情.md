# Task F · 人岗匹配详情（S-11）

## 文件产出
- `frontend/src/pages/mobile/MatchDetailPage.tsx` + `.css`

路由：/match/:jobId（demo 固定显示后端开发工程师数据）
用 `<MobileShell hasTabBar activeTab="explore">` 包裹。

内容区：overflow-y auto，padding 10px，display flex，flex-direction column，gap 7px，bg var(--color-background-secondary)

---

## 1. 顶部信息区（白底卡片）

容器：bg white，border-radius 11px，padding 11px

**返回行：** cursor pointer onClick → navigate('/explore')，margin-bottom 6px
「← 返回探索」font-size 9px font-weight 600 color #4F46E5

**信息主区：** display flex，justify-content space-between，align-items flex-start

**左侧：**
- 岗位名「后端开发工程师」font-size 13px font-weight 800 letter-spacing -0.3px color #0A0A0A margin-bottom 6px
- 标签行：flex gap 4px flex-wrap wrap
  - 「互联网」bg #EFF6FF color #1D4ED8 font-size 8px padding 2px 7px border-radius 10px
  - 「初级岗」bg #D1FAE5 color #065F46 同上
  - 「北京/上海」bg #F3F4F6 color #6B7280 同上

**右侧综合分：** text-align center flex-shrink 0 margin-left 8px
- 「89」font-size 28px font-weight 900 color #4F46E5 letter-spacing -1px line-height 1
- 「综合匹配」font-size 8px color #9CA3AF margin-top 2px

---

## 2. 四维评分矩阵（2×2格）

容器：display grid，grid-template-columns 1fr 1fr，gap 5px

每格：bg var(--color-background-secondary)，border-radius 8px，padding 7px 4px，text-align center

**数字：** font-size 18px font-weight 900 letter-spacing -0.8px line-height 1

**标签：** font-size 7px color #9CA3AF margin-top 2px line-height 1.3

数据：
| 数字 | 颜色 | 标签 |
|------|------|------|
| 95 | #1D4ED8 | 基础\n要求 |
| 82 | #3B82F6 | 技术\n技能 |
| 78 | #10B981 | 职业\n素养 |
| 88 | #D97706 | 发展\n潜力 |

---

## 3. 必备技能速览卡

卡片：bg white，border 0.5px solid var(--color-border-primary)，border-radius 11px，padding 11px

卡片标题：左色条 bg #3B82F6，文字「岗位必备技能」

Tag布局：flex flex-wrap gap 4px margin-top 6px

Tag 样式（按匹配状态）：font-size 9px padding 3px 8px border-radius 10px font-weight 600

| Tag | 样式 |
|-----|------|
| Python ✓ | bg #D1FAE5 color #065F46 |
| MySQL ✓ | bg #D1FAE5 color #065F46 |
| Redis ✗ | bg #FEE2E2 color #991B1B |
| 微服务 △ | bg #FEF3C7 color #92400E |
| Kafka 加分 | bg #F3F4F6 color #6B7280 |
| K8s 加分 | bg #F3F4F6 color #6B7280 |

---

## 4. 差距清单卡

卡片标题：左色条 bg #EF4444，文字「差距清单」

每行结构：flex align-items flex-start gap 6px，padding 6px 0，border-bottom 0.5px solid #E5E7EB（最后行无）

左：彩色圆点 6×6 border-radius 50%，margin-top 3px，flex-shrink 0

右：
- 上：项目名 font-size 10px font-weight 700 color #0A0A0A
- 下：说明 font-size 9px color #6B7280 margin-top 1px

数据：
```ts
const gaps = [
  { dot: '#EF4444', name: 'Redis 缺失', desc: '必备技能 · 影响 -15分' },
  { dot: '#EF4444', name: '量化成果不足', desc: '简历表达 · 影响 -8分' },
  { dot: '#D97706', name: '微服务经验弱', desc: '加分项 · 可补充' },
  { dot: '#10B981', name: 'Python 强匹配', desc: '核心技能完全匹配' },
  { dot: '#10B981', name: '实习经历符合', desc: '互联网岗 2个月' },
]
```

---

## 5. 职业路径卡

卡片标题：左色条 bg #10B981，文字「职业路径」

### 垂直晋升区

副标题「垂直晋升」：font-size 8px font-weight 700 color #9CA3AF text-transform uppercase letter-spacing 0.06em margin-bottom 7px

**路径节点结构（3个节点）：**

每个节点组：display flex，align-items flex-start，gap 7px，margin-bottom 0

左列（节点 + 连接线）：display flex，flex-direction column，align-items center，width 22px

- 节点圆 22×22 border-radius 50%
  - 当前节点（节点1）：bg #4F46E5，display flex align-items center justify-content center
    SVG 10×10 勾（stroke white 1.5px，M2 5l3 3 5-5）
  - 未来节点：bg white，border 1.5px solid #4F46E5，display flex align-items center justify-content center
    文字「2」「3」font-size 9px color #4F46E5 font-weight 700
- 连接线（最后节点不显示）：width 1.5px，height 18px，bg #E5E7EB，margin-left 0（居中于节点）

右列：padding-top 2px，padding-bottom 10px
- 岗位名 font-size 10px font-weight 700 color #0A0A0A
- 条件描述 font-size 9px color #6B7280 margin-top 1px

节点数据：
```ts
const verticalPath = [
  { label: '你', name: '后端开发（初级）', condition: '补 Redis + 量化描述' },
  { label: '2',  name: '后端开发（中级）', condition: '2年 · 微服务+高并发' },
  { label: '3',  name: '技术负责人',        condition: '5年+ · 架构+带团队' },
]
```

### 分隔线

height 0.5px bg #E5E7EB margin 7px 0

### 横向转岗区

副标题「横向转岗」：同垂直晋升样式

转岗节点（2个）：
- 当前节点（同垂直晋升的当前节点）
- 连接线：bg #D1FAE5（绿色）
- 转岗节点：bg white，border 1.5px solid #10B981，文字「→」color #10B981 font-size 10px

右列：「数据工程师」「重叠 62% · 补 Spark」

---

## 6. 底部主操作按钮

margin-bottom 10px

「生成职业规划报告 →」：width 100%，padding 9px，bg #4F46E5，color white，border-radius 9px，font-size 11px，font-weight 700，border none，cursor pointer，onClick → navigate('/report')
