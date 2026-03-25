# CareerAI 代码改进方案

> **文档用途**：汇总代码评审发现 + 辩论结论，输出可执行改进方案
> **版本**：v1.0 · 2026-03-24
> **评审来源**：后端Explore Agent + 前端Explore Agent + 5组辩论结论

---

## 一、P1紧急修复（影响安全/数据正确性）

### 1.1 学生查询LIKE注入 [辩论组A结论: 方案A - 精确匹配]

| 项目 | 内容 |
|------|------|
| 文件 | `backend/app/services/resume_parser.py:320-334, 386-389` |
| 问题 | `Student.email.like(f"%{student_id}%")` 导致错误匹配 |
| 修复 | 使用精确匹配 `Student.id == student_id` 或UUID精确匹配 |

**代码改动:**
```python
# 错误写法
student = db.query(Student).filter(Student.email.like(f"%{student_id}%")).first()

# 正确写法
if isinstance(student_id, uuid.UUID):
    student = db.query(Student).filter(Student.id == student_id).first()
else:
    student = db.query(Student).filter(Student.email == student_id).first()
```

---

### 1.2 文件上传路径穿越 [辩论组A结论: 方案A - UUID验证]

| 项目 | 内容 |
|------|------|
| 文件 | `backend/app/api/students.py:153-158` |
| 问题 | student_id未验证，可能含`../`路径穿越 |
| 修复 | 对student_id严格验证为有效UUID格式 |

**代码改动:**
```python
import uuid as uuid_module
def validate_student_id(student_id: str) -> uuid_module.UUID:
    try:
        return uuid_module.UUID(student_id)
    except ValueError:
        raise ValueError(f"Invalid student_id format: {student_id}")

upload_dir = settings.upload_dir / str(validate_student_id(student_id))
```

---

### 1.3 HTML导出XSS风险 [辩论组A结论: 方案A - HTML转义]

| 项目 | 内容 |
|------|------|
| 文件 | `backend/app/services/report.py:1031-1040, 1072-1074` |
| 问题 | 用户输入直接插入HTML未转义 |
| 修复 | 使用`html.escape()`转义所有用户输入 |

**代码改动:**
```python
import html

def escape_html_content(content: str) -> str:
    """Escape HTML special characters to prevent XSS."""
    return html.escape(content, quote=True)

# 使用
f"<h3>{escape_html_content(section.get('title', ''))}</h3>"
f"<p>{escape_html_content(section.get('content', ''))}</p>"
```

---

### 1.4 报告生成使用假数据 [辩论组B结论: 方案A - 调用真实匹配服务]

| 项目 | 内容 |
|------|------|
| 文件 | `backend/app/api/reports.py:149-159` |
| 问题 | `matching_result`硬编码`total_score: 75` |
| 修复 | 调用实际`matching_service.match_student_job()` |

**代码改动:**
```python
# 错误写法
matching_result = {"total_score": 75, ...}

# 正确写法
from app.services.matching import matching_service

matching_result = await matching_service.match_student_job(
    db=db,
    student_id=student_id,
    job_profile_id=job_profile_id
)
```

---

## 二、P1重要修复（影响功能完整性）

### 2.1 图路径搜索全量加载边 [辩论组B结论: 方案A - 限制范围查询]

| 项目 | 内容 |
|------|------|
| 文件 | `backend/app/services/graph.py:591-609` |
| 问题 | `find_path_dijkstra`加载所有边到内存 |
| 修复 | 使用起始节点邻接边查询 |

**代码改动:**
```python
# 错误写法
result = await db.execute(select(GraphEdge))  # 全量加载

# 正确写法
from sqlalchemy import select, or_
start_node = await db.execute(
    select(GraphNode).where(GraphNode.id == start_node_id)
)
# 只加载起点相关的边
result = await db.execute(
    select(GraphEdge).where(
        or_(
            GraphEdge.source_id == start_node_id,
            GraphEdge.target_id == start_node_id
        )
    )
)
```

---

### 2.2 useEffect依赖数组不完整 [辩论组C结论: 方案A - useCallback]

| 项目 | 内容 |
|------|------|
| 文件 | `frontend/src/routes/StudentProfile.tsx:102-104` |
| 问题 | `useEffect`依赖数组为空，闭包问题 |
| 修复 | 使用`useCallback`包装fetch函数 |

**代码改动:**
```typescript
// 错误写法
useEffect(() => {
  fetchStudents();
}, []);

// 正确写法
const fetchStudents = useCallback(async () => {
  try {
    const res = await studentsApi.getStudents();
    setStudents(res.data);
  } catch (error) {
    message.error('获取学生列表失败');
  }
}, []);

useEffect(() => {
  fetchStudents();
}, [fetchStudents]);
```

---

### 2.3 组件过于庞大 [辩论组C结论: 方案A - 拆分组件]

| 文件 | 当前行数 | 建议 |
|------|---------|------|
| `frontend/src/routes/ResumeUpload.tsx` | 1198行 | 拆分为UploadForm/UploadProgress/StudentSelect |
| `frontend/src/routes/Report.tsx` | 997行 | 拆分为ReportViewer/ChapterList/ExportButton |
| `frontend/src/routes/Matching.tsx` | 997行 | 拆分为MatchList/MatchDetail/RadarChart |
| `frontend/src/routes/StudentProfile.tsx` | 623行 | 拆分为ProfileHeader/SkillSection/ProjectList |

