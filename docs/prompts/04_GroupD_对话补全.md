# Task D · 对话补全（S-07 / S-08）

## 文件产出
- `frontend/src/pages/mobile/ChatFillPage.tsx` + `.css`

路由：/chat-fill
用 `<MobileShell hasTabBar={false}>` 包裹（Tab Bar 不可交互，本页全屏覆盖）。

内部结构：height 100%，display flex，flex-direction column

---

## 状态设计

```ts
type ChatState = 'chatting' | 'done'

const [chatState, setChatState] = useState<ChatState>('chatting')
const [currentQuestion, setCurrentQuestion] = useState(0)  // 0 or 1
const [messages, setMessages] = useState<Message[]>([
  { role: 'ai', text: '你好！我来帮你补充校园二手平台项目的量化成果。请问这个项目上线后，累计注册用户大约有多少？', options: ['100人以下','100–500人','500人以上','不清楚'] }
])
const [inputValue, setInputValue] = useState('')
```

---

## 1. 顶部导航栏

height auto，padding 10px 12px，bg white，border-bottom 0.5px solid var(--color-border-primary)，display flex，align-items center，gap 8px，flex-shrink 0

**返回区：** flex align-items center gap 5px cursor pointer onClick → navigate('/profile')
- 圆点 8×8 bg #4F46E5 border-radius 50%
- 「← 返回画像」font-size 9px color #4F46E5 font-weight 600

**标题：**「补充项目量化成果」font-size 11px font-weight 700 flex 1 text-align center

**进度点组（3个）：** flex gap 3px
- chatState='chatting' 且 currentQuestion=0：1个active（18×4 bg #4F46E5），2个inactive（6×4 bg #E5E7EB）
- currentQuestion=1：2个active，1个inactive
- chatState='done'：3个全active
- active border-radius 2px

---

## 2. 子进度条

padding 6px 10px，bg white，border-bottom 0.5px solid var(--color-border-primary)，flex-shrink 0

文字行：flex justify-content space-between margin-bottom 3px
- 「本次补全进度」font-size 8px color #6B7280
- 「问题 {currentQuestion+1}/4（chatting）/ 完成（done）」font-size 8px font-weight 700 color #4F46E5

进度条：height 3px，bg #F3F4F6，border-radius 2px
- fill width：chatting=25%/50%，done=100%，bg #4F46E5，transition width 0.3s

顶部导航栏右侧（done 态变化）：
- 进度点全部 active
- 顶部 title 右侧追加 `「✓ 对话完成」font-size 8px color #10B981`

---

## 3. 消息列表区

flex 1，overflow-y auto，padding 10px，display flex，flex-direction column，gap 8px，bg var(--color-background-secondary)

**AI 气泡：**
- align-self flex-start，max-width 80%（约 130px）
- 气泡：bg white，border 0.5px solid var(--color-border-primary)，border-radius 4px 12px 12px 12px，padding 8px 10px，font-size 10px，line-height 1.7，color #374151
- 时间戳「刚刚」：font-size 8px，color #9CA3AF，margin-top 3px

**快速选项行：** flex flex-wrap gap 5px，margin-top 6px
每项：padding 5px 10px，border 1px solid #4F46E5，border-radius 20px，font-size 9px，font-weight 600，color #4F46E5，bg #EEF2FF，cursor pointer，border none... 实际用 border 1px solid #4F46E5

点击选项 → 触发 handleOptionClick(option)

**用户气泡：**
- align-self flex-end，max-width 80%
- 气泡：bg #4F46E5，border-radius 12px 4px 12px 12px，padding 8px 10px，font-size 10px，color white，line-height 1.7
- 时间戳：text-align right font-size 8px color #9CA3AF margin-top 3px

**正在输入（AI thinking）：** 显示条件：`isTyping === true`
- 同 AI 气泡样式，padding 8px 10px
- 内部 3个圆点 5×5 bg #9CA3AF border-radius 50%，animation bounce，delay 0/0.2/0.4s

