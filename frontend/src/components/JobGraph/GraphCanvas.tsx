import { useState, useCallback, useEffect, useRef } from "react";
import { useD3Graph } from "./useD3Graph";
import type { GraphCommunity, GraphEdge, JobNode } from "./types";
import styles from "./JobGraph.module.css";

interface GraphCanvasProps {
  nodes: JobNode[];
  edges: GraphEdge[];
  communities: GraphCommunity[];
  searchQuery: string;
  selectedJob: JobNode | null;
  onJobSelect: (job: JobNode | null) => void;
}

export function GraphCanvas({
  nodes,
  edges,
  communities,
  searchQuery,
  selectedJob,
  onJobSelect,
}: GraphCanvasProps) {
  const [dimensions, setDimensions] = useState({ width: 960, height: 720 });
  const [hintVisible, setHintVisible] = useState(true);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    hintTimerRef.current = setTimeout(() => setHintVisible(false), 3600);
    return () => {
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
    };
  }, []);

  const updateDimensions = useCallback(() => {
    const container = document.getElementById("graph-container");
    if (container) {
      setDimensions({
        width: container.clientWidth || 960,
        height: container.clientHeight || 720,
      });
    }
  }, []);

  useEffect(() => {
    updateDimensions();
    const container = document.getElementById("graph-container");
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateDimensions]);

  const { svgRef, containerRef } = useD3Graph({
    nodes,
    edges,
    communities,
    width: dimensions.width,
    height: dimensions.height,
    searchQuery,
    selectedJobId: selectedJob?.id,
    onJobSelect,
  });

  return (
    <div
      ref={containerRef}
      id="graph-container"
      className={`${styles.graphCanvas} ${styles.graphWrapper}`}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className={styles.svgCanvas}
      />

      {hintVisible ? (
        <div className={`${styles.hint} ${hintVisible ? styles.hintVisible : styles.hintHidden}`}>
          拖拽节点调整结构 · 滚轮缩放 · 双击画布复位
        </div>
      ) : null}
    </div>
  );
}
