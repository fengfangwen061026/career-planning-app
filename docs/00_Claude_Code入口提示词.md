# CareerAI 用户端页面并行开发 · Claude Code 入口提示词

请按以下步骤执行，使用 subagent 并行模式开发用户端 15 个屏幕的 React 页面。

## 执行指令

**第一步（串行）：** 执行 Task A —— 建立公共基础设施

读取并执行 `/mnt/user-data/outputs/01_GroupA_引导登录.md` 中的完整任务。
完成后确认以下文件存在：
- `frontend/src/styles/mobile-tokens.css`
- `frontend/src/components/mobile/MobileShell.tsx`
- `frontend/src/components/mobile/TabBar.tsx`
- `frontend/src/pages/mobile/OnboardingFlow.tsx`

---

**第二步（并行）：** 所有 Task A 文件就绪后，同时启动以下 7 个 subagent：

```
Subagent 1: 读取并执行 /mnt/user-data/outputs/02_GroupB_上传解析.md
Subagent 2: 读取并执行 /mnt/user-data/outputs/03_GroupC_学生画像.md
Subagent 3: 读取并执行 /mnt/user-data/outputs/04_GroupD_对话补全.md
Subagent 4: 读取并执行 /mnt/user-data/outputs/05_GroupE_岗位探索.md
Subagent 5: 读取并执行 /mnt/user-data/outputs/06_GroupF_匹配详情.md
Subagent 6: 读取并执行 /mnt/user-data/outputs/07_GroupG_报告页.md
Subagent 7: 读取并执行 /mnt/user-data/outputs/08_GroupH_空状态反馈.md
```

每个 subagent 的职责：
1. 读取对应 .md 文件，完整理解规范
2. 创建对应页面的 .tsx 和 .css 文件
3. 所有 CSS 变量从 `mobile-tokens.css` 的 CSS 变量取，不硬编码颜色
4. 所有页面用 `MobileShell` 包裹
5. 路由跳转用 `useNavigate`（react-router-dom v6）
6. 不调用任何后端 API，全部使用 mock 数据

---

**第三步（串行）：** 所有 subagent 完成后，更新路由配置

在 `frontend/src/App.tsx` 中添加以下路由（保留现有内容，仅添加移动端路由）：

```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import OnboardingFlow from './pages/mobile/OnboardingFlow'
import UploadPage from './pages/mobile/UploadPage'
import ParsingPage from './pages/mobile/ParsingPage'
import ProfilePage from './pages/mobile/ProfilePage'
import ChatFillPage from './pages/mobile/ChatFillPage'
import ExplorePage from './pages/mobile/ExplorePage'
import MatchDetailPage from './pages/mobile/MatchDetailPage'
import ReportPage from './pages/mobile/ReportPage'

// 在路由配置中添加：
<Route path="/mobile" element={<Navigate to="/mobile/onboarding" replace />} />
<Route path="/mobile/onboarding" element={<OnboardingFlow />} />
<Route path="/mobile/upload" element={<UploadPage />} />
<Route path="/mobile/parsing" element={<ParsingPage />} />
<Route path="/mobile/profile" element={<ProfilePage />} />
<Route path="/mobile/chat-fill" element={<ChatFillPage />} />
<Route path="/mobile/explore" element={<ExplorePage />} />
<Route path="/mobile/match/:jobId" element={<MatchDetailPage />} />
<Route path="/mobile/report" element={<ReportPage />} />
```

注意：所有页面内部的 navigate() 调用都加 /mobile 前缀。

---

**第四步：** 运行 `npm run dev`（或已有的 dev 命令），在浏览器打开 /mobile/onboarding 验证页面。

检查清单：
- [ ] 引导页3步切换正常
- [ ] 上传页文件选择 → 跳转解析页
- [ ] 解析页5步动画 → 自动跳转画像页
- [ ] 画像页卡片全部显示，「立即补全」→ 对话页
- [ ] 对话页选项点击 → AI 回复 → 完成写入
- [ ] 探索页搜索激活态切换
- [ ] 匹配详情页完整展示
- [ ] 报告页骨架动画 → 生成完成

如果遇到 TypeScript 编译错误，直接修复，不要跳过。

---

## 公共编码规范

1. **CSS 变量强制**：所有颜色必须引用 `var(--color-*)` 或规范中明确给出的 hex（如品牌色 #4F46E5 可直接用）
2. **SVG 内联**：所有图标用内联 SVG，不导入图片文件
3. **字体**：`font-family: var(--font-family)`
4. **数字显示**：涉及数值用 `font-variant-numeric: tabular-nums`
5. **间距单位**：px，不用 rem/em（手机容器宽度固定）
6. **no Tailwind**：纯 CSS Modules 或 plain CSS，不引入 Tailwind
7. **动画复用**：fadeInUp / pulse / shimmer / bounce 只在 mobile-tokens.css 定义一次
8. **hover 效果**：交互元素加 `transition: 0.2s ease`，卡片 hover `transform: translateY(-1px)`
