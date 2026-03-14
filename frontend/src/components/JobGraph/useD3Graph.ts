import { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import type { GraphNode, GraphEdge } from "./types";
import {
  buildTree,
  createTreeLayout,
  radialPoint,
  getNodeRadius,
  truncateLabel,
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
  onNodeClick: (node: GraphNode) => void;
  onCategoryClick: (category: string) => void;
}

export function useD3Graph({
  nodes,
  edges,
  width,
  height,
  searchQuery,
  selectedCategories,
  collapsedCategories,
  onNodeClick,
  onCategoryClick,
}: UseD3GraphOptions) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const radius = Math.min(width, height) * 0.38;
    const centerX = width / 2;
    const centerY = height / 2;

    // Build tree and layout
    const treeData = buildTree(nodes, edges);
    if (!treeData) return;

    const root = createTreeLayout(treeData, radius);

    // Filter nodes based on search and category selection
    const visibleCategories = new Set(selectedCategories);
    const categorySet = new Set(
      nodes.filter((n) => n.type === "category").map((n) => n.label)
    );

    // Determine which nodes are visible
    const visibleNodes = new Set<string>();
    const searchLower = searchQuery.toLowerCase();

    // Always show root
    visibleNodes.add("root");

    // Show categories
    for (const node of nodes) {
      if (node.type === "category") {
        if (
          selectedCategories.length === 0 ||
          selectedCategories.includes(node.label)
        ) {
          visibleNodes.add(node.id);
        }
      }
    }

    // Show jobs under visible categories (unless collapsed)
    for (const edge of edges) {
      if (
        edge.source.startsWith("cat_") &&
        visibleNodes.has(edge.source) &&
        !collapsedCategories.has(edge.source)
      ) {
        visibleNodes.add(edge.target);
      }
    }

    // Apply search filter
    if (searchQuery) {
      for (const node of nodes) {
        if (node.label.toLowerCase().includes(searchLower)) {
          visibleNodes.add(node.id);
          // Also show its parent category
          const parentEdge = edges.find((e) => e.target === node.id);
          if (parentEdge) {
            visibleNodes.add(parentEdge.source);
          }
        }
      }
    }

    // Create main group for zooming
    const g = svg
      .append("g")
      .attr("transform", `translate(${centerX},${centerY})`);

    // Setup zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Double click to reset
    svg.on("dblclick.zoom", () => {
      svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    });

    // Create links group
    const linksGroup = g.append("g").attr("class", "links");

    // Create nodes group
    const nodesGroup = g.append("g").attr("class", "nodes");

    // Draw links
    const links: { source: d3.HierarchyPointNode<any>; target: d3.HierarchyPointNode<any> }[] = [];
    root.descendants().forEach((node) => {
      if (node.parent && visibleNodes.has(node.data.id) && visibleNodes.has(node.parent.data.id)) {
        links.push({ source: node.parent, target: node });
      }
    });

    // Draw curved links
    linksGroup
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", (d) => {
        const category = d.target.data.category || d.target.data.label;
        const catNode = nodes.find((n) => n.label === category);
        return catNode?.color || graphStyles.lineColor;
      })
      .attr("stroke-opacity", 0.25)
      .attr("stroke-width", graphStyles.lineWidth)
      .attr("d", (d) => {
        const sourceX = d.source.x || 0;
        const sourceY = d.source.y || 0;
        const targetX = d.target.x || 0;
        const targetY = d.target.y || 0;

        const [sx, sy] = radialPoint(sourceX, sourceY);
        const [tx, ty] = radialPoint(targetX, targetY);

        const midX = (sx + tx) / 2;
        const midY = (sy + ty) / 2;

        // Control point for bezier curve
        const dx = tx - sx;
        const dy = ty - sy;
        const dr = Math.sqrt(dx * dx + dy * dy);

        return `M${sx},${sy}Q${midX + dy * 0.1},${midY - dx * 0.1} ${tx},${ty}`;
      })
      .attr("opacity", 0)
      .transition()
      .duration(800)
      .delay((_, i) => i * 10)
      .attr("opacity", 1);

    // Draw nodes
    const nodeGroups = nodesGroup
      .selectAll<SVGGElement, d3.HierarchyPointNode<any>>("g.node")
      .data(root.descendants().filter((d) => visibleNodes.has(d.data.id)))
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => {
        const [x, y] = radialPoint(d.x || 0, d.y || 0);
        return `translate(${x},${y})`;
      })
      .style("cursor", "pointer")
      .attr("opacity", 0)
      .on("click", (event, d) => {
        event.stopPropagation();
        if (d.data.type === "category") {
          onCategoryClick(d.data.label);
        } else {
          onNodeClick(d.data);
        }
      });

    // Animate nodes entrance
    nodeGroups
      .transition()
      .duration(400)
      .delay((_, i) => i * graphStyles.staggerDelay.job)
      .attr("opacity", 1);

    // Root node
    nodeGroups
      .filter((d) => d.data.type === "root")
      .each(function (d) {
        const node = d3.select(this);

        // Circle
        node
          .append("circle")
          .attr("r", graphStyles.rootNodeRadius)
          .attr("fill", "#fff")
          .attr("stroke", "#6366f1")
          .attr("stroke-width", 2)
          .attr("stroke-opacity", 0.6);

        // Text
        node
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .attr("font-size", "14px")
          .attr("font-weight", "600")
          .attr("fill", "#334155")
          .text(d.data.label);
      });

    // Category nodes
    nodeGroups
      .filter((d) => d.data.type === "category")
      .each(function (d) {
        const node = d3.select(this);
        const color = d.data.color || "#6366f1";

        // Glass effect background
        const gradientId = `cat-grad-${d.data.id}`;
        const defs = svg.append("defs");
        const gradient = defs
          .append("radialGradient")
          .attr("id", gradientId)
          .attr("cx", "30%")
          .attr("cy", "30%");
        gradient
          .append("stop")
          .attr("offset", "0%")
          .attr("stop-color", "#fff")
          .attr("stop-opacity", 0.9);
        gradient
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", color)
          .attr("stop-opacity", 0.08);

        // Circle
        node
          .append("circle")
          .attr("r", graphStyles.categoryNodeRadius)
          .attr("fill", `url(#${gradientId})`)
          .attr("stroke", color)
          .attr("stroke-width", graphStyles.categoryStrokeWidth)
          .attr("stroke-opacity", graphStyles.categoryStrokeOpacity);

        // Icon
        node
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "-0.1em")
          .attr("font-size", `${graphStyles.iconFontSize}px`)
          .text(d.data.icon || "");

        // Label
        node
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "1.5em")
          .attr("font-size", `${graphStyles.categoryFontSize}px`)
          .attr("font-weight", "600")
          .attr("fill", color)
          .text(d.data.label);
      });

    // Job nodes
    nodeGroups
      .filter((d) => d.data.type === "job")
      .each(function (d) {
        const node = d3.select(this);
        const color = d.data.color || "#94a3b8";

        // Circle
        node
          .append("circle")
          .attr("r", graphStyles.jobNodeRadius)
          .attr("fill", "rgba(255,255,255,0.7)")
          .attr("stroke", color)
          .attr("stroke-width", graphStyles.jobStrokeWidth)
          .attr("stroke-opacity", graphStyles.jobStrokeOpacity);

        // Label (truncated)
        const truncatedLabel = truncateLabel(d.data.label);
        node
          .append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .attr("font-size", `${graphStyles.jobFontSize}px`)
          .attr("fill", "#475569")
          .text(truncatedLabel);

        // JD count badge
        const jdCount = d.data.jd_count || 0;
        if (jdCount > 0) {
          node
            .append("circle")
            .attr("cx", graphStyles.jobNodeRadius - 4)
            .attr("cy", -graphStyles.jobNodeRadius + 4)
            .attr("r", 6)
            .attr("fill", color);

          node
            .append("text")
            .attr("x", graphStyles.jobNodeRadius - 4)
            .attr("y", -graphStyles.jobNodeRadius + 4)
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("font-size", "7px")
            .attr("fill", "#fff")
            .text(jdCount > 99 ? "99+" : jdCount.toString());
        }
      });

    // Hover effects
    nodeGroups
      .on("mouseenter", function (event, d) {
        d3.select(this)
          .select("circle")
          .transition()
          .duration(200)
          .attr("r", getNodeRadius(d) + 4)
          .attr("filter", "drop-shadow(0 0 8px currentColor)");
      })
      .on("mouseleave", function (_, d) {
        d3.select(this)
          .select("circle")
          .transition()
          .duration(200)
          .attr("r", getNodeRadius(d))
          .attr("filter", null);
      });

    // Initial zoom to fit
    const bounds = g.node()?.getBBox();
    if (bounds) {
      const fullWidth = bounds.width;
      const fullHeight = bounds.height;
      const midX = bounds.x + fullWidth / 2;
      const midY = bounds.y + fullHeight / 2;
      const scale = 0.85 / Math.max(fullWidth / width, fullHeight / height);
      const translate = [width / 2 - scale * midX, height / 2 - scale * midY];

      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
    }
  }, [
    nodes,
    edges,
    width,
    height,
    searchQuery,
    selectedCategories,
    collapsedCategories,
    onNodeClick,
    onCategoryClick,
  ]);

  useEffect(() => {
    render();
  }, [render]);

  // Expose resize method
  const resize = useCallback(() => {
    render();
  }, [render]);

  return { svgRef, containerRef, resize };
}