**拆分示例 - Report.tsx:**
```
frontend/src/routes/Report.tsx (保留路由和状态管理)
  ├── components/ReportViewer.tsx (报告内容展示)
  ├── components/ChapterList.tsx (章节列表)
  └── components/ExportPanel.tsx (导出面板)
```

---

### 2.4 流式返回后数据库保存失败 [辩论组B结论: 方案A - 预创建记录]

| 项目 | 内容 |
|------|------|
| 文件 | `backend/app/services/report_generator.py:101-113` |
| 问题 | 流式返回完成后才保存DB，失败时状态不一致 |
| 修复 | 流开始前创建记录，状态为generating |

**代码改动:**
```python
# 先创建记录
report = CareerReport(
    student_id=student_id,
    status="generating",
    ...
)
db.add(report)
await db.flush()  # 获取report.id

# 流式生成
yield f"data: {json.dumps({'status': 'all_done', 'report_id': str(report.id)})}\n\n"

# 最后更新状态
report.status = "completed"
await db.commit()
```

---

## 三、P2建议修复（影响代码质量）

### 3.1 前端类型安全

| 问题 | 文件 | 修复方案 |
|------|------|---------|
| 大量`as any` | JobProfileDetail.tsx:619,680 | 定义`JobProfileJson`接口 |
| 类型过于宽泛 | student.ts:118 | 扩展`ProfileJson`接口 |
| Graph返回类型 | graph.ts:35-45 | 定义`CareerPathStep`等具体接口 |

**类型定义示例:**
```typescript
// frontend/src/types/job.ts
interface JobProfileJson {
  skills: Skill[];
  certificates: string[];
  soft_competencies: Record<string, { value: number; evidence: string }>;
 实习能力: Record<string, { value: number; evidence: string }>;
}
```

---

### 3.2 组件重复定义

| 组件 | 重复位置 | 修复 |
|------|---------|------|
| GlassCard | 4个routes文件 | 提取到`components/GlassCard.tsx` |
| ResumeUpload | routes vs pages | 统一routes版本，删除pages版本 |

**提取GlassCard:**
```typescript
// frontend/src/components/GlassCard.tsx
export const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn(styles.glassCard, className)}>{children}</div>
);
```

---

### 3.3 错误处理不完整

| 文件 | 问题 | 修复 |
|------|------|------|
| Dashboard.tsx:97 | `.catch(console.error)` | `message.error('加载失败')` |
| StudentProfile.tsx:126 | catch只记录 | `message.error('获取数据失败')` |
| MobileAppContext.tsx:423 | `.catch(() => {})` | 展示错误给用户 |

---

### 3.4 Cheap Fallback未被调用 [辩论组E结论: 方案A]

| 项目 | 内容 |
|------|------|
| 文件 | `backend/app/services/resume_parser.py:206-226` |
| 问题 | 语义失败时只重试，不调用fallback |
| 修复 | 超过重试次数后调用`_cheap_resume_fallback()` |

**代码改动:**
```python
for attempt in range(1, 3):
    data = await llm.generate_json(...)
    if _is_parse_result_substantial(result):
        return result
    logger.warning("...retrying")

# 超过重试次数，调用fallback
if attempt >= 2:
    return await _cheap_resume_fallback(raw_text)
```

---

### 3.5 图谱构建事务问题 [辩论组E结论: 方案A]

| 项目 | 内容 |
|------|------|
| 文件 | `backend/app/services/graph.py:253-258` |
| 问题 | 中间`await db.commit()`破坏事务原子性 |
| 修复 | 移除中间commit，整个构建流程统一事务 |

---

## 四、执行计划

### Phase 1: P1紧急修复（可并行）

| 任务 | 文件 | 工时 | 可并行 |
|------|------|------|--------|
| 修复LIKE注入 | resume_parser.py | 1h | ✅ |
| 修复路径穿越 | students.py | 0.5h | ✅ |
| 修复XSS | report.py | 1h | ✅ |
| 修复假匹配数据 | reports.py | 2h | ✅ |
| 修复图路径加载 | graph.py | 2h | ✅ |
| 修复useEffect | StudentProfile.tsx | 0.5h | ✅ |

### Phase 2: P1重要修复

| 任务 | 文件 | 工时 |
|------|------|------|
| 拆分庞大组件 | Report.tsx等 | 6h |
| 修复流式DB保存 | report_generator.py | 1h |
| 创建dashboardApi | Dashboard.tsx | 1h |
| 统一ResumeUpload | - | 1h |

### Phase 3: P2建议修复

| 任务 | 工时 |
|------|------|
| 完善类型定义 | 4h |
| 提取GlassCard组件 | 1h |
| 完善错误处理 | 2h |
| 修复Cheap Fallback | 1h |
| 修复事务问题 | 1h |

---

## 五、可并行任务清单

| 任务组 | 可并行项 |
|--------|---------|
| P1安全修复 | LIKE注入 + 路径穿越 + XSS + 假数据 + 图路径 |
| P1前端修复 | useEffect + DashboardApi |
| P2组件 | GlassCard提取 + ResumeUpload统一 |
| P2类型 | 类型定义 + 错误处理 |
