# 报告前端对接执行方案

> **模块**：报告生成SSE流式前端对接
> **辩论结论**：方案A - 直接SSE端点对接(fetch+ReadableStream)
> **辩论者**：debater-c1/c2/c3/c4

---

## 1. 推荐方案

**方案A - 直接SSE端点对接**

### 方案对比

| 维度 | 方案A(fetch+ReadableStream)✓ | 方案B(EventSource) | 方案C(WebSocket) | 方案D(渐进式) |
|------|----------------------------|-------------------|-----------------|--------------|
| 后端改动 | 无 | 无 | 需要 | 无 |
| 前端工作量 | 小 | 小 | 大 | 中 |
| 成熟度 | 成熟 | 成熟 | 一般 | 成熟 |
| 全双工 | 否 | 否 | 是 | 否 |
| 适用场景 | SSE场景最佳 | SSE简单场景 | 需双向通信 | 风险规避 |

### 投票结果
- c1→A, c2→A, c3→反对A, c4→A
- **结论：方案A胜出（3票）**

---

## 2. 详细执行步骤

### 步骤1：阅读后端实现

| 步骤 | 内容 | 文件位置 | 关键点 | 工时 |
|------|------|---------|--------|------|
| 1.1 | 阅读SSE端点 | `backend/app/api/reports.py:107-191` | 数据格式、事件类型 | 0.5h |
| 1.2 | 阅读流式生成器 | `backend/app/services/report_generator.py` | yield章节格式 | 0.5h |
| 1.3 | 阅读LLM流式支持 | `backend/app/ai/llm_provider.py:133` | chat_stream方法 | 0.5h |

### 步骤2：前端API对接

| 步骤 | 内容 | 文件 | 实现 | 工时 |
|------|------|------|------|------|
| 2.1 | 新增流式API方法 | `frontend/src/api/reports.ts` | `generateReportStream()` | 1h |
| 2.2 | 处理SSE事件解析 | 同上 | `data`字段解析 | 0.5h |
| 2.3 | 测试API调用 | - | curl验证 | 0.5h |

### 步骤3：前端UI接入

| 步骤 | 内容 | 文件 | 实现 | 工时 |
|------|------|------|------|------|
| 3.1 | 替换模拟进度 | `frontend/src/routes/Report.tsx:226-238` | 真实SSE消费 | 2h |
| 3.2 | 章节进度展示 | 同上 | 逐章更新UI | 0.5h |
| 3.3 | 错误处理 | 同上 | error事件处理 | 0.5h |
| 3.4 | 端到端测试 | - | 完整流程验证 | 1h |

### 步骤4：报告内容细化

| 步骤 | 内容 | 文件 | 实现 | 工时 |
|------|------|------|------|------|
| 4.1 | 更新prompt模板 | `backend/app/prompts/report_generation.py` | 短期/中期分层 | 1.5h |
| 4.2 | 增加实习建议 | 同上 | 实践安排小节 | 1h |
| 4.3 | KPI量化 | 同上 | 章节5指标定义 | 1h |
| 4.4 | 完整性检查细化 | `backend/app/services/report_generator.py` | 章节完整性验证 | 1h |

---

## 3. 核心代码示例

```typescript
// frontend/src/api/reports.ts
async function* generateReportStream(studentId: string, jobProfileId?: string) {
  const response = await fetch(
    `/api/reports/generate/stream?student_id=${studentId}&job_profile_id=${jobProfileId}`,
    { headers: { 'Accept': 'text/event-stream' } }
  );

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        yield data;
      }
    }
  }
}
```

---

## 4. Subagent分配

| Subagent | 负责任务 | 说明 |
|----------|---------|------|
| report-1 | 1.1~3.4 | 前端SSE对接 |
| report-2 | 4.1~4.4 | 报告内容细化 |

---

## 5. 验收标准

- SSE流式成功接收章节数据
- 报告页面真实显示生成进度
- 5章节报告内容完整
- 短期/中期计划有分层
- 实习/项目建议明确
- 评估指标有量化

---

## 6. 可并行项

- 步骤1.1~1.3可并行阅读
- 步骤2.1~2.3可并行开发
- 步骤4.1~4.4可并行更新prompt
