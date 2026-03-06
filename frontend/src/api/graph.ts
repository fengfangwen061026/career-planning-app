import client from './client';

export interface GraphNode {
  id: string;
  type: 'role' | 'level';
  label: string;
  data?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'vertical' | 'transition';
  weight?: number;
  data?: Record<string, unknown>;
}

export interface CareerPathStep {
  step: number;
  node: GraphNode;
  action_items: string[];
  transferable_skills?: string[];
  gap_skills?: string[];
  estimated_time?: string;
}

export interface CareerPath {
  path_id: string;
  path_type: 'primary' | 'alternative';
  steps: CareerPathStep[];
  total_estimated_time?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface CareerPathRequest {
  student_id: string;
  target_job_id: string;
}

export interface CareerPathResponse {
  student_id: string;
  target_job_id: string;
  paths: CareerPath[];
}

export const graphApi = {
  // Get graph nodes
  getNodes: (params?: { type?: string }) =>
    client.get<GraphNode[]>('/graph/nodes', { params }),

  // Get graph edges
  getEdges: (params?: { type?: string }) =>
    client.get<GraphEdge[]>('/graph/edges', { params }),

  // Get Cytoscape.js format
  getCytoscape: (params?: { edge_type?: string }) =>
    client.get<{ elements: Array<{ data: Record<string, unknown> }> }>('/graph/cytoscape', { params }),

  // Query path between two nodes
  queryPath: (data: { source_id: string; target_id: string }) =>
    client.post<Array<Record<string, unknown>>>('/graph/path', data),

  // Career path between roles
  getCareerPath: (data: { from_role: string; to_role: string; from_level?: string }) =>
    client.post<Array<Record<string, unknown>>>('/graph/career-path', data),

  // Student career path
  getStudentPath: (data: { student_profile: Record<string, unknown>; target_role: string; target_level?: string }) =>
    client.post<Record<string, unknown>>('/graph/student-path', data),

  // Build graph
  buildGraph: () =>
    client.post<{ vertical: Record<string, unknown>; transition: Record<string, unknown> }>('/graph/build'),
};
