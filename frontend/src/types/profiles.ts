// Student profile types - 与 backend/app/schemas/profiles.py 对应

// ── 简历解析结果 ─────────────────────────────────────────────────────

export type Degree = "大专" | "本科" | "硕士" | "博士";
export type SkillCategory = "编程语言" | "框架" | "工具" | "领域知识" | "软技能" | "其他";
export type Proficiency = "熟练" | "掌握" | "了解" | "入门";
export type AwardLevel = "国家级" | "省级" | "校级" | "其他";
export type SoftSkillDimension = "沟通能力" | "团队协作" | "抗压能力" | "创新能力" | "学习能力";
export type GapPriority = "高" | "中" | "低";

export interface EducationItem {
  school: string;
  degree: Degree;
  major: string;
  gpa: number | null;
  start_year: number | null;
  end_year: number | null;
  evidence: string;
}

export interface ExperienceItem {
  company: string;
  role: string;
  start_date: string | null;
  end_date: string | null;
  description: string;
  is_internship: boolean;
  evidence: string;
}

export interface ProjectItem {
  name: string;
  description: string;
  tech_stack: string[];
  role: string;
  outcome: string | null;
  evidence: string;
}

export interface SkillItem {
  name: string;
  category: SkillCategory;
  proficiency: Proficiency;
  evidence: string;
}

export interface CertificateItem {
  name: string;
  level: string | null;
  obtained_date: string | null;
  evidence: string;
}

export interface AwardItem {
  name: string;
  level: AwardLevel;
  date: string | null;
  evidence: string;
}

export interface ResumeParseResult {
  raw_text: string;
  education: EducationItem[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  skills: SkillItem[];
  certificates: CertificateItem[];
  awards: AwardItem[];
  self_intro: string | null;
  parse_confidence: number;
  missing_fields: string[];
}

// ── 学生画像 ───────────────────────────────────────────────────────

export interface NormalizedSkill {
  name: string;
  category: string;
  proficiency: string;
  source: string;
}

export interface SoftSkillEvidence {
  dimension: SoftSkillDimension;
  score: number;
  evidence: string;
}

export type EducationLevel = Degree;
export type StudentAwardLevel = "无" | "校级" | "省级" | "国家级";

export interface StudentProfile {
  student_id: number;
  completeness_score: number;
  competitiveness_score: number;
  education_level: EducationLevel;
  major: string;
  graduation_year: number | null;
  skills: NormalizedSkill[];
  experience_months: number;
  project_count: number;
  certificate_names: string[];
  award_level: StudentAwardLevel;
  soft_skills: SoftSkillEvidence[];
  missing_suggestions: string[];
  version: string;
  created_at: string | null;
  updated_at: string | null;
}

// ── 匹配结果 ───────────────────────────────────────────────────────

export interface GapItem {
  item: string;
  current: string;
  required: string;
  priority: GapPriority;
  suggestion: string;
}

export interface MatchingResult {
  student_id: number;
  role_id: number;
  total_score: number;
  basic_score: number;
  skill_score: number;
  quality_score: number;
  potential_score: number;
  weights: Record<string, number>;
  gap_items: GapItem[];
  matched_skills: string[];
  missing_skills: string[];
  bonus_skills: string[];
  evidence_summary: string;
  created_at: string | null;
}

// ── API 请求/响应 ─────────────────────────────────────────────────

export interface ResumeUploadRequest {
  student_id?: number;
}

export interface ResumeUploadResponse {
  resume_id: number;
  student_id: number;
  parse_result: ResumeParseResult;
  warnings: string[];
}

export interface ProfileGenerateRequest {
  resume_id: number;
}

export interface MatchingRequest {
  student_id: number;
  role_id: number;
}

export interface RecommendRequest {
  top_n: number;
}

export interface RecommendResponse {
  results: MatchingResult[];
  total: number;
}