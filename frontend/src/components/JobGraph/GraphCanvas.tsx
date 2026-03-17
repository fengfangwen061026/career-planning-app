import { useState, useCallback, useEffect } from "react";
import { useD3Graph } from "./useD3Graph";
import type { GraphNode, JobNode } from "./types";
import styles from "./JobGraph.module.css";

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: { source: string; target: string }[];
  searchQuery: string;
  selectedCategories: string[];
  collapsedCategories: Set<string>;
  selectedJob: JobNode | null;
  onJobSelect: (job: JobNode | null) => void;
  onCategoryClick: (category: string) => void;
}

export function GraphCanvas({
  nodes,
  edges,
  searchQuery,
  selectedCategories,
  collapsedCategories,
  selectedJob,
  onJobSelect,
  onCategoryClick,
}: GraphCanvasProps) {
  const [dimensions, setDimensions] = useState({ width: 900, height: 700 });

  const updateDimensions = useCallback(() => {
    const container = document.getElementById("graph-container");
    if (container) {
      setDimensions({
        width: container.clientWidth || 900,
        height: container.clientHeight || 700,
      });
    }
  }, []);

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
    selectedJobId: selectedJob?.id,
    onJobSelect,
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
      <div className={styles.hint}>滚轮缩放 · 拖拽平移 · 双击重置</div>
    </div>
  );
}
