export interface GraphTotals {
  role_count: number;
  jd_count: number;
  community_count: number;
  edge_count: number;
}

export interface GraphMeta {
  generated_at: string;
  edge_policy: string;
  transition_edge_count: number;
  vertical_edge_count: number;
}

export interface GraphCommunity {
  community_id: string;
  label: string;
  color: string;
  node_ids: string[];
  node_count: number;
  jd_total: number;
}

export interface JobNode {
  id: string;
  type: "job";
  role_id: string;
  profile_id: string;
  label: string;
  summary: string;
  color: string;
  community_id: string;
  community_color: string;
  community_size: number;
  job_count: number;
  profile_version: number;
  level: string;
  heat: number;
  skills: string[];
  top_skills: string[];
  soft_scores: Record<string, number>;
  education: number;
  experience_min: number;
  maturity_score: number;
}

export type GraphNode = JobNode;

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  edge_type: "transition" | "vertical";
  weight: number;
  strength_level: "high" | "medium" | "low";
  directional: boolean;
  skill_overlap: number;
  shared_skills: string[];
  gap_skills: string[];
  reasons: string[];
}

export interface JobGraphData {
  nodes: JobNode[];
  edges: GraphEdge[];
  communities: GraphCommunity[];
  totals: GraphTotals;
  meta: GraphMeta;
  generated_at: string;
}

export interface JobStats {
  jd_count: number;
  salary_min: number | null;
  salary_max: number | null;
  top_cities: string[];
  top_skills: string[];
}

export interface RoleRelation {
  node: JobNode;
  edge: GraphEdge;
  direction: "outgoing" | "incoming";
}
