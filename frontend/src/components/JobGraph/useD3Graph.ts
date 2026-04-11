import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { GraphCommunity, GraphEdge, JobNode } from "./types";
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

interface SimNode extends d3.SimulationNodeDatum, JobNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface SimEdge extends d3.SimulationLinkDatum<SimNode>, Omit<GraphEdge, "source" | "target"> {
  source: SimNode;
  target: SimNode;
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
    if (!svgRef.current || !containerRef.current || nodes.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.style("font-family", graphStyles.fontFamily);

    const root = svg.append("g");
    const communityLayer = root.append("g").attr("class", "community-layer");
    const edgeLayer = root.append("g").attr("class", "edge-layer");
    const nodeLayer = root.append("g").attr("class", "node-layer");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2.5])
      .on("zoom", (event) => {
        root.attr("transform", event.transform.toString());
      });

    svg.call(zoom);
    svg.on("dblclick.zoom", null);
    svg.on("dblclick.reset", () => {
      svg.transition().duration(260).call(zoom.transform, d3.zoomIdentity);
    });
    svg.on("click.clear-selection", () => onJobSelect?.(null));

    const communityCenters = computeCommunityCenters(communities, width, height);
    const simNodes: SimNode[] = nodes.map((node, index) => {
      const center = communityCenters.get(node.community_id) ?? { x: width / 2, y: height / 2 };
      const spread = 42 + (index % 5) * 10;
      return {
        ...node,
        x: center.x + Math.cos(index * 1.7) * spread,
        y: center.y + Math.sin(index * 1.2) * spread,
        vx: 0,
        vy: 0,
      };
    });

    const nodeById = new Map(simNodes.map((node) => [node.id, node]));
    const simEdges: SimEdge[] = edges
      .map((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) {
          return null;
        }
        return { ...edge, source, target };
      })
      .filter((edge): edge is SimEdge => edge !== null);

    const selectedEdgeIds = new Set(
      selectedJobId
        ? simEdges
            .filter((edge) => edge.source.id === selectedJobId || edge.target.id === selectedJobId)
            .map((edge) => edge.id)
        : []
    );
    const connectedNodeIds = new Set(
      selectedJobId
        ? simEdges.flatMap((edge) =>
            edge.source.id === selectedJobId || edge.target.id === selectedJobId
              ? [edge.source.id, edge.target.id]
              : []
          )
        : []
    );
    if (selectedJobId) {
      connectedNodeIds.add(selectedJobId);
    }

    const searchLower = searchQuery.trim().toLowerCase();

    const communityPaths = communityLayer
      .selectAll<SVGPathElement, GraphCommunity>("path.community-hull")
      .data(
        communities.filter((community) => community.node_ids.some((nodeId) => nodeById.has(nodeId))),
        (community) => community.community_id
      )
      .join("path")
      .attr("class", "community-hull")
      .attr("fill", (community) => `${community.color}12`)
      .attr("stroke", (community) => `${community.color}55`)
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "4 6");

    const edgeGroups = edgeLayer
      .selectAll<SVGGElement, SimEdge>("g.edge")
      .data(simEdges, (edge) => edge.id)
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
      .selectAll<SVGGElement, SimNode>("g.node")
      .data(simNodes, (node) => node.id)
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
      .text((node) => truncateText(node.label, nodeWidth(node) > 178 ? 12 : 10));

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
      .text((node) => truncateText(node.summary || "岗位画像原型", nodeWidth(node) > 178 ? 16 : 12));

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("charge", d3.forceManyBody<SimNode>().strength(-220))
      .force(
        "collide",
        d3.forceCollide<SimNode>().radius((node) => Math.max(nodeWidth(node), nodeHeight(node)) * 0.38)
      )
      .force(
        "link",
        d3
          .forceLink<SimNode, SimEdge>(simEdges)
          .id((node) => node.id)
          .distance((edge) => edgeDistance(edge))
          .strength((edge) => edgeStrength(edge))
      )
      .force(
        "community-x",
        d3
          .forceX<SimNode>((node) => (communityCenters.get(node.community_id)?.x ?? width / 2))
          .strength(0.12)
      )
      .force(
        "community-y",
        d3
          .forceY<SimNode>((node) => (communityCenters.get(node.community_id)?.y ?? height / 2))
          .strength(0.12)
      )
      .velocityDecay(0.42)
      .alphaDecay(0.032);

    const drag = d3
      .drag<SVGGElement, SimNode>()
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

      edgePaths.attr("d", (edge) => edgePath(edge));

      edgeLabels
        .attr("x", (edge) => edgeLabelX(edge))
        .attr("y", (edge) => edgeLabelY(edge));

      communityPaths.attr("d", (community) =>
        buildCommunityPath(
          community.node_ids
            .map((nodeId) => nodeById.get(nodeId))
            .filter((node): node is SimNode => node !== undefined)
        )
      );
    });

    return () => {
      simulation.stop();
    };
  }, [communities, edges, height, nodes, onJobSelect, searchQuery, selectedJobId, width]);

  return { svgRef, containerRef };
}

