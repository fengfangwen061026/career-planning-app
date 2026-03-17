import { useState, useCallback, useEffect } from "react";
import { useD3Graph } from "./useD3Graph";
import type { GraphEdge, GraphNode, JobNode } from "./types";
import styles from "./JobGraph.module.css";

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  searchQuery: string;
  expandedCategory: string | null;
  selectedJob: JobNode | null;
  showExploreHint: boolean;
  onJobSelect: (job: JobNode | null) => void;
  onCategoryClick: (category: string) => void;
}

export function GraphCanvas({
  nodes,
  edges,
  searchQuery,
  expandedCategory,
  selectedJob,
  showExploreHint,
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
    expandedCategory,
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
      {showExploreHint ? (
        <div className={styles.exploreHint}>点击任意分类，探索该领域的岗位</div>
      ) : null}
      <div className={styles.hint}>滚轮缩放 · 拖拽平移 · 双击重置</div>
    </div>
  );
}
