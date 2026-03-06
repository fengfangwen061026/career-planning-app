// Job types - aligned with backend/app/schemas/job.ts

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
