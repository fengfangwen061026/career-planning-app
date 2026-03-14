export interface CategoryMeta {
  jobs: string[];
  color: string;
  icon: string;
}

export const JOB_CATEGORIES: Record<string, CategoryMeta> = {
  "技术研发": {
    jobs: [
      "Java",
      "C/C++",
      "前端开发",
      "测试工程师",
      "软件测试",
      "硬件测试",
      "实施工程师",
      "技术支持工程师",
      "科研人员",
      "风电工程师",
    ],
    color: "#6366f1",
    icon: "⚙️",
  },
  "销售商务": {
    jobs: [
      "销售运营",
      "网络销售",
      "BD经理",
      "销售工程师",
      "大客户代表",
      "电话销售",
      "广告销售",
      "销售助理",
      "商务专员",
    ],
    color: "#f59e0b",
    icon: "💼",
  },
  "运营推广": {
    jobs: [
      "运营助理/专员",
      "售后客服",
      "网络客服",
      "社区运营",
      "游戏运营",
      "游戏推广",
      "电话客服",
      "内容审核",
      "APP推广",
    ],
    color: "#10b981",
    icon: "📢",
  },
  "管理行政": {
    jobs: [
      "总助/CEO助理/董事长助理",
      "招聘专员/助理",
      "储备经理人",
      "管培生/储备干部",
      "储备干部",
      "项目专员/助理",
      "项目经理/主管",
      "资料管理",
      "档案管理",
    ],
    color: "#3b82f6",
    icon: "🏢",
  },
  "法律咨询": {
    jobs: [
      "律师助理",
      "律师",
      "法务专员/助理",
      "咨询顾问",
      "知识产权/专利代理",
      "猎头顾问",
    ],
    color: "#8b5cf6",
    icon: "⚖️",
  },
  "质量检测": {
    jobs: ["质检员", "质量管理/测试"],
    color: "#ef4444",
    icon: "🔍",
  },
  "专业服务": {
    jobs: ["统计员", "英语翻译", "日语翻译", "培训师", "项目招投标", "产品专员/助理"],
    color: "#06b6d4",
    icon: "🎯",
  },
};

export function getJobCategory(jobName: string): string | undefined {
  for (const [category, meta] of Object.entries(JOB_CATEGORIES)) {
    if (meta.jobs.includes(jobName)) {
      return category;
    }
  }
  return undefined;
}