function computeCommunityCenters(
  communities: GraphCommunity[],
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  const radius = Math.min(width, height) * 0.27;
  const centerX = width / 2;
  const centerY = height / 2 + 12;
  const total = Math.max(communities.length, 1);
  const centers = new Map<string, { x: number; y: number }>();

  communities.forEach((community, index) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    centers.set(community.community_id, {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    });
  });

  return centers;
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

function edgeDistance(edge: Pick<GraphEdge, "edge_type" | "weight">): number {
  return edge.edge_type === "vertical"
    ? 90 + (1 - edge.weight) * 30
    : 130 + (1 - edge.weight) * 90;
}

function edgeStrength(edge: Pick<GraphEdge, "edge_type" | "weight">): number {
  return edge.edge_type === "vertical" ? 0.20 + edge.weight * 0.18 : 0.10 + edge.weight * 0.22;
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

function edgePath(edge: SimEdge): string {
  const sourceX = edge.source.x;
  const sourceY = edge.source.y;
  const targetX = edge.target.x;
  const targetY = edge.target.y;

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

function edgeLabelX(edge: SimEdge): number {
  if (edge.edge_type === "vertical") {
    return (edge.source.x + edge.target.x) / 2;
  }
  return (edge.source.x + edge.target.x) / 2;
}

function edgeLabelY(edge: SimEdge): number {
  if (edge.edge_type === "vertical") {
    return (edge.source.y + edge.target.y) / 2 - 8;
  }
  return (edge.source.y + edge.target.y) / 2 - 10;
}

function buildCommunityPath(nodes: SimNode[]): string {
  if (nodes.length === 0) {
    return "";
  }
  if (nodes.length === 1) {
    const node = nodes[0];
    return roundedRectPath(node.x - 70, node.y - 52, 140, 104, 26);
  }
  if (nodes.length === 2) {
    const minX = Math.min(nodes[0].x, nodes[1].x) - 88;
    const minY = Math.min(nodes[0].y, nodes[1].y) - 64;
    const width = Math.abs(nodes[0].x - nodes[1].x) + 176;
    const height = Math.abs(nodes[0].y - nodes[1].y) + 128;
    return roundedRectPath(minX, minY, width, height, 36);
  }

  const points = nodes.flatMap((node) => {
    const rx = nodeWidth(node) / 2 + 28;
    const ry = nodeHeight(node) / 2 + 24;
    return [
      [node.x - rx, node.y - ry],
      [node.x + rx, node.y - ry],
      [node.x + rx, node.y + ry],
      [node.x - rx, node.y + ry],
    ];
  }) as [number, number][];

  const hull = d3.polygonHull(points);
  return hull ? `M${hull.join("L")}Z` : "";
}

function roundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  return [
    `M${x + radius},${y}`,
    `H${x + width - radius}`,
    `Q${x + width},${y} ${x + width},${y + radius}`,
    `V${y + height - radius}`,
    `Q${x + width},${y + height} ${x + width - radius},${y + height}`,
    `H${x + radius}`,
    `Q${x},${y + height} ${x},${y + height - radius}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    "Z",
  ].join(" ");
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}…`;
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
  edge: SimEdge,
  selectedEdgeIds: Set<string>,
  hasSearch: boolean,
  connectedNodeIds: Set<string>
): number {
  if (selectedEdgeIds.size > 0) {
    return selectedEdgeIds.has(edge.id) ? 1 : 0.12;
  }
  if (hasSearch) {
    return connectedNodeIds.size > 0 ? 0.35 : 0.58;
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
