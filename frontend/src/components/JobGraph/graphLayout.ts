import * as d3 from "d3";
import type { GraphEdge, GraphNode } from "./types";

export type TreeNode = GraphNode & {
  children?: TreeNode[];
  x?: number;
  y?: number;
};

// Legacy tree helpers retained for compatibility with older imports.
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

export function getNodeRadius(): number {
  return 18;
}

export function truncateLabel(label: string, maxLength: number = 8): string {
  if (label.length <= maxLength) {
    return label;
  }
  return `${label.slice(0, maxLength - 1)}…`;
}
