export interface GraphNode {
  id: string;
  label: string;
  type: "root" | "category" | "job";
  color?: string;
  icon?: string;
  category?: string;
  count?: number;
  jd_count?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface JobGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  generated_at: string;
}

export interface JobNode extends GraphNode {
  type: "job";
  category: string;
  jd_count: number;
}

export interface CategoryNode extends GraphNode {
  type: "category";
  color: string;
  icon: string;
  count: number;
}

export function isJobNode(node: GraphNode): node is JobNode {
  return node.type === "job";
}

export function isCategoryNode(node: GraphNode): node is CategoryNode {
  return node.type === "category";
}
