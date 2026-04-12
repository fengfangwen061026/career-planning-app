import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { GraphCommunity, GraphEdge, JobNode } from "./types";
import {
  buildLayeredGraph,
  createLayeredSimulation,
  truncateLabel,
  type LayoutEdge,
  type LayoutNode,
} from "./graphLayout";
import { graphStyles } from "./graphStyles";

interface UseD3GraphOptions {
  nodes: JobNode[];
  edges: GraphEdge[];
  communities: GraphCommunity[];
  width: number;
  height: number;
  searchQuery: string;
  selectedJobId?: string;
  onJobSelect?: (job: JobNode | null) => void;
}

export function useD3Graph({
  nodes,
  edges,
  communities,
  width,
  height,
  searchQuery,
  selectedJobId,
  onJobSelect,
}: UseD3GraphOptions) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void communities;

    if (!svgRef.current || !containerRef.current || nodes.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.style("font-family", graphStyles.fontFamily);

    const root = svg.append("g");
    const bandLayer = root.append("g").attr("class", "band-layer");
    const edgeLayer = root.append("g").attr("class", "edge-layer");
    const nodeLayer = root.append("g").attr("class", "node-layer");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.45, 2.8])
      .on("zoom", (event) => {
        root.attr("transform", event.transform.toString());
      });

    svg.call(zoom);
    svg.on("dblclick.zoom", null);
    svg.on("dblclick.reset", () => {
      svg.transition().duration(260).call(zoom.transform, d3.zoomIdentity);
    });
    svg.on("click.clear-selection", () => onJobSelect?.(null));

    const { nodes: layoutNodes, edges: layoutEdges, bands } = buildLayeredGraph(
      nodes,
      edges,
      width,
      height
    );
    const nodeById = new Map(layoutNodes.map((node) => [node.id, node]));

    const selectedEdgeIds = new Set(
      selectedJobId
        ? layoutEdges
            .filter((edge) => {
              const sourceId = typeof edge.source === "string" ? edge.source : edge.source.id;
              const targetId = typeof edge.target === "string" ? edge.target : edge.target.id;
              return sourceId === selectedJobId || targetId === selectedJobId;
            })
            .map((edge) => edge.id)
        : []
    );

    const connectedNodeIds = new Set<string>();
    if (selectedJobId) {
      connectedNodeIds.add(selectedJobId);
      layoutEdges.forEach((edge) => {
        const sourceId = typeof edge.source === "string" ? edge.source : edge.source.id;
        const targetId = typeof edge.target === "string" ? edge.target : edge.target.id;
        if (sourceId === selectedJobId || targetId === selectedJobId) {
          connectedNodeIds.add(sourceId);
          connectedNodeIds.add(targetId);
        }
      });
    }

    const searchLower = searchQuery.trim().toLowerCase();

    bandLayer
      .selectAll("line.band-line")
      .data(bands)
      .join("line")
      .attr("class", "band-line")
      .attr("x1", 64)
      .attr("x2", Math.max(64, width - 32))
      .attr("y1", (band) => band.y)
      .attr("y2", (band) => band.y)
      .attr("stroke", graphStyles.gray300)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "6 8")
      .attr("opacity", 0.7);

    bandLayer
      .selectAll("text.band-label")
      .data(bands)
      .join("text")
      .attr("class", "band-label")
      .attr("x", 18)
      .attr("y", (band) => band.y - 8)
      .attr("fill", graphStyles.gray500)
      .attr("font-size", 11)
      .attr("font-weight", 700)
      .text((band) => band.label);

    const edgeGroups = edgeLayer
      .selectAll<SVGGElement, LayoutEdge>("g.edge")
      .data(layoutEdges, (edge) => edge.id)
      .join("g")
      .attr("class", (edge) => `edge edge-${edge.edge_type}`);

    const edgePaths = edgeGroups
      .append("path")
      .attr("fill", "none")
      .attr("stroke-linecap", "round")
      .attr("stroke-width", (edge) => edgeStrokeWidth(edge.weight, edge.edge_type))
      .attr("stroke", (edge) => edgeStrokeColor(edge))
      .attr("stroke-dasharray", (edge) => (edge.edge_type === "vertical" ? "8 8" : "0"))
      .attr("opacity", (edge) =>
        getEdgeOpacity(edge, selectedEdgeIds, Boolean(searchLower), connectedNodeIds)
      );

    const edgeLabels = edgeGroups
      .append("text")
      .attr("class", "edge-label")
      .attr("text-anchor", "middle")
      .attr("font-size", graphStyles.edgeLabelSize)
      .attr("fill", graphStyles.gray500)
      .attr("opacity", (edge) => (edge.weight >= 0.62 ? 0.88 : 0))
      .text((edge) => `${Math.round(edge.weight * 100)}%`);

    const nodeGroups = nodeLayer
      .selectAll<SVGGElement, LayoutNode>("g.node")
      .data(layoutNodes, (node) => node.id)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .on("click", (event, node) => {
        event.stopPropagation();
        onJobSelect?.(node);
      });

    nodeGroups
      .append("rect")
      .attr("class", "node-card")
      .attr("x", (node) => -nodeWidth(node) / 2)
      .attr("y", (node) => -nodeHeight(node) / 2)
      .attr("rx", graphStyles.nodeRadius)
      .attr("ry", graphStyles.nodeRadius)
      .attr("width", (node) => nodeWidth(node))
      .attr("height", (node) => nodeHeight(node))
      .attr("fill", "rgba(255,255,255,0.96)")
      .attr("stroke", (node) => node.community_color)
      .attr("stroke-width", (node) => (node.id === selectedJobId ? 2.8 : 1.2))
      .style("filter", (node) =>
        node.id === selectedJobId
          ? `drop-shadow(0 18px 30px ${node.community_color}2C)`
          : "drop-shadow(0 12px 22px rgba(15,23,42,0.10))"
      )
      .attr("opacity", (node) => nodeOpacity(node, searchLower, selectedJobId, connectedNodeIds));

    nodeGroups
      .append("rect")
      .attr("class", "node-accent")
      .attr("x", (node) => -nodeWidth(node) / 2)
      .attr("y", (node) => -nodeHeight(node) / 2)
      .attr("rx", graphStyles.nodeRadius)
      .attr("ry", graphStyles.nodeRadius)
      .attr("width", (node) => nodeWidth(node))
      .attr("height", graphStyles.nodeAccentHeight)
      .attr("fill", (node) => node.community_color)
      .attr("opacity", (node) => nodeOpacity(node, searchLower, selectedJobId, connectedNodeIds));

    nodeGroups
      .append("text")
      .attr("class", "node-title")
      .attr("x", (node) => -nodeWidth(node) / 2 + 14)
      .attr("y", -8)
      .attr("fill", graphStyles.gray900)
      .attr("font-size", graphStyles.nodeTitleSize)
      .attr("font-weight", 700)
      .attr("opacity", (node) => nodeOpacity(node, searchLower, selectedJobId, connectedNodeIds))
      .text((node) => truncateLabel(node.label, nodeWidth(node) > 178 ? 12 : 10));

    nodeGroups
      .append("text")
      .attr("class", "node-meta")
      .attr("x", (node) => -nodeWidth(node) / 2 + 14)
      .attr("y", 16)
      .attr("fill", graphStyles.gray500)
      .attr("font-size", graphStyles.nodeMetaSize)
      .attr("opacity", (node) => nodeOpacity(node, searchLower, selectedJobId, connectedNodeIds))
      .text((node) => `${node.job_count} 条JD · ${levelLabel(node.level)}`);

    nodeGroups
      .append("text")
      .attr("class", "node-summary")
      .attr("x", (node) => -nodeWidth(node) / 2 + 14)
      .attr("y", 34)
      .attr("fill", graphStyles.gray700)
      .attr("font-size", graphStyles.nodeSummarySize)
      .attr("opacity", (node) => nodeOpacity(node, searchLower, selectedJobId, connectedNodeIds))
      .text((node) => truncateLabel(node.summary || "岗位画像原型", nodeWidth(node) > 178 ? 16 : 12));

    const simulation = createLayeredSimulation(layoutNodes, layoutEdges, width, height);

    const drag = d3
      .drag<SVGGElement, LayoutNode>()
      .on("start", (event, node) => {
        if (!event.active) {
          simulation.alphaTarget(0.18).restart();
        }
        node.fx = node.x;
        node.fy = node.y;
      })
      .on("drag", (event, node) => {
        node.fx = event.x;
        node.fy = event.y;
      })
      .on("end", (event, node) => {
        if (!event.active) {
          simulation.alphaTarget(0);
        }
        node.fx = null;
        node.fy = null;
      });

    nodeGroups.call(drag);

    simulation.on("tick", () => {
      nodeGroups.attr("transform", (node) => `translate(${node.x},${node.y})`);

      edgePaths.attr("d", (edge) => edgePath(edge, nodeById));

      edgeLabels
        .attr("x", (edge) => edgeLabelX(edge, nodeById))
        .attr("y", (edge) => edgeLabelY(edge, nodeById));
    });

    return () => {
      simulation.stop();
    };
  }, [communities, edges, height, nodes, onJobSelect, searchQuery, selectedJobId, width]);

  return { svgRef, containerRef };
}