**chatState='done' 时新增消息（append 到列表）：**

AI完成提示气泡：「非常棒！我已经收集到足够的信息了。基于你的回答，已为你生成优化后的项目描述：」

**生成文案预览卡**（紧跟 AI 气泡后，独立 div）：
- bg white，border 1px solid #4F46E5，border-radius 8px，padding 10px，margin 0 0 6px 0
- 标题行「✦ AI 生成描述」font-size 8px font-weight 700 color #4F46E5 text-transform uppercase margin-bottom 6px
- 正文 font-size 9px color #374151 line-height 1.8：
  「开发校园二手交易平台（React + FastAPI），累计注册用户 **300+**，日活峰值 80人；通过接口缓存优化，响应时间降低 **40%**；独立完成前后端全栈开发与上线部署。」
  - 粗体数字「300+」「40%」：color #1D4ED8 font-weight 700

**AI引导气泡：**「这样写比原来更有说服力。你可以直接写入简历，也可以手动微调。」
快速选项：「✓ 直接写入画像」「✏ 手动编辑」

**效果预测框（独立 div）：**
- bg #D1FAE5，border 0.5px solid rgba(16,185,129,0.2)，border-radius 8px，padding 8px 10px
- 标题「补全后效果预测」font-size 8px font-weight 700 color #065F46 margin-bottom 6px
- 行1：flex justify-between
  - 「完整度」+ `<span color=#D97706>78%</span>` + 「→」+ `<span color=#065F46 font-weight 700>86%</span>` + `<span color=#10B981>+8%</span>`
  - font-size 9px
- 行2：同上「竞争力 82 → 88 +6」color patterns 相同
- 所有数值 font-size 9px font-variant-numeric tabular-nums

**AI引导继续气泡：**「还有 2 处缺失项（沟通能力、实习收获），要继续补充吗？」
快速选项：「继续补全」「稍后再说」

---

## 4. 底部输入栏（chatting 态）

padding 8px 10px，bg white，border-top 0.5px solid var(--color-border-primary)，display flex，align-items center，gap 6px，flex-shrink 0

输入框：flex 1，height 30px，border 0.5px solid var(--color-border-secondary)，border-radius 15px，padding 0 10px，font-size 10px，bg var(--color-background-secondary)，placeholder「输入回答，或选择上方选项...」，value=inputValue，onChange

发送按钮：width 28px，height 28px，border-radius 50%，bg #4F46E5，display flex，align-items center，justify-content center，cursor pointer，border none
- SVG 12×12：path d="M2 6h8M6 2l4 4-4 4" stroke white stroke-width 1.5 stroke-linecap round fill none

**底部操作按钮组（done 态替换输入栏）：**

padding 8px 10px，bg white，border-top 0.5px，display flex，gap 6px

「稍后再说」：flex 1，border 0.5px solid var(--color-border-primary)，bg transparent，border-radius 8px，font-size 10px，font-weight 600，color #374151，padding 8px，cursor pointer，onClick → navigate('/profile')

「写入画像 ✓」：flex 1，bg #4F46E5，color white，border-radius 8px，font-size 10px，font-weight 700，padding 8px，border none，cursor pointer，onClick → navigate('/profile')

---

## 交互逻辑

```ts
const handleOptionClick = (option: string) => {
  // 追加用户气泡
  addMessage({ role: 'user', text: option })
  setIsTyping(true)
  
  setTimeout(() => {
    setIsTyping(false)
    if (currentQuestion === 0) {
      // 追加第二轮 AI 问题
      addMessage({
        role: 'ai',
        text: '很好！300+ 用户是个不错的数据。项目运行期间有没有做过性能优化？比如接口响应时间、并发数提升之类的？',
        options: ['有，接口提速', '有，减少了Bug', '没有做优化']
      })
      setCurrentQuestion(1)
    } else {
      // 触发完成态
      setChatState('done')
    }
  }, 1200)
}
```

消息列表 ref 到底部自动滚动（`useEffect → messagesEndRef.current?.scrollIntoView()`）
