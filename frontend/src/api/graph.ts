import client from "./client";
import type { RawGraphResponse } from "../types/graph";

export interface GraphNode {
  id: string;
  node_type: string;
  name: string;
  level?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  edge_type: string;
  weight?: number;
  explanation?: Record<string, unknown>;
}

export const graphApi = {
  getNodes: (params?: { node_type?: string; level?: string; skip?: number; limit?: number }) =>
    client.get<GraphNode[]>("/graph/nodes", { params }),

  getEdges: (params?: { edge_type?: string; skip?: number; limit?: number }) =>
    client.get<GraphEdge[]>("/graph/edges", { params }),

  getNodeDetail: (nodeId: string) =>
    client.get<GraphNode>(`/graph/nodes/${nodeId}`),

  getCytoscape: (params?: { edge_type?: string }) =>
    client.get<RawGraphResponse>("/graph/cytoscape", { params }),

  queryPath: (data: { source_id: string; target_id: string }) =>
    client.post<Array<Record<string, unknown>>>("/graph/path", data),

  getCareerPath: (data: { from_role: string; to_role: string; from_level?: string }) =>
    client.post<Array<Record<string, unknown>>>("/graph/career-path", data),

  getStudentPath: (data: { student_profile: Record<string, unknown>; target_role: string; target_level?: string }) =>
    client.post<Record<string, unknown>>("/graph/student-path", data),

  buildGraph: () =>
    client.post<{ vertical: Record<string, unknown>; transition: Record<string, unknown> }>("/graph/build"),

  getMindmap: () =>
    client.get<{
      nodes: Array<{
        id: string;
        label: string;
        type: string;
        color?: string;
        icon?: string;
        category?: string;
        count?: number;
        jd_count?: number;
        jd_total?: number;
        job_count?: number;
      }>;
      edges: Array<{ source: string; target: string }>;
      totals: { role_count: number; jd_count: number; category_count: number };
      generated_at: string;
    }>("/graph/mindmap"),

  getJobStats: (role: string) =>
    client.get<{
      jd_count: number;
      salary_min: number | null;
      salary_max: number | null;
      top_cities: string[];
      top_skills: string[];
    }>("/graph/job-stats", { params: { role } }),

  rebuildMindmap: () =>
    client.post<{ status: string; rebuilt_at: string; node_count: number }>("/graph/mindmap/rebuild"),
};
