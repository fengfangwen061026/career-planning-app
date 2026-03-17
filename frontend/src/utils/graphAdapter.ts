// Legacy graph adapter (deprecated - replaced by D3-based JobGraph)
import type {
  AdaptedGraphData,
  AdaptedGraphEdge,
  AdaptedGraphNode,
  AdaptedGraphView,
  GraphEdgeType,
  GraphLayoutType,
  RawGraphElement,
  RawGraphResponse,
} from '../types/graph';

const DEFAULT_NODE_COLOR = '#9ca3af';
const LEVEL_COLOR_MAP: Record<string, string> = {
  entry: '#34d399',
  junior: '#34d399',
  growing: '#60a5fa',
  middle: '#60a5fa',
  mature: '#818cf8',
  senior: '#818cf8',
  expert: '#f59e0b',
  lead: '#f59e0b',
  manager: '#f97316',
};

const LEVEL_SCORE_MAP: Record<string, number> = {
  entry: 0.1,
  junior: 0.1,
  growing: 0.35,
  middle: 0.35,
  mature: 0.6,
  senior: 0.6,
  expert: 0.85,
  lead: 0.85,
  manager: 1,
};

const EDGE_TYPE_LABELS: Record<GraphEdgeType, string> = {
  vertical: '晋升路径',
  transition: '转岗路径',
  related: '关联关系',
};

const MIN_NODE_SIZE = 30;
const MAX_NODE_SIZE = 80;
const LABEL_LIMIT = 20;
// 超过该阈值即视为大图；初始展示与截取上限保持一致，避免逻辑分叉。
const LARGE_GRAPH_THRESHOLD = 100;
const LIMITED_NODE_COUNT = LARGE_GRAPH_THRESHOLD;

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function truncateGraphLabel(label: string, maxLength = LABEL_LIMIT): string {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function normalizeLevel(level?: string): string | undefined {
  if (!level) {
    return undefined;
  }

  const normalized = level.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized.includes('entry') || normalized.includes('初级')) {
    return 'entry';
  }
  if (normalized.includes('grow') || normalized.includes('middle') || normalized.includes('中级')) {
    return 'growing';
  }
  if (normalized.includes('mature') || normalized.includes('senior') || normalized.includes('高级')) {
    return 'mature';
  }
  if (
    normalized.includes('expert') ||
    normalized.includes('lead') ||
    normalized.includes('manager') ||
    normalized.includes('专家') ||
    normalized.includes('负责人')
  ) {
    return 'expert';
  }

  return normalized;
}

function getNodeColor(level?: string): string {
  const normalizedLevel = normalizeLevel(level);
  if (!normalizedLevel) {
    return DEFAULT_NODE_COLOR;
  }

  return LEVEL_COLOR_MAP[normalizedLevel] ?? DEFAULT_NODE_COLOR;
}

function normalizeEdgeType(value: unknown): GraphEdgeType {
  const normalized = asString(value)?.toLowerCase();
  if (normalized === 'vertical' || normalized === 'transition' || normalized === 'related') {
    return normalized;
  }
  return 'related';
}

function buildNodeSize(level: string | undefined, degree: number): number {
  const normalizedLevel = normalizeLevel(level);
  const levelScore = normalizedLevel ? (LEVEL_SCORE_MAP[normalizedLevel] ?? 0.2) : 0.2;
  const degreeScore = Math.min(degree, 10) / 10;
  const size = MIN_NODE_SIZE + levelScore * 22 + degreeScore * 28;

  return Math.max(MIN_NODE_SIZE, Math.min(MAX_NODE_SIZE, Math.round(size)));
}