function nodeWidth(node: JobNode): number {
  if (node.job_count >= 800) {
    return graphStyles.nodeWidths.large;
  }
  if (node.job_count >= 250) {
    return graphStyles.nodeWidths.medium;
  }
  return graphStyles.nodeWidths.small;
}

function nodeHeight(node: JobNode): number {
  if (node.job_count >= 800) {
    return graphStyles.nodeHeights.large;
  }
  if (node.job_count >= 250) {
    return graphStyles.nodeHeights.medium;
  }
  return graphStyles.nodeHeights.small;
}

function edgeStrokeWidth(weight: number, edgeType: GraphEdge["edge_type"]): number {
  if (edgeType === "vertical") {
    return weight >= 0.65 ? 2.2 : 1.6;
  }
  if (weight >= 0.72) {
    return 3.2;
  }
  if (weight >= 0.48) {
    return 2.4;
  }
  return 1.6;
}

function edgeStrokeColor(edge: Pick<GraphEdge, "edge_type" | "weight">): string {
  if (edge.edge_type === "vertical") {
    return graphStyles.verticalEdgeColor;
  }
  if (edge.weight >= 0.72) {
    return graphStyles.transitionEdgeStrong;
  }
  if (edge.weight >= 0.48) {
    return graphStyles.transitionEdgeMedium;
  }
  return graphStyles.transitionEdgeWeak;
}

