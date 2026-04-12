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

function communityColorIndex(color: string): number {
  const idx = graphStyles.communityStrokes.indexOf(color);
  return idx >= 0 ? idx : 0;
}

function nodeFillColor(node: JobNode): string {
  const idx = communityColorIndex(node.community_color);
  return graphStyles.communityFills[idx % graphStyles.communityFills.length];
}

function nodeStrokeColor(node: JobNode, selected: boolean): string {
  if (selected) return node.community_color;
  return node.community_color + "CC";
}

function pillWidth(label: string): number {
  const charWidth = label.split("").reduce((sum, ch) => {
    return sum + (/[\u4e00-\u9fa5]/.test(ch) ? 14 : 8);
  }, 0);
  const raw = charWidth + graphStyles.nodePillPaddingX * 2;
  return Math.max(
    graphStyles.nodePillMinWidth,
    Math.min(graphStyles.nodePillMaxWidth, raw)
  );
}

const PILL_H = graphStyles.nodePillHeight;

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
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.style("font-family", graphStyles.fontFamily);

    const defs = svg.append("defs");
    defs.append("filter")
      .attr("id", "node-shadow")
      .attr("x", "-20%")
      .attr("y", "-20%")
      .attr("width", "140%")
      .attr("height", "140%")
      .html(`
        <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="rgba(15,23,42,0.10)"/>
      `);
    defs.append("filter")
      .attr("id", "node-shadow-selected")
      .attr("x", "-30%")
      .attr("y", "-30%")
      .attr("width", "160%")
      .attr("height", "160%")
      .html(`
        <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="rgba(47,111,237,0.28)"/>
      `);

    const root = svg.append("g");
    const bandLayer = root.append("g").attr("class", "band-layer");
    const edgeLayer = root.append("g").attr("class", "edge-layer");
    const nodeLayer = root.append("g").attr("class", "node-layer");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 3.0])
      .on("zoom", (event) => root.attr("transform", event.transform.toString()));
    svg.call(zoom);
    svg.on("dblclick.zoom", null);
    svg.on("dblclick.reset", () =>
      svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity)
    );
    svg.on("click.clear-selection", () => onJobSelect?.(null));

    const { nodes: layoutNodes, edges: layoutEdges, bands } = buildLayeredGraph(
      nodes,
      edges,
      width,
      height
    );
    const nodeById = new Map(layoutNodes.map((n) => [n.id, n]));

    const selectedEdgeIds = new Set(
      selectedJobId
        ? layoutEdges
            .filter((e) => {
              const sid = typeof e.source === "string" ? e.source : e.source.id;
              const tid = typeof e.target === "string" ? e.target : e.target.id;
              return sid === selectedJobId || tid === selectedJobId;
            })
            .map((e) => e.id)
        : []
    );
    const connectedNodeIds = new Set<string>();
    if (selectedJobId) {
      connectedNodeIds.add(selectedJobId);
      layoutEdges.forEach((e) => {
        const sid = typeof e.source === "string" ? e.source : e.source.id;
        const tid = typeof e.target === "string" ? e.target : e.target.id;
        if (sid === selectedJobId || tid === selectedJobId) {
          connectedNodeIds.add(sid);
          connectedNodeIds.add(tid);
        }
      });
    }

    const searchLower = searchQuery.trim().toLowerCase();

    const bandBoundaries = bands.map((band, i) => {
      const prev = bands[i - 1];
      const next = bands[i + 1];
      const top = prev ? (prev.y + band.y) / 2 : 0;
      const bottom = next ? (band.y + next.y) / 2 : height;
      return { ...band, top, bottom };
    });

    bandLayer
      .selectAll("rect.band-bg")
      .data(bandBoundaries)
      .join("rect")
      .attr("class", "band-bg")
      .attr("x", 0)
      .attr("y", (b) => b.top)
      .attr("width", width)
      .attr("height", (b) => b.bottom - b.top)
      .attr("fill", (b) => {
        const key = b.key as string;
        return (graphStyles.bandColors as Record<string, string>)[key] ?? "rgba(248,250,252,0.4)";
      });

    bandLayer
      .selectAll("text.band-label")
      .data(bands)
      .join("text")
      .attr("class", "band-label")
      .attr("x", 16)
      .attr("y", (b) => b.y - 10)
      .attr("fill", graphStyles.gray500)
      .attr("font-size", 11)
      .attr("font-weight", 700)
      .attr("letter-spacing", "0.5px")
      .text((b) => b.label);

    const edgeGroups = edgeLayer
      .selectAll<SVGGElement, LayoutEdge>("g.edge")
      .data(layoutEdges, (e) => e.id)
      .join("g")
      .attr("class", (e) => `edge edge-${e.edge_type}`);

    const edgePaths = edgeGroups
      .append("path")
      .attr("fill", "none")
      .attr("stroke-linecap", "round")
      .attr("stroke-width", (e) => edgeStrokeWidth(e.weight, e.edge_type))
      .attr("stroke", (e) => edgeColor(e))
      .attr("stroke-dasharray", (e) => (e.edge_type === "vertical" ? "7 5" : "0"))
      .attr("opacity", (e) => getEdgeOpacity(e, selectedEdgeIds, Boolean(searchLower), connectedNodeIds));

    const edgeLabels = edgeGroups
      .append("text")
      .attr("class", "edge-label")
      .attr("text-anchor", "middle")
      .attr("font-size", graphStyles.edgeLabelSize)
      .attr("fill", graphStyles.gray500)
      .attr("opacity", (e) => (e.edge_type === "transition" && e.weight >= 0.60 ? 0.85 : 0))
      .text((e) => `${Math.round(e.weight * 100)}%`);

    const nodeGroups = nodeLayer
      .selectAll<SVGGElement, LayoutNode>("g.node")
      .data(layoutNodes, (n) => n.id)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .on("click", (event, node) => {
        event.stopPropagation();
        onJobSelect?.(node);
      });

    nodeGroups
      .append("rect")
      .attr("class", "node-pill")
      .attr("x", (n) => -pillWidth(n.label) / 2)
      .attr("y", -PILL_H / 2)
      .attr("width", (n) => pillWidth(n.label))
      .attr("height", PILL_H)
      .attr("rx", graphStyles.nodePillRx)
      .attr("ry", graphStyles.nodePillRx)
      .attr("fill", (n) => nodeFillColor(n))
      .attr("stroke", (n) => nodeStrokeColor(n, n.id === selectedJobId))
      .attr("stroke-width", (n) => (n.id === selectedJobId ? 2.5 : 1.5))
      .style("filter", (n) =>
        n.id === selectedJobId ? "url(#node-shadow-selected)" : "url(#node-shadow)"
      )
      .attr("opacity", (n) => nodeOpacity(n, searchLower, selectedJobId, connectedNodeIds));

    nodeGroups
      .append("text")
      .attr("class", "node-title")
      .attr("text-anchor", "middle")
      .attr("y", -6)
      .attr("fill", graphStyles.gray900)
      .attr("font-size", graphStyles.nodeTitleSize)
      .attr("font-weight", 700)
      .attr("letter-spacing", "-0.3px")
      .attr("pointer-events", "none")
      .attr("opacity", (n) => nodeOpacity(n, searchLower, selectedJobId, connectedNodeIds))
      .text((n) => {
        const maxChars = pillWidth(n.label) > 130 ? 8 : 6;
        return truncateLabel(n.label, maxChars);
      });

    nodeGroups
      .append("text")
      .attr("class", "node-meta")
      .attr("text-anchor", "middle")
      .attr("y", 14)
      .attr("fill", graphStyles.gray500)
      .attr("font-size", graphStyles.nodeMetaSize)
      .attr("pointer-events", "none")
      .attr("opacity", (n) => nodeOpacity(n, searchLower, selectedJobId, connectedNodeIds))
      .text((n) => `${n.job_count} 条JD`);

    nodeGroups
      .filter((n) => n.id === selectedJobId)
      .append("rect")
      .attr("x", (n) => -pillWidth(n.label) / 2 - 5)
      .attr("y", -PILL_H / 2 - 5)
      .attr("width", (n) => pillWidth(n.label) + 10)
      .attr("height", PILL_H + 10)
      .attr("rx", graphStyles.nodePillRx + 5)
      .attr("ry", graphStyles.nodePillRx + 5)
      .attr("fill", "none")
      .attr("stroke", (n) => n.community_color)
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4 3")
      .attr("opacity", 0.6);

    nodeGroups
      .on("mouseenter", function (_, node) {
        if (node.id === selectedJobId) return;
        d3.select(this).select(".node-pill")
          .transition()
          .duration(120)
          .attr("stroke-width", 2)
          .attr("fill", node.community_color + "33");
      })
      .on("mouseleave", function (_, node) {
        if (node.id === selectedJobId) return;
        d3.select(this).select(".node-pill")
          .transition()
          .duration(120)
          .attr("stroke-width", 1.5)
          .attr("fill", nodeFillColor(node));
      });

    const simulation = createLayeredSimulation(layoutNodes, layoutEdges, width, height);

    const drag = d3.drag<SVGGElement, LayoutNode>()
      .on("start", (event, node) => {
        if (!event.active) simulation.alphaTarget(0.18).restart();
        node.fx = node.x;
        node.fy = node.y;
      })
      .on("drag", (event, node) => {
        node.fx = event.x;
        node.fy = event.y;
      })
      .on("end", (event, node) => {
        if (!event.active) simulation.alphaTarget(0);
        node.fx = null;
        node.fy = null;
      });

    nodeGroups.call(drag);

    simulation.on("tick", () => {
      nodeGroups.attr("transform", (n) => `translate(${n.x},${n.y})`);
      edgePaths.attr("d", (e) => buildEdgePath(e, nodeById));
      edgeLabels
        .attr("x", (e) => edgeMidX(e, nodeById))
        .attr("y", (e) => edgeMidY(e, nodeById) - 4);
    });

    nodeGroups
      .attr("opacity", 0)
      .transition()
      .duration(350)
      .delay((_, i) => i * 18)
      .attr("opacity", 1);

    return () => {
      simulation.stop();
    };
  }, [communities, edges, height, nodes, onJobSelect, searchQuery, selectedJobId, width]);

  return { svgRef, containerRef };
}

