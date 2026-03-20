import type { FourDimensionScores, GapItem } from './matching';
import type { StudentProfileResponse, StudentResponse } from './student';

export interface StudentSessionRequest {
  email?: string;
  phone?: string;
  name?: string;
}

export interface StudentSessionResponse {
  student: StudentResponse;
  created: boolean;
  has_profile: boolean;
}

export interface JobSnapshot {
  title?: string;
  city?: string;
  company_name?: string;
  company_stage?: string;
  industries?: string[];
  benefits?: string[];
}

export interface StudentRecommendationItem {
  id: string;
  job_profile_id: string;
  role_id?: string;
  role_name?: string;
  role_category?: string;
  total_score: number;
  scores: FourDimensionScores;
  gaps: GapItem[];
  match_reasons: string[];
  job_snapshot?: JobSnapshot;
  created_at: string;
  updated_at: string;
}

export interface StudentRecommendationResponse {
  student_id: string;
  results: StudentRecommendationItem[];
}

export interface CareerPathResponse {
  student_id: string;
  job_profile_id: string;
  role_id?: string;
  role_name?: string;
  role_category?: string;
  path: Record<string, unknown>;
}

export interface ProfileCompletionQuestion {
  question_id: string;
  title: string;
  prompt: string;
  placeholder?: string;
  options: string[];
}

export interface ProfileCompletionSessionResponse {
  student_id: string;
  questions: ProfileCompletionQuestion[];
}

export interface ProfileCompletionAnswer {
  question_id: string;
  answer: string;
}

export interface ProfileCompletionApplyRequest {
  answers: ProfileCompletionAnswer[];
}

export interface ProfileCompletionApplyResponse {
  profile: StudentProfileResponse;
  applied_updates: string[];
}
