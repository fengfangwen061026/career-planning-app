import { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import type { GraphNode, GraphEdge, JobNode } from "./types";
import {
  buildTree,
  createTreeLayout,
  radialPoint,
  truncateLabel,
  type TreeNode,
} from "./graphLayout";
import { graphStyles } from "./graphStyles";

interface UseD3GraphOptions {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  searchQuery: string;
  selectedCategories: string[];
  collapsedCategories: Set<string>;
  selectedJobId?: string;
  onJobSelect?: (job: JobNode | null) => void;
  onCategoryClick: (category: string) => void;
}

type PointNode = d3.HierarchyPointNode<TreeNode>;
type PointLink = d3.HierarchyPointLink<TreeNode>;

export function useD3Graph({
  nodes,
  edges,
  width,
  height,
  searchQuery,
  selectedCategories,
  collapsedCategories,
  selectedJobId,
  onJobSelect,
  onCategoryClick,
}: UseD3GraphOptions) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const radius = Math.min(width, height) * 0.4;
    const centerX = width / 2;
    const centerY = height / 2 + 58;
    const treeData = buildTree(nodes, edges);
    if (!treeData) {
      return;
    }

    const root = createTreeLayout(treeData, radius);
    const visibleNodes = new Set<string>(["root"]);
    const searchLower = searchQuery.trim().toLowerCase();

    for (const node of nodes) {
      if (
        node.type === "category" &&
        (selectedCategories.length === 0 ||
          selectedCategories.includes(node.label))
      ) {
        visibleNodes.add(node.id);
      }
    }

    for (const edge of edges) {
      if (
        edge.source.startsWith("cat_") &&
        visibleNodes.has(edge.source) &&
        !collapsedCategories.has(edge.source)
      ) {
        visibleNodes.add(edge.target);
      }
    }

    if (searchLower) {
      for (const node of nodes) {
        if (node.label.toLowerCase().includes(searchLower)) {
          visibleNodes.add(node.id);
          const parentEdge = edges.find((edge) => edge.target === node.id);
          if (parentEdge) {
            visibleNodes.add(parentEdge.source);
          }
        }
      }
    }

    svg.style("font-family", graphStyles.fontFamily);

    const zoomLayer = svg.append("g");
    const layoutLayer = zoomLayer
      .append("g")
      .attr("transform", `translate(${centerX},${centerY})`);

    let initialTransform = d3.zoomIdentity;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        zoomLayer.attr("transform", event.transform.toString());
      });

    const resetZoom = () => {
      svg.transition().duration(250).call(zoom.transform, initialTransform);
    };

    svg.call(zoom);
    svg.on("dblclick.zoom", null);
    svg.on("dblclick.reset", () => resetZoom());
    svg.on("click.close-panel", () => onJobSelect?.(null));

    const defs = svg.append("defs");
    defs
      .append("filter")
      .attr("id", "job-graph-root-shadow")
      .html(
        '<feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(79,70,229,0.12)" />'
      );

    const linksGroup = layoutLayer.append("g").attr("class", "links");
    const nodesGroup = layoutLayer.append("g").attr("class", "nodes");

    const linkGenerator = d3
      .linkRadial<PointLink, PointNode>()
      .angle((datum) => datum.x)
      .radius((datum) => datum.y);

    const visibleLinks = root
      .links()
      .filter(
        (link) =>
          visibleNodes.has(link.source.data.id) &&
          visibleNodes.has(link.target.data.id)
      );

    const getNodePosition = (node: PointNode) => {
      const [x, y] = radialPoint(node.x || 0, node.y || 0);
      return { x, y };
    };

    const getBaseScale = (node: PointNode) => {
      if (node.data.type === "job" && node.data.id === selectedJobId) {
        return graphStyles.selectedJobScale;
      }
      return 1;
    };

    const transformNode = (node: PointNode, scale = getBaseScale(node)) => {
      const { x, y } = getNodePosition(node);
      return `translate(${x},${y}) scale(${scale})`;
    };

    const getAccentColor = (node: TreeNode) =>
      node.color ?? graphStyles.primary;

    const isSelectedJob = (node: TreeNode) =>
      node.type === "job" && node.id === selectedJobId;

    linksGroup
      .selectAll<SVGPathElement, PointLink>("path")
      .data(visibleLinks, (link) => link.target.data.id)
      .join("path")
      .attr("class", "link")
      .attr("data-target", (link) => link.target.data.id)
      .attr("fill", "none")
      .attr("stroke", (link) => `${getAccentColor(link.target.data)}33`)
      .attr("stroke-width", graphStyles.lineWidth)
      .attr("opacity", 0)
      .attr("d", (link) => linkGenerator(link) ?? "")
      .transition()
      .duration(320)
      .attr("opacity", 1);

    const visibleDescendants = root
      .descendants()
      .filter((node) => visibleNodes.has(node.data.id));

    const nodeGroups = nodesGroup
      .selectAll<SVGGElement, PointNode>("g.node")
      .data(visibleDescendants, (node) => node.data.id)
      .join("g")
      .attr("class", (node) => `node node-${node.data.type}`)
      .attr("data-node-id", (node) => node.data.id)
      .style("cursor", (node) => (node.data.type === "root" ? "default" : "pointer"))
      .attr("transform", (node) => {
        const baseScale = getBaseScale(node);
        if (node.data.type === "category") {
          return transformNode(node, 0.6);
        }
        return transformNode(node, baseScale);
      })
      .attr("opacity", 0)
      .on("click", function (event, node) {
        event.stopPropagation();

        if (node.data.type === "job") {
          onJobSelect?.(node.data as JobNode);
          return;
        }

        if (node.data.type === "root") {
          resetZoom();
          return;
        }

        const willExpand = collapsedCategories.has(node.data.id);
        if (willExpand) {
          onCategoryClick(node.data.label);
          return;
        }

        const descendantIds = new Set(
          node.descendants().slice(1).map((descendant) => descendant.data.id)
        );

        nodesGroup
          .selectAll<SVGGElement, PointNode>("g.node")
          .filter((descendant) => descendantIds.has(descendant.data.id))
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("opacity", 0);

        linksGroup
          .selectAll<SVGPathElement, PointLink>("path")
          .filter((link) => descendantIds.has(link.target.data.id))
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("opacity", 0);

        window.setTimeout(() => {
          onCategoryClick(node.data.label);
        }, graphStyles.interactionDuration);
      });

    nodeGroups
      .filter((node) => node.data.type === "root")
      .each(function (node) {
        const group = d3.select(this);

        group
          .append("circle")
          .attr("r", graphStyles.rootNodeRadius)
          .attr("fill", "rgba(255,255,255,0.92)")
          .attr("stroke", "#C7D2FE")
          .attr("stroke-width", 2)
          .style(
            "filter",
            "drop-shadow(0 4px 16px rgba(79,70,229,0.12))"
          );

        group
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .attr("pointer-events", "none")
          .attr("fill", graphStyles.gray900)
          .attr("font-size", `${graphStyles.rootFontSize}px`)
          .attr("font-weight", 600)
          .attr("letter-spacing", "-0.3px")
          .text(node.data.label);
      })
      .transition()
      .duration(300)
      .delay(graphStyles.enterDelay.root)
      .attr("opacity", 1);

    nodeGroups
      .filter((node) => node.data.type === "category")
      .each(function (node) {
        const group = d3.select(this);
        const color = getAccentColor(node.data);

        group
          .append("circle")
          .attr("r", graphStyles.categoryNodeRadius)
          .attr("fill", `${color}18`)
          .attr("stroke", `${color}99`)
          .attr("stroke-width", 1.5)
          .style("filter", `drop-shadow(0 2px 8px ${color}30)`);

        group
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "-0.65em")
          .attr("pointer-events", "none")
          .attr("font-size", `${graphStyles.iconFontSize}px`)
          .text(node.data.icon || "");

        group
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "1.45em")
          .attr("pointer-events", "none")
          .attr("fill", graphStyles.gray700)
          .attr("font-size", `${graphStyles.categoryFontSize}px`)
          .attr("font-weight", 600)
          .text(node.data.label);
      });

    const categoryNodes = nodeGroups.filter((node) => node.data.type === "category");

    categoryNodes
      .transition()
      .duration(400)
      .delay((_, index) => graphStyles.enterDelay.categories + index * 60)
      .attr("opacity", 1)
      .attr("transform", (node) => transformNode(node));

    categoryNodes
      .on("mouseenter", function (_, node) {
        d3.select(this)
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("transform", transformNode(node, 1.12));

        d3.select(this)
          .select("circle")
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("fill", `${getAccentColor(node.data)}28`);
      })
      .on("mouseleave", function (_, node) {
        d3.select(this)
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("transform", transformNode(node));

        d3.select(this)
          .select("circle")
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("fill", `${getAccentColor(node.data)}18`);
      });

    nodeGroups
      .filter((node) => node.data.type === "job")
      .each(function (node) {
        const group = d3.select(this);
        const color = getAccentColor(node.data);
        const selected = isSelectedJob(node.data);

        group
          .append("circle")
          .attr("r", graphStyles.jobNodeRadius)
          .attr("fill", "rgba(255,255,255,0.82)")
          .attr("stroke", selected ? color : `${color}66`)
          .attr("stroke-width", selected ? 2.5 : 1)
          .style("filter", selected ? `drop-shadow(0 0 10px ${color}80)` : "none");

        group
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .attr("pointer-events", "none")
          .attr("fill", graphStyles.gray500)
          .attr("font-size", `${graphStyles.jobFontSize}px`)
          .attr("font-weight", 400)
          .text(truncateLabel(node.data.label, 6));

        const jdCount = node.data.jd_count ?? 0;
        if (jdCount > 0) {
          group
            .append("circle")
            .attr("class", "job-badge")
            .attr("cx", 10)
            .attr("cy", -10)
            .attr("r", 8)
            .attr("fill", color);

          group
            .append("text")
            .attr("x", 10)
            .attr("y", -10)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("pointer-events", "none")
            .attr("fill", "#fff")
            .attr("font-size", `${graphStyles.badgeFontSize}px`)
            .attr("font-weight", 700)
            .text(jdCount > 99 ? "99+" : jdCount.toString());
        }
      });

    const jobNodes = nodeGroups.filter((node) => node.data.type === "job");

    jobNodes
      .transition()
      .duration(300)
      .delay((_, index) => graphStyles.enterDelay.jobs + index * 15)
      .attr("opacity", 1);

    jobNodes
      .on("mouseenter", function (_, node) {
        if (isSelectedJob(node.data)) {
          return;
        }

        d3.select(this)
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("transform", transformNode(node, 1.18));

        d3.select(this)
          .select("circle")
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("fill", "rgba(255,255,255,0.96)");
      })
      .on("mouseleave", function (_, node) {
        if (isSelectedJob(node.data)) {
          return;
        }

        d3.select(this)
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("transform", transformNode(node));

        d3.select(this)
          .select("circle")
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("fill", "rgba(255,255,255,0.82)");
      });

    const bounds = layoutLayer.node()?.getBBox();
    if (bounds) {
      const scale = 0.8 / Math.max(bounds.width / width, bounds.height / (height - 140));
      const midX = bounds.x + bounds.width / 2;
      const midY = bounds.y + bounds.height / 2;

      initialTransform = d3.zoomIdentity
        .translate(
          width / 2 - scale * (midX + centerX),
          height / 2 + 56 - scale * (midY + centerY)
        )
        .scale(scale);

      svg.call(zoom.transform, initialTransform);
    }
  }, [
    nodes,
    edges,
    width,
    height,
    searchQuery,
    selectedCategories,
    collapsedCategories,
    selectedJobId,
    onJobSelect,
    onCategoryClick,
  ]);

  useEffect(() => {
    render();
  }, [render]);

  const resize = useCallback(() => {
    render();
  }, [render]);

  return { svgRef, containerRef, resize };
}
