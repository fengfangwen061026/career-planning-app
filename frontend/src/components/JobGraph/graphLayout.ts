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
  children?: TreeNode[];
  x?: number;
  y?: number;
}

export function buildTree(
  nodes: GraphNode[],
  edges: GraphEdge[]
): TreeNode | null {
  // Build adjacency list
  const childrenMap = new Map<string, TreeNode[]>();

  for (const edge of edges) {
    const source = edge.source;
    const target = edge.target;

    if (!childrenMap.has(source)) {
      childrenMap.set(source, []);
    }
    childrenMap.get(source)!.push(
      nodes.find((n) => n.id === target)!
    );
  }

  // Find root node
  const rootNode = nodes.find((n) => n.type === "root");
  if (!rootNode) return null;

  // Build tree recursively
  function buildNode(node: GraphNode): TreeNode {
    const children = childrenMap.get(node.id) || [];
    return {
      ...node,
      children: children.map(buildNode),
    };
  }

  return buildNode(rootNode);
}

export function radialPoint(x: number, y: number): [number, number] {
  return [Math.cos(x - Math.PI / 2) * y, Math.sin(x - Math.PI / 2) * y];
}

export function createTreeLayout(
  treeData: TreeNode,
  radius: number
): d3.HierarchyPointNode<TreeNode> {
  const tree = d3
    .tree<TreeNode>()
    .size([2 * Math.PI, radius])
    .separation((a, b) => (a.parent === b.parent ? 1.2 : 2.5) / a.depth);

  return d3.hierarchy(treeData) as d3.HierarchyPointNode<TreeNode>;
}

export function getNodeRadius(node: d3.HierarchyPointNode<TreeNode>): number {
  switch (node.data.type) {
    case "root":
      return 36;
    case "category":
      return 28;
    case "job":
      return 20;
    default:
      return 20;
  }
}

export function truncateLabel(label: string, maxLength: number = 4): string {
  if (label.length <= maxLength) return label;
  return label.slice(0, maxLength - 1) + "…";
}
