// Job types - aligned with backend/app/schemas/job.ts

// ============================================
// 新7类Schema类型定义 (V2)
// ============================================

export interface ProfileBasicRequirements {
  education: Record<string, number>;  // {"本科": 0.82, "大专": 0.12, "硕士": 0.06}
  experience: Record<string, number>;  // {"不限": 0.40, "1-3年": 0.35}
  majors: string[];
  languages: Array<{ name: string; frequency: number }>;
  cities: Array<{ name: string; count: number }>;
}

export interface ProfileTechnicalSkills {
  programming_languages: Array<{ name: string; frequency: number; weight: number; is_required: boolean }>;
  frameworks_and_libraries: Array<{ name: string; frequency: number; weight: number; is_required: boolean }>;
  tools_and_platforms: Array<{ name: string; frequency: number; weight: number; is_required: boolean }>;
  domain_skills: Array<{ name: string; frequency: number; weight: number; is_required: boolean }>;
  databases: Array<{ name: string; frequency: number; weight: number; is_required: boolean }>;
  methodologies: Array<{ name: string; frequency: number; weight: number; is_required: boolean }>;
}

export interface ProfileSoftSkill {
  name: string;
  frequency: number;
  weight: number;
  evidence?: string;
}

export interface ProfileCertificate {
  name: string;
  frequency: number;
  importance: 'required' | 'preferred';
}

export interface ProfileBenefit {
  name: string;
  frequency: number;
}

export interface ProfileMetadata {
  version: string;
  generated_at: string;
  noise_filtered_count: number;
  supplemented_skills_count: number;
}

// 新7类完整结构
export interface JobProfileV2 {
  role_name: string;
  total_jds_analyzed: number;
  basic_requirements: ProfileBasicRequirements;
  technical_skills: ProfileTechnicalSkills;
  soft_skills: ProfileSoftSkill[];
  certificates: ProfileCertificate[];
  job_responsibilities: string[];
  benefits: ProfileBenefit[];
  metadata: ProfileMetadata;
}

// ============================================
// 旧版Schema类型（兼容）
// ============================================

export interface JobBase {
  title: string;
  role: string;
  sub_role?: string;
  city: string;
  district?: string;
  salary_min?: number;
  salary_max?: number;
  salary_months: number;
  company_name: string;
  industries?: string[];
  company_size?: string;
  company_stage?: string;
  description?: string;
  skills?: string[];
  education_req?: string;
  experience_req?: string;
  company_intro?: string;
}

export interface JobCreate extends JobBase {
  job_code: string;
}

export interface JobUpdate {
  title?: string;
  role?: string;
  sub_role?: string;
  city?: string;
  district?: string;
  salary_min?: number;
  salary_max?: number;
  salary_months?: number;
  company_name?: string;
  industries?: string[];
  company_size?: string;
  company_stage?: string;
  description?: string;
  skills?: string[];
  education_req?: string;
  experience_req?: string;
  company_intro?: string;
  role_id?: string;
}

export interface JobResponse extends JobBase {
  id: string;
  job_code: string;
  role_id?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedJobResponse {
  items: JobResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface RoleBase {
  name: string;
  category: string;
  level?: string;
  description?: string;
}

export interface RoleCreate extends RoleBase {}

export interface RoleResponse extends RoleBase {
  id: string;
  job_count: number;
  created_at: string;
  updated_at: string;
}

export interface JobProfileBase {
  skills?: string[];
  experience_years?: Record<string, unknown>;
  education?: Record<string, unknown>[];
  competencies?: string[];
  career_path?: Record<string, unknown>[];
}

export interface JobProfileCreate extends JobProfileBase {
  job_id: string;
}

export interface JobProfileResponse {
  id: string;
  job_id?: string;
  role_id: string;
  profile_json: Record<string, unknown>;
  evidence_json?: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface JobProfileUpdate {
  profile_json: Record<string, unknown>;
}

export interface JobProfileGenerateResponse {
  role_id: string;
  role_name: string;
  version: number;
  profile: JobProfileResponse;
  stats?: Record<string, unknown>;
}

export interface JobProfileHistoryResponse {
  role_id: string;
  role_name: string;
  profiles: JobProfileResponse[];
}

export interface BatchGenerateResponse {
  total: number;
  succeeded: number;
  failed: number;
  results: JobProfileGenerateResponse[];
  errors: Record<string, unknown>[];
}

// ============================================
// Company 相关类型
// ============================================

export interface CompanyBase {
  name: string;
  industries?: string;
  company_size?: string;
  company_stage?: string;
  intro?: string;
}

export interface CompanyResponse extends CompanyBase {
  id: string;
  job_count: number;
  avg_salary_min?: number;
  avg_salary_max?: number;
  created_at: string;
  updated_at: string;
}

// Role 关联的公司项
export interface RoleCompanyItem extends CompanyResponse {
  job_count: number;  // 该公司在该 role 下的岗位数
  salary_range?: string;  // "8K-15K"
  cities: string[];  // 工作城市
}

// 薪资分布项
export interface SalaryDistributionItem {
  range: string;
  count: number;
}

// 城市分布项
export interface CityDistributionItem {
  city: string;
  count: number;
  avg_salary_min?: number;
  avg_salary_max?: number;
  top_companies: string[];
}

// 福利统计项
export interface BenefitItem {
  name: string;
  frequency: number;
}

// 分页响应
export interface PaginatedRoleCompaniesResponse {
  items: RoleCompanyItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// 公司简要信息（用于 JD 列表）
export interface CompanyBrief {
  id: string;
  name: string;
  industries?: string;  // 逗号分隔的字符串
  company_size?: string;
  company_stage?: string;
}

// 带公司信息的 JD（用于筛选功能）
export interface JobWithCompany {
  id: string;
  title: string;
  role: string;
  role_id?: string;
  city: string;
  district?: string;
  salary_min?: number;
  salary_max?: number;
  salary_months?: number;
  description?: string;
  published_at?: string;
  source_url?: string;
  company_id?: string;
  company?: CompanyBrief;
  company_name?: string;  // 原始公司名（当 company_id 为空时使用）
  benefits: string[];
}

// 筛选状态
export interface FilterState {
  salaryRange: string | null;
  city: string | null;
  benefits: string[];
}
