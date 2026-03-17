export interface GraphTotals {
  role_count: number;
  jd_count: number;
  category_count: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "root" | "category" | "job";
  role_id?: string;
  color?: string;
  icon?: string;
  category?: string;
  count?: number;
  jd_count?: number;
  jd_total?: number;
  job_count?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface JobGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totals: GraphTotals;
  generated_at: string;
}

export interface JobStats {
  jd_count: number;
  salary_min: number | null;
  salary_max: number | null;
  top_cities: string[];
  top_skills: string[];
}

export interface JobNode extends GraphNode {
  type: "job";
  role_id: string;
  category: string;
  jd_count: number;
}

export interface CategoryNode extends GraphNode {
  type: "category";
  color: string;
  icon: string;
  count: number;
  jd_total: number;
  job_count: number;
}

export function isJobNode(node: GraphNode): node is JobNode {
  return node.type === "job";
}

export function isCategoryNode(node: GraphNode): node is CategoryNode {
  return node.type === "category";
}
