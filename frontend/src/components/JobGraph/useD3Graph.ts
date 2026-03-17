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
  expandedCategory: string | null;
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
  expandedCategory,
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

    const treeData = buildTree(nodes, edges);
    if (!treeData) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.style("font-family", graphStyles.fontFamily);

    const hasVisibleJobs = nodes.some((node) => node.type === "job");
    const radius = Math.min(width, height) * (hasVisibleJobs ? 0.44 : 0.34);
    const centerX = width / 2;
    const centerY = height / 2 + 38;
    const root = createTreeLayout(treeData, radius);
    const searchLower = searchQuery.trim().toLowerCase();

    let initialTransform = d3.zoomIdentity;

    const zoomLayer = svg.append("g");
    const layoutLayer = zoomLayer
      .append("g")
      .attr("transform", `translate(${centerX},${centerY})`);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.45, 2.6])
      .on("zoom", (event) => {
        zoomLayer.attr("transform", event.transform.toString());
      });

    const resetZoom = () => {
      svg.transition().duration(260).call(zoom.transform, initialTransform);
    };

    svg.call(zoom);
    svg.on("dblclick.zoom", null);
    svg.on("dblclick.reset", () => resetZoom());
    svg.on("click.close-panel", () => onJobSelect?.(null));

    const linksGroup = layoutLayer.append("g").attr("class", "links");
    const nodesGroup = layoutLayer.append("g").attr("class", "nodes");

    const linkGenerator = d3
      .linkRadial<PointLink, PointNode>()
      .angle((datum) => datum.x)
      .radius((datum) => datum.y);

    const visibleDescendants = root.descendants();
    const visibleLinks = root.links();

    const matchingJobIds = new Set(
      searchLower
        ? nodes
            .filter(
              (node) =>
                node.type === "job" &&
                node.label.toLowerCase().includes(searchLower)
            )
            .map((node) => node.id)
        : []
    );

    const matchingCategoryIds = new Set(
      searchLower
        ? nodes
            .filter((node) => node.type === "category")
            .filter(
              (node) =>
                node.label.toLowerCase().includes(searchLower) ||
                nodes.some(
                  (job) =>
                    job.type === "job" &&
                    job.category === node.label &&
                    matchingJobIds.has(job.id)
                )
            )
            .map((node) => node.id)
        : []
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

    const nodeOpacity = (node: TreeNode) => {
      if (!searchLower || node.type === "root") {
        return 1;
      }
      if (node.type === "category") {
        return matchingCategoryIds.has(node.id) ? 1 : graphStyles.fadedOpacity;
      }
      return matchingJobIds.has(node.id) ? 1 : graphStyles.fadedOpacity;
    };

    const linkOpacity = (link: PointLink) => {
      if (!searchLower) {
        return 1;
      }
      return matchingJobIds.has(link.target.data.id) ||
        matchingCategoryIds.has(link.target.data.id)
        ? 1
        : 0.12;
    };

    linksGroup
      .selectAll<SVGPathElement, PointLink>("path")
      .data(visibleLinks, (link) => link.target.data.id)
      .join("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", (link) => `${link.target.data.color ?? graphStyles.primary}33`)
      .attr("stroke-width", graphStyles.lineWidth)
      .attr("opacity", 0)
      .attr("d", (link) => linkGenerator(link) ?? "")
      .transition()
      .duration(graphStyles.layoutDuration)
      .ease(d3.easeCubicOut)
      .attr("opacity", (link) => linkOpacity(link));

    const nodeGroups = nodesGroup
      .selectAll<SVGGElement, PointNode>("g.node")
      .data(visibleDescendants, (node) => node.data.id)
      .join("g")
      .attr("class", (node) => `node node-${node.data.type}`)
      .attr("data-node-id", (node) => node.data.id)
      .style("cursor", (node) => (node.data.type === "root" ? "default" : "pointer"))
      .attr("opacity", 0)
      .attr("transform", (node) => {
        if (node.data.type === "category") {
          return transformNode(node, 0.86);
        }
        if (node.data.type === "job") {
          return transformNode(node, 0.88);
        }
        return transformNode(node);
      })
      .on("click", function (event, node) {
        event.stopPropagation();

        if (node.data.type === "root") {
          resetZoom();
          return;
        }

        if (node.data.type === "category") {
          onCategoryClick(node.data.label);
          return;
        }

        onJobSelect?.(node.data as JobNode);
      });

    nodeGroups
      .filter((node) => node.data.type === "root")
      .each(function (node) {
        const group = d3.select(this);

        group
          .append("circle")
          .attr("r", graphStyles.rootNodeRadius)
          .attr("fill", "rgba(255,255,255,0.94)")
          .attr("stroke", "#C7D2FE")
          .attr("stroke-width", 2)
          .style("filter", "drop-shadow(0 6px 18px rgba(79,70,229,0.12))");

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
      .ease(d3.easeCubicOut)
      .attr("opacity", 1);

    const categoryNodes = nodeGroups.filter((node) => node.data.type === "category");

    categoryNodes.each(function (node) {
      const group = d3.select(this);
      const color = node.data.color ?? graphStyles.primary;
      const isExpanded = expandedCategory === node.data.label && !searchLower;

      group
        .append("rect")
        .attr("x", -graphStyles.categoryCardWidth / 2)
        .attr("y", -graphStyles.categoryCardHeight / 2)
        .attr("width", graphStyles.categoryCardWidth)
        .attr("height", graphStyles.categoryCardHeight)
        .attr("rx", 22)
        .attr("fill", isExpanded ? `${color}24` : `${color}16`)
        .attr("stroke", isExpanded ? color : `${color}88`)
        .attr("stroke-width", isExpanded ? 2.5 : 1.5)
        .style("filter", `drop-shadow(0 8px 18px ${color}20)`);

      group
        .append("text")
        .attr("x", 0)
        .attr("y", -14)
        .attr("text-anchor", "middle")
        .attr("pointer-events", "none")
        .attr("font-size", `${graphStyles.iconFontSize}px`)
        .text(node.data.icon ?? "");

      group
        .append("text")
        .attr("x", 0)
        .attr("y", 6)
        .attr("text-anchor", "middle")
        .attr("pointer-events", "none")
        .attr("fill", graphStyles.gray900)
        .attr("font-size", `${graphStyles.categoryFontSize}px`)
        .attr("font-weight", 600)
        .text(node.data.label);

      group
        .append("text")
        .attr("x", 0)
        .attr("y", 24)
        .attr("text-anchor", "middle")
        .attr("pointer-events", "none")
        .attr("fill", graphStyles.gray500)
        .attr("font-size", `${graphStyles.categoryMetaFontSize}px`)
        .text(`${node.data.jd_total ?? 0}条 · ${node.data.job_count ?? 0}岗位`);

      group
        .append("text")
        .attr("x", graphStyles.categoryCardWidth / 2 - 16)
        .attr("y", -graphStyles.categoryCardHeight / 2 + 18)
        .attr("text-anchor", "middle")
        .attr("pointer-events", "none")
        .attr("fill", color)
        .attr("font-size", "12px")
        .attr("font-weight", 700)
        .text(isExpanded ? "⌃" : "⌄");
    });

    categoryNodes
      .transition()
      .duration(graphStyles.layoutDuration)
      .delay((_, index) => graphStyles.enterDelay.categories + index * 40)
      .ease(d3.easeCubicOut)
      .attr("opacity", (node) => nodeOpacity(node.data))
      .attr("transform", (node) => transformNode(node));

    categoryNodes
      .on("mouseenter", function (_, node) {
        d3.select(this)
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("transform", transformNode(node, 1.03));
      })
      .on("mouseleave", function (_, node) {
        d3.select(this)
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("transform", transformNode(node));
      });

    const jobNodes = nodeGroups.filter((node) => node.data.type === "job");

    jobNodes.each(function (node) {
      const group = d3.select(this);
      const color = node.data.color ?? graphStyles.primary;
      const selected = node.data.id === selectedJobId;

      const pill = group.append("g").attr("class", "job-pill");

      pill
        .append("rect")
        .attr("rx", 11)
        .attr("ry", 11)
        .attr("fill", "rgba(255,255,255,0.92)")
        .attr("stroke", selected ? color : `${color}80`)
        .attr("stroke-width", selected ? 2 : 1)
        .style(
          "filter",
          selected
            ? `drop-shadow(0 0 10px ${color}70)`
            : "drop-shadow(0 6px 14px rgba(15,23,42,0.06))"
        );

      pill
        .append("circle")
        .attr("r", 4)
        .attr("cx", -18)
        .attr("cy", 0)
        .attr("fill", color);

      const label = pill
        .append("text")
        .attr("x", -8)
        .attr("y", 4)
        .attr("text-anchor", "start")
        .attr("pointer-events", "none")
        .attr("fill", graphStyles.gray700)
        .attr("font-size", "11px")
        .attr("font-weight", 500)
        .text(truncateLabel(node.data.label, 10));

      const labelNode = label.node();
      if (labelNode) {
        const bbox = labelNode.getBBox();
        pill
          .select("rect")
          .attr("x", bbox.x - 10)
          .attr("y", bbox.y - 5)
          .attr("width", bbox.width + 28)
          .attr("height", bbox.height + 10);
      }

      const jdCount = node.data.jd_count ?? 0;
      if (jdCount > 0) {
        group
          .append("circle")
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

    jobNodes
      .transition()
      .duration(graphStyles.layoutDuration)
      .delay((_, index) => graphStyles.enterDelay.jobs + index * 16)
      .ease(d3.easeCubicOut)
      .attr("opacity", (node) => nodeOpacity(node.data))
      .attr("transform", (node) => transformNode(node));

    jobNodes
      .on("mouseenter", function (_, node) {
        if (node.data.id === selectedJobId) {
          return;
        }

        d3.select(this)
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("transform", transformNode(node, 1.12));

        d3.select(this)
          .select("rect")
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("fill", "rgba(255,255,255,0.98)");
      })
      .on("mouseleave", function (_, node) {
        if (node.data.id === selectedJobId) {
          return;
        }

        d3.select(this)
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("transform", transformNode(node));

        d3.select(this)
          .select("rect")
          .transition()
          .duration(graphStyles.interactionDuration)
          .attr("fill", "rgba(255,255,255,0.92)");
      });

    const bounds = layoutLayer.node()?.getBBox();
    if (bounds) {
      const scale = 0.84 / Math.max(bounds.width / width, bounds.height / (height - 180));
      const midX = bounds.x + bounds.width / 2;
      const midY = bounds.y + bounds.height / 2;

      initialTransform = d3.zoomIdentity
        .translate(
          width / 2 - scale * (midX + centerX),
          height / 2 + 26 - scale * (midY + centerY)
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
    expandedCategory,
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