function edgeColor(edge: LayoutEdge): string {
  if (edge.edge_type === "vertical") return graphStyles.verticalEdgeColor;
  if (edge.weight >= 0.70) return graphStyles.transitionEdgeStrong;
  if (edge.weight >= 0.50) return graphStyles.transitionEdgeMedium;
  return graphStyles.transitionEdgeWeak;
}

function edgeStrokeWidth(weight: number, edgeType: GraphEdge["edge_type"]): number {
  if (edgeType === "vertical") return 1.5;
  if (weight >= 0.70) return 2.8;
  if (weight >= 0.50) return 2.0;
  return 1.4;
}

function resolveNode(v: string | LayoutNode, map: Map<string, LayoutNode>): LayoutNode {
  return typeof v === "string" ? map.get(v)! : v;
}

function buildEdgePath(edge: LayoutEdge, nodeById: Map<string, LayoutNode>): string {
  const s = resolveNode(edge.source, nodeById);
  const t = resolveNode(edge.target, nodeById);
  if (!s || !t) return "";
  if (edge.edge_type === "vertical") {
    const mx = (s.x + t.x) / 2;
    const my = (s.y + t.y) / 2 - 18;
    return `M ${s.x},${s.y} Q ${mx},${my} ${t.x},${t.y}`;
  }
  return `M ${s.x},${s.y} L ${t.x},${t.y}`;
}

