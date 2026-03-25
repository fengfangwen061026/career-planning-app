# 管理端功能执行方案

> **模块**：管理端学生列表页 + 移动端手动录入
> **辩论结论**：方案C - 两功能并行开发
> **辩论者**：debater-d1/d2/d3/d4

---

## 1. 推荐方案

**方案C - 学生列表页+手动录入并行开发**

### 方案对比

| 维度 | 方案A(列表优先) | 方案B(手动录入) | 方案C(并行)✓ | 方案D(设置页) |
|------|---------------|---------------|-------------|--------------|
| 优先级 | P1 | P1 | P1 | P1 |
| 工作量 | 中 | 中 | 中×2 | 小 |
| 完成度 | 1个功能 | 1个功能 | 2个功能 | 1个功能 |
| 效率 | 一般 | 一般 | 最高 | 一般 |

### 投票结果
- d1→C, d2→C, d3→C, d4→C
- **结论：方案C胜出（全票）**

---

## 2. 详细执行步骤

### 功能一：管理端学生列表页

| 步骤 | 内容 | 文件 | 实现 | 工时 |
|------|------|------|------|------|
| 1.1 | 阅读现有StudentProfile | `frontend/src/pages/StudentProfile.tsx` | 了解详情页结构 | 0.5h |
| 1.2 | 阅读后端API | `backend/app/api/students.py` | GET /students列表API | 0.5h |
| 1.3 | 新建列表页组件 | `frontend/src/pages/StudentManagement.tsx` | 表格+搜索+筛选 | 3h |
| 1.4 | 添加路由 | `frontend/src/routes/index.tsx` | /students路由 | 0.5h |
| 1.5 | 集成到侧边栏 | `frontend/src/components/Layout.tsx` | 菜单项 | 0.5h |
| 1.6 | 测试列表功能 | - | 分页+搜索验证 | 1h |

### 功能二：移动端手动录入

| 步骤 | 内容 | 文件 | 实现 | 工时 | 可并行 |
|------|------|------|------|------|--------|
| 2.1 | 阅读后端manual API | `backend/app/api/students.py` | POST manual endpoint | 0.5h | |
| 2.2 | 新建表单页面 | `frontend/mobile/src/pages/ManualEntryPage.tsx` | 完整表单 | 4h | ✅ |
| 2.3 | 表单字段设计 | 同上 | 基本信息/教育/技能/项目等 | - | ✅ |
| 2.4 | API调用封装 | `frontend/src/api/students.ts` | manual profile调用 | 0.5h | |
| 2.5 | 添加路由 | `frontend/mobile/src/App.tsx` | /manual-entry路由 | 0.5h | |
| 2.6 | 激活跳转链接 | `frontend/mobile/src/pages/UploadPage.tsx` | .upload-manual-link | 0.5h | |
| 2.7 | 测试完整流程 | - | 表单提交+画像更新 | 1h | |

---

## 3. 表单字段设计

```typescript
// ManualEntryPage 表单结构
interface ManualProfileForm {
  // 基本信息
  name: string;
  school: string;
  major: string;
  degree: string;
  contact: string;

  // 教育经历（可增删）
  education: {
    school: string;
    major: string;
    degree: string;
    startDate: string;
    endDate: string;
  }[];

  // 技能（可增删）
  skills: {
    name: string;
    proficiency: 'beginner' | 'intermediate' | 'advanced';
  }[];

  // 项目经验（可增删）
  projects: {
    name: string;
    role: string;
    description: string;
    startDate: string;
    endDate: string;
  }[];

  // 实习经历（可增删）
  internships: {
    company: string;
    position: string;
    description: string;
    startDate: string;
    endDate: string;
  }[];

  // 证书/奖项
  certificates: string[];

  // 求职意向
  jobIntentions: {
    targetPosition: string;
    targetCity: string;
    salaryExpectation: string;
  };
}
```

---

## 4. Subagent分配

| Subagent | 负责任务 | 说明 |
|----------|---------|------|
| admin-1 | 1.1~1.6 | 管理端学生列表页 |
| admin-2 | 2.1~2.7 | 移动端手动录入 |

---

## 5. 验收标准

### 管理端学生列表页
- 列表显示所有学生（姓名、学校、评分）
- 支持分页（每页10条）
- 支持搜索（按姓名/学校）
- 点击进入详情页

### 移动端手动录入
- 表单完整填写并提交
- 画像自动更新完整度评分
- 支持教育/技能/项目/实习的增删
- 跳转链接从UploadPage可见

---

## 6. 可并行项

- 功能一和功能二完全并行（不同文件、不同路由）
- 功能二内部2.2~2.3可并行开发表单结构
