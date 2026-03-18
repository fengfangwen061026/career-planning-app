// Student types - aligned with backend/app/schemas/student.py

// Profile JSON structure
export interface ProfileBasicInfo {
  name?: string;
  email?: string;
  phone?: string;
  school?: string;
  degree?: string;
  major?: string;
}

export interface ProfileSkill {
  name: string;
  category: string;
  level?: string;
}

export interface ProfileExperience {
  type: 'project' | 'internship';
  title: string;
  company?: string;
  duration?: string;
  description?: string;
}

export interface ProfileEducation {
  school: string;
  degree: string;
  major?: string;
  duration?: string;
}

export interface ProfileCertificate {
  name: string;
  issuer: string;
  date?: string;
}

export interface ProfileAward {
  name: string;
  level?: string;
  date?: string;
  evidence?: string;
}

export interface ProfileJson {
  competitiveness_score?: number;
  experience_months?: number;
  basic_info?: ProfileBasicInfo;
  skills?: ProfileSkill[];
  experiences?: ProfileExperience[];
  certificate_names?: string[];
  education?: ProfileEducation[];
  certificates?: ProfileCertificate[];
  awards?: ProfileAward[];
  soft_skills?: Array<{
    dimension: string;
    score: number;
    evidence?: string;
  }> | Record<string, number>;
}

export interface StudentBase {
  email: string;
  name?: string;
  phone?: string;
}

export interface StudentCreate extends StudentBase {
  // nothing extra
}

export interface StudentUpdate {
  name?: string;
  phone?: string;
}

export interface StudentResponse extends StudentBase {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface ResumeBase {
  filename?: string;
  file_type?: string;
  is_primary: boolean;
}

export interface ResumeCreate extends ResumeBase {
  student_id: string;
  file_path?: string;
}

export interface ResumeUpdate {
  filename?: string;
  is_primary?: boolean;
}

export interface ResumeResponse extends ResumeBase {
  id: string;
  student_id: string;
  file_path?: string;
  raw_text?: string;
  parsed_data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StudentProfileUpdate {
  profile_json?: Record<string, unknown>;
}

export interface StudentProfileResponse {
  id: string;
  student_id: string;
  profile_json: ProfileJson;
  completeness_score: number;
  evidence_json?: Record<string, unknown>;
  version: string;
  missing_suggestions?: string[];
  created_at: string;
  updated_at: string;
}

export interface ResumeUploadResponse {
  resume: ResumeResponse;
  parsed_data: Record<string, unknown>;
  completeness_score: number;
  missing_suggestions: string[];
  normalization_log: Array<{ original: string; normalized: string }>;
  parse_meta?: {
    status?: string;
    is_fallback?: boolean;
    retrying?: boolean;
  };
}

// Student Profile types
export interface StudentProfileBase {
  skills?: string[];
  experience?: Record<string, unknown>[];
  education?: Record<string, unknown>[];
  projects?: Record<string, unknown>[];
  interests?: string[];
  goals?: string[];
}

export interface StudentProfileCreate extends StudentProfileBase {
  student_id: string;
}
