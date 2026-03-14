import { useState, useCallback, useEffect } from "react";
import { useD3Graph } from "./useD3Graph";
import type { GraphNode } from "./types";
import styles from "./JobGraph.module.css";

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: { source: string; target: string }[];
  searchQuery: string;
  selectedCategories: string[];
  collapsedCategories: Set<string>;
  onNodeClick: (node: GraphNode) => void;
  onCategoryClick: (category: string) => void;
}

export function GraphCanvas({
  nodes,
  edges,
  searchQuery,
  selectedCategories,
  collapsedCategories,
  onNodeClick,
  onCategoryClick,
}: GraphCanvasProps) {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const updateDimensions = useCallback(() => {
    const container = document.getElementById("graph-container");
    if (container) {
      setDimensions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    }
  }, []);

  // Set up resize observer
  useEffect(() => {
    updateDimensions();
    const container = document.getElementById("graph-container");
    if (container) {
      const observer = new ResizeObserver(updateDimensions);
      observer.observe(container);
      return () => observer.disconnect();
    }
  }, [updateDimensions]);

  const { svgRef, containerRef } = useD3Graph({
    nodes,
    edges,
    width: dimensions.width,
    height: dimensions.height,
    searchQuery,
    selectedCategories,
    collapsedCategories,
    onNodeClick,
    onCategoryClick,
  });

  return (
    <div
      ref={containerRef}
      id="graph-container"
      className={styles.graphCanvas}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className={styles.svgCanvas}
      />
      <div className={styles.hint}>
        滚轮缩放 · 拖拽平移 · 双击重置
      </div>
    </div>
  );
}