function resolveNode(
  value: string | LayoutNode,
  nodeById: Map<string, LayoutNode>
): LayoutNode {
  if (typeof value === "string") {
    return nodeById.get(value)!;
  }
  return value;
}

function edgePath(edge: LayoutEdge, nodeById: Map<string, LayoutNode>): string {
  const source = resolveNode(edge.source, nodeById);
  const target = resolveNode(edge.target, nodeById);
  const sourceX = source.x;
  const sourceY = source.y;
  const targetX = target.x;
  const targetY = target.y;

  if (edge.edge_type === "vertical") {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const offset = Math.min(22, distance * 0.18);
    const cx = (sourceX + targetX) / 2 - (dy / distance) * offset;
    const cy = (sourceY + targetY) / 2 + (dx / distance) * offset;
    return `M ${sourceX},${sourceY} Q ${cx},${cy} ${targetX},${targetY}`;
  }

  return `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
}

function edgeLabelX(edge: LayoutEdge, nodeById: Map<string, LayoutNode>): number {
  const source = resolveNode(edge.source, nodeById);
  const target = resolveNode(edge.target, nodeById);
  return (source.x + target.x) / 2;
}

function edgeLabelY(edge: LayoutEdge, nodeById: Map<string, LayoutNode>): number {
  const source = resolveNode(edge.source, nodeById);
  const target = resolveNode(edge.target, nodeById);
  return edge.edge_type === "vertical"
    ? (source.y + target.y) / 2 - 8
    : (source.y + target.y) / 2 - 10;
}

function nodeOpacity(
  node: JobNode,
  searchLower: string,
  selectedJobId: string | undefined,
  connectedNodeIds: Set<string>
): number {
  const matchesSearch =
    !searchLower ||
    node.label.toLowerCase().includes(searchLower) ||
    node.summary.toLowerCase().includes(searchLower) ||
    node.skills.some((skill) => skill.toLowerCase().includes(searchLower));

  if (selectedJobId && selectedJobId !== node.id && !connectedNodeIds.has(node.id)) {
    return matchesSearch ? 0.34 : 0.12;
  }
  return matchesSearch ? 1 : 0.18;
}

function getEdgeOpacity(
  edge: LayoutEdge,
  selectedEdgeIds: Set<string>,
  hasSearch: boolean,
  connectedNodeIds: Set<string>
): number {
  if (selectedEdgeIds.size > 0) {
    return selectedEdgeIds.has(edge.id) ? 1 : 0.12;
  }
  if (hasSearch) {
    const sourceId = typeof edge.source === "string" ? edge.source : edge.source.id;
    const targetId = typeof edge.target === "string" ? edge.target : edge.target.id;
    return connectedNodeIds.has(sourceId) || connectedNodeIds.has(targetId) ? 0.35 : 0.18;
  }
  return edge.edge_type === "vertical" ? 0.68 : 0.82;
}

function levelLabel(level: string): string {
  switch (level) {
    case "entry":
      return "入门";
    case "growing":
      return "成长";
    case "mature":
      return "成熟";
    case "expert":
      return "进阶";
    case "stable":
      return "稳定";
    default:
      return "探索";
  }
}
