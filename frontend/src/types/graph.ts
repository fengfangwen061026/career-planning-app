// Legacy graph types (deprecated - replaced by D3-based JobGraph)

export type GraphEdgeType = 'vertical' | 'transition' | 'related';
export type GraphLayoutType = 'radial' | 'cose' | 'circle' | 'grid';

export interface RawGraphElement {
  data: Record<string, unknown>;
}

export interface RawGraphResponse {
  elements: RawGraphElement[];
}

export interface AdaptedGraphNode {
  id: string;
  label: string;
  fullLabel: string;
  nodeType?: string;
  level?: string;
  color: string;
  size: number;
  degree: number;
  rawData: Record<string, unknown>;
}

export interface AdaptedGraphEdge {
  id: string;
  source: string;
  target: string;
  edgeType: GraphEdgeType;
  weight?: number;
  rawData: Record<string, unknown>;
}

export interface GraphDataWarnings {
  invalidNodes: number;
  invalidEdges: number;
  duplicateEdges: number;
}

export interface AdaptedGraphData {
  nodes: AdaptedGraphNode[];
  edges: AdaptedGraphEdge[];
  elements: unknown[];
  stats: {
    nodeCount: number;
    edgeCount: number;
  };
  warnings: GraphDataWarnings;
}

export interface GraphViewMeta {
  mode: 'full' | 'local' | 'limited';
  startNodeId?: string;
  focusDepth: number;
  isLargeGraph: boolean;
  autoLimited: boolean;
  message?: string;
}

export interface AdaptedGraphView {
  nodes: AdaptedGraphNode[];
  edges: AdaptedGraphEdge[];
  elements: unknown[];
  stats: {
    nodeCount: number;
    edgeCount: number;
  };
  meta: GraphViewMeta;
}
