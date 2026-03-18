import { useState, useCallback, useEffect, useRef } from "react";
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

  // ── 自动消失状态 ──────────────────────────────────────────
  const [navHintVisible, setNavHintVisible] = useState(true);           // 下方导航提示
  const [exploreHintVisible, setExploreHintVisible] = useState(true);    // 上方探索提示
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exploreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 下方导航 hint：挂载后 3s 消失
  useEffect(() => {
    navTimerRef.current = setTimeout(() => setNavHintVisible(false), 3000);
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    };
  }, []);

  // 上方探索 hint：showExploreHint 变为 true 时重置可见，4s 后消失
  useEffect(() => {
    if (showExploreHint) {
      setExploreHintVisible(true);
      if (exploreTimerRef.current) clearTimeout(exploreTimerRef.current);
      exploreTimerRef.current = setTimeout(() => setExploreHintVisible(false), 4000);
    } else {
      setExploreHintVisible(false);
    }
    return () => {
      if (exploreTimerRef.current) clearTimeout(exploreTimerRef.current);
    };
  }, [showExploreHint]);
  // ─────────────────────────────────────────────────────────

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
      {showExploreHint && exploreHintVisible ? (
        <div
          className={`${styles.exploreHint} ${
            exploreHintVisible ? styles.hintVisible : styles.hintHidden
          }`}
        >
          点击任意分类，探索该领域的岗位
        </div>
      ) : null}

      {navHintVisible ? (
        <div
          className={`${styles.hint} ${
            navHintVisible ? styles.hintVisible : styles.hintHidden
          }`}
        >
          滚轮缩放 · 拖拽平移 · 双击重置
        </div>
      ) : null}
    </div>
  );
}
