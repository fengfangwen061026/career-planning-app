import * as d3 from "d3";
import type { GraphEdge, GraphNode, JobNode } from "./types";

export type TreeNode = GraphNode & {
  children?: TreeNode[];
  x?: number;
  y?: number;
};

export interface GraphBand {
  key: string;
  label: string;
  y: number;
}

export interface LayoutNode extends d3.SimulationNodeDatum, JobNode {
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  fx?: number | null;
  fy?: number | null;
}

export interface LayoutEdge
  extends d3.SimulationLinkDatum<LayoutNode>,
    Omit<GraphEdge, "source" | "target"> {
  source: string | LayoutNode;
  target: string | LayoutNode;
}

const LEVEL_ORDER = ["entry", "growing", "stable", "mature", "expert", "unknown"];

const LEVEL_LABELS: Record<string, string> = {
  entry: "入门层",
  growing: "成长层",
  stable: "稳定层",
  mature: "成熟层",
  expert: "进阶层",
  unknown: "探索层",
};

function levelRank(level: string): number {
  const index = LEVEL_ORDER.indexOf(level);
  return index >= 0 ? index : LEVEL_ORDER.length;
}

function levelLabel(level: string): string {
  return LEVEL_LABELS[level] ?? LEVEL_LABELS.unknown;
}

export function buildLevelBands(nodes: JobNode[], width: number, height: number): GraphBand[] {
  const levels = Array.from(new Set(nodes.map((node) => node.level || "unknown")));
  const sortedLevels = levels.sort((a, b) => levelRank(a) - levelRank(b));
  const top = 96;
  const bottom = Math.max(top + 1, height - 72);
  const gap = sortedLevels.length > 1 ? (bottom - top) / (sortedLevels.length - 1) : 0;

  return sortedLevels.map((level, index) => ({
    key: level,
    label: levelLabel(level),
    y: sortedLevels.length === 1 ? height / 2 : top + gap * index,
  }));
}

export function buildLayeredGraph(
  nodes: JobNode[],
  edges: GraphEdge[],
  width: number,
  height: number
): { nodes: LayoutNode[]; edges: LayoutEdge[]; bands: GraphBand[] } {
  const bands = buildLevelBands(nodes, width, height);
  const bandMap = new Map(bands.map((band) => [band.key, band]));
  const grouped = new Map<string, JobNode[]>();

  nodes
    .slice()
    .sort((a, b) => {
      if (a.level !== b.level) {
        return levelRank(a.level) - levelRank(b.level);
      }
      return b.heat - a.heat;
    })
    .forEach((node) => {
      const key = node.level || "unknown";
      grouped.set(key, [...(grouped.get(key) || []), node]);
    });

  const layoutNodes: LayoutNode[] = [];

  bands.forEach((band) => {
    const bandNodes = grouped.get(band.key) || [];
    const left = 112;
    const right = Math.max(left + 1, width - 80);
    const gap = bandNodes.length > 1 ? (right - left) / (bandNodes.length - 1) : 0;

    bandNodes.forEach((node, index) => {
      const anchorX = bandNodes.length === 1 ? width / 2 : left + gap * index;
      const offsetY = ((index % 2) - 0.5) * 22;
      layoutNodes.push({
        ...node,
        x: anchorX,
        y: band.y + offsetY,
        anchorX,
        anchorY: band.y,
        vx: 0,
        vy: 0,
      });
    });
  });

  const nodeIds = new Set(layoutNodes.map((node) => node.id));
  const layoutEdges: LayoutEdge[] = edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({
      ...edge,
      source: edge.source,
      target: edge.target,
    }));

  return { nodes: layoutNodes, edges: layoutEdges, bands };
}

export function createLayeredSimulation(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  width: number,
  height: number
): d3.Simulation<LayoutNode, LayoutEdge> {
  return d3
    .forceSimulation<LayoutNode>(nodes)
    .force("center", d3.forceCenter(width / 2, height / 2).strength(0.04))
    .force("charge", d3.forceManyBody<LayoutNode>().strength((node) => (node.heat >= 400 ? -260 : -180)))
    .force(
      "collide",
      d3.forceCollide<LayoutNode>().radius((node) => (node.heat >= 250 ? 78 : 68)).strength(0.95)
    )
    .force(
      "link",
      d3
        .forceLink<LayoutNode, LayoutEdge>(edges)
        .id((node) => node.id)
        .distance((edge) => (edge.edge_type === "vertical" ? 110 : 145))
        .strength((edge) => (edge.edge_type === "vertical" ? 0.28 : 0.16))
    )
    .force("x", d3.forceX<LayoutNode>((node) => node.anchorX).strength(0.38))
    .force("y", d3.forceY<LayoutNode>((node) => node.anchorY).strength(0.52))
    .alphaDecay(0.032)
    .velocityDecay(0.4);
}

export function buildTree(_nodes: GraphNode[], _edges: GraphEdge[]): TreeNode | null {
  return null;
}

export function radialPoint(angle: number, radius: number): [number, number] {
  return [
    Math.cos(angle - Math.PI / 2) * radius,
    Math.sin(angle - Math.PI / 2) * radius,
  ];
}

export function createTreeLayout(
  treeData: TreeNode,
  radius: number
): d3.HierarchyPointNode<TreeNode> {
  const hierarchy = d3.hierarchy(treeData);
  return d3.tree<TreeNode>().size([2 * Math.PI, radius])(hierarchy);
}

export function getNodeRadius(type: string = "job"): number {
  return type === "job" ? 18 : 24;
}

export function truncateLabel(label: string, maxLength: number = 10): string {
  if (label.length <= maxLength) {
    return label;
  }
  return `${label.slice(0, maxLength - 1)}…`;
}