export function adaptGraphResponse(response: RawGraphResponse): AdaptedGraphData {
  const nodeCandidates = new Map<string, RawGraphElement['data']>();
  const edgeCandidates: RawGraphElement['data'][] = [];
  let invalidNodes = 0;

  for (const element of response.elements ?? []) {
    const data = element?.data;
    if (!data || typeof data !== 'object') {
      invalidNodes += 1;
      continue;
    }

    const source = asString(data.source);
    const target = asString(data.target);

    if (source || target) {
      edgeCandidates.push(data);
      continue;
    }

    const id = asString(data.id);
    const label = asString(data.label) ?? asString(data.name);
    if (!id || !label) {
      invalidNodes += 1;
      continue;
    }

    nodeCandidates.set(id, data);
  }

  const degrees = new Map<string, number>();
  for (const id of nodeCandidates.keys()) {
    degrees.set(id, 0);
  }

  const validEdgeSet = new Set<string>();
  const adaptedEdges: AdaptedGraphEdge[] = [];
  let invalidEdges = 0;
  let duplicateEdges = 0;

  for (const rawEdge of edgeCandidates) {
    const source = asString(rawEdge.source);
    const target = asString(rawEdge.target);

    if (!source || !target || !nodeCandidates.has(source) || !nodeCandidates.has(target)) {
      invalidEdges += 1;
      continue;
    }

    const edgeType = normalizeEdgeType(rawEdge.edge_type ?? rawEdge.type);
    const dedupeKey = `${source}:${target}:${edgeType}`;
    if (validEdgeSet.has(dedupeKey)) {
      duplicateEdges += 1;
      continue;
    }
    validEdgeSet.add(dedupeKey);

    const id = asString(rawEdge.id) ?? dedupeKey;
    degrees.set(source, (degrees.get(source) ?? 0) + 1);
    degrees.set(target, (degrees.get(target) ?? 0) + 1);

    adaptedEdges.push({
      id,
      source,
      target,
      edgeType,
      weight: asNumber(rawEdge.weight),
      rawData: { ...rawEdge },
    });
  }

  const adaptedNodes: AdaptedGraphNode[] = Array.from(nodeCandidates.entries()).map(([id, rawNode]) => {
    const fullLabel = asString(rawNode.label) ?? asString(rawNode.name) ?? id;
    const level = normalizeLevel(asString(rawNode.level));
    const degree = degrees.get(id) ?? 0;

    return {
      id,
      label: truncateGraphLabel(fullLabel),
      fullLabel,
      nodeType: asString(rawNode.node_type) ?? asString(rawNode.type),
      level,
      color: getNodeColor(level),
      size: buildNodeSize(level, degree),
      degree,
      rawData: { ...rawNode },
    };
  });

  if (invalidNodes || invalidEdges || duplicateEdges) {
    console.warn('[graphAdapter] Filtered dirty graph data', {
      invalidNodes,
      invalidEdges,
      duplicateEdges,
    });
  }

  return {
    nodes: adaptedNodes,
    edges: adaptedEdges,
    elements: [],
    stats: {
      nodeCount: adaptedNodes.length,
      edgeCount: adaptedEdges.length,
    },
    warnings: {
      invalidNodes,
      invalidEdges,
      duplicateEdges,
    },
  };
}

export function getRecommendedLayout(nodeCount: number): GraphLayoutType {
  return nodeCount <= 100 ? 'cose' : 'grid';
}

export function buildGraphView(
  data: AdaptedGraphData,
  options: {
    startNodeId?: string;
    edgeTypeFilter?: GraphEdgeType;
    focusDepth?: number;
  },
): AdaptedGraphView {
  const { startNodeId, edgeTypeFilter, focusDepth = 1 } = options;
  const edges = data.edges.filter((edge) => !edgeTypeFilter || edge.edgeType === edgeTypeFilter);
  const nodeIds = new Set<string>();
  for (const edge of edges) {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }

  const nodes = edgeTypeFilter ? data.nodes.filter((node) => nodeIds.has(node.id)) : data.nodes;

  return {
    nodes,
    edges,
    elements: [],
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
    meta: {
      mode: 'full',
      focusDepth,
      isLargeGraph: false,
      autoLimited: false,
      message: edgeTypeFilter ? '已按边类型筛选图谱' : '当前展示完整图谱',
    },
  };
}

export function getEdgeTypeOptions(data: AdaptedGraphData): Array<{ label: string; value: GraphEdgeType }> {
  const edgeTypes = new Set<GraphEdgeType>(data.edges.map((edge) => edge.edgeType));

  return Array.from(edgeTypes).map((edgeType) => ({
    value: edgeType,
    label: EDGE_TYPE_LABELS[edgeType],
  }));
}

export function getLevelLegend(data: AdaptedGraphData): Array<{ key: string; label: string; color: string }> {
  const levels = new Map<string, string>();

  for (const node of data.nodes) {
    const key = node.level ?? 'unknown';
    if (!levels.has(key)) {
      levels.set(key, node.color);
    }
  }

  return Array.from(levels.entries()).map(([key, color]) => ({
    key,
    label: key === 'unknown' ? '未知职级' : key,
    color,
  }));
}