function edgeMidX(edge: LayoutEdge, nodeById: Map<string, LayoutNode>): number {
  const s = resolveNode(edge.source, nodeById);
  const t = resolveNode(edge.target, nodeById);
  if (!s || !t) return 0;
  return (s.x + t.x) / 2;
}

function edgeMidY(edge: LayoutEdge, nodeById: Map<string, LayoutNode>): number {
  const s = resolveNode(edge.source, nodeById);
  const t = resolveNode(edge.target, nodeById);
  if (!s || !t) return 0;
  return (s.y + t.y) / 2;
}

function nodeOpacity(
  node: JobNode,
  searchLower: string,
  selectedJobId: string | undefined,
  connectedNodeIds: Set<string>
): number {
  const matches =
    !searchLower ||
    node.label.toLowerCase().includes(searchLower) ||
    node.skills.some((s) => s.toLowerCase().includes(searchLower));
  if (selectedJobId && selectedJobId !== node.id && !connectedNodeIds.has(node.id)) {
    return matches ? 0.35 : 0.12;
  }
  return matches ? 1 : 0.18;
}

function getEdgeOpacity(
  edge: LayoutEdge,
  selectedEdgeIds: Set<string>,
  hasSearch: boolean,
  connectedNodeIds: Set<string>
): number {
  if (selectedEdgeIds.size > 0) return selectedEdgeIds.has(edge.id) ? 1 : 0.08;
  if (hasSearch) {
    const sid = typeof edge.source === "string" ? edge.source : edge.source.id;
    const tid = typeof edge.target === "string" ? edge.target : edge.target.id;
    return connectedNodeIds.has(sid) || connectedNodeIds.has(tid) ? 0.5 : 0.12;
  }
  return edge.edge_type === "vertical" ? 0.55 : 0.75;
}
