// Matching types - aligned with backend/app/schemas/matching.py

// Skill match detail
export interface SkillMatchItem {
  skill_name: string;
  importance: string; // required / preferred / bonus
  weight: number;
  matched: boolean;
  score: number; // 0-100
  semantic_similarity?: number;
  evidence: string;
  matched_by: string; // exact / semantic / none
}

// Competency item
export interface CompetencyItem {
  dimension: string;
  score: number; // 0-100
  evidence: string;
  confidence: number; // 0-1
}

// Potential item
export interface PotentialItem {
  dimension: string;
  score: number; // 0-100
  evidence: string;
  confidence: number; // 0-1
}

// Four dimension scores
export interface BasicScore {
  score: number;
  education_match: Record<string, unknown>;
  major_match: Record<string, unknown>;
  experience_match: Record<string, unknown>;
  hard_conditions: Record<string, unknown>[];
  penalties: Record<string, unknown>[];
}

export interface SkillScore {
  score: number;
  required_score: number;
  preferred_score: number;
  bonus_score: number;
  items: SkillMatchItem[];
}

export interface CompetencyScore {
  score: number;
  items: CompetencyItem[];
}

export interface PotentialScore {
  score: number;
  items: PotentialItem[];
}

export interface FourDimensionScores {
  basic: BasicScore;
  skill: SkillScore;
  competency: CompetencyScore;
  potential: PotentialScore;
  weights: Record<string, number>;
  total_score: number; // 0-100
}

// Gap analysis
export interface GapItem {
  gap_item: string;
  dimension: string; // basic / skill / competency / potential
  current_level: string;
  required_level: string;
  priority: string; // high / medium / low
  suggestion: string;
}

// API Request/Response
export interface MatchResultResponse {
  id: string;
  student_profile_id: string;
  job_profile_id: string;
  role_id?: string;
  role_category?: string;
  role_name?: string; // 岗位角色名称
  job_title?: string; // 岗位标题
  job_snapshot?: {
    title?: string;
    city?: string;
    company_name?: string;
    company_stage?: string;
    industries?: string[];
    benefits?: string[];
  };
  total_score: number; // 0-100
  scores: FourDimensionScores;
  gaps: GapItem[];
  match_reasons: string[];
  created_at: string;
  updated_at: string;
}

export interface MatchingRequest {
  student_id: string;
  job_profile_id: string;
}

export interface RecommendRequest {
  top_k: number;
  role_category?: string;
}

export interface MatchingResponse {
  student_id: string;
  results: MatchResultResponse[];
}
