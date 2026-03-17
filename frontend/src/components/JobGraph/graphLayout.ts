import * as d3 from "d3";
import type { GraphNode, GraphEdge } from "./types";

export interface TreeNode {
  id: string;
  label: string;
  type: "root" | "category" | "job";
  color?: string;
  icon?: string;
  category?: string;
  count?: number;
  jd_count?: number;
  jd_total?: number;
  job_count?: number;
  children?: TreeNode[];
  x?: number;
  y?: number;
}

export function buildTree(
  nodes: GraphNode[],
  edges: GraphEdge[]
): TreeNode | null {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const childrenMap = new Map<string, TreeNode[]>();

  for (const edge of edges) {
    const childNode = nodeMap.get(edge.target);
    if (!childNode) {
      continue;
    }

    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, []);
    }

    childrenMap.get(edge.source)!.push(childNode);
  }

  const rootNode = nodes.find((node) => node.type === "root");
  if (!rootNode) {
    return null;
  }

  function buildNode(node: GraphNode): TreeNode {
    const children = childrenMap.get(node.id) ?? [];
    return {
      ...node,
      children: children.map(buildNode),
    };
  }

  return buildNode(rootNode);
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

  return d3
    .tree<TreeNode>()
    .size([2 * Math.PI, radius])
    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(a.depth, 1))(
    hierarchy
  );
}

export function getNodeRadius(node: d3.HierarchyPointNode<TreeNode>): number {
  switch (node.data.type) {
    case "root":
      return 28;
    case "category":
      return 20;
    case "job":
      return 13;
    default:
      return 13;
  }
}

export function truncateLabel(label: string, maxLength: number = 4): string {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}...`;
}
