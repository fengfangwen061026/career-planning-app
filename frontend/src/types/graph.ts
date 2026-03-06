// Graph types

export interface Node {
  id: string;
  label: string;
  type?: string;
  level?: number;
  x?: number;
  y?: number;
  data?: Record<string, unknown>;
}

export interface Edge {
  source: string;
  target: string;
  label?: string;
  weight?: number;
  type?: string;
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

export interface JobGraphNode extends Node {
  job_id?: string;
  job_title?: string;
  company?: string;
}

export interface CareerPathNode extends Node {
  student_id?: string;
  job_id?: string;
  stage?: string;
}
