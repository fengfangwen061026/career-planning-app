import { useState, useCallback, useRef, useEffect } from "react";
import { Spin, message } from "antd";
import { GraphCanvas } from "./GraphCanvas";
import { GraphControls } from "./GraphControls";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { useGraphData } from "./useGraphData";
import type { GraphNode, JobNode } from "./types";
import { isJobNode } from "./types";
import styles from "./JobGraph.module.css";

export function JobGraph() {
  const { data, loading, error, rebuild } = useGraphData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );
  const [selectedJob, setSelectedJob] = useState<JobNode | null>(null);

  const graphRef = useRef<{ resize: () => void } | null>(null);

  const handleCategoryToggle = useCallback((category: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((c) => c !== category);
      }
      return [...prev, category];
    });
  }, []);

  const handleCategoryClick = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const newSet = new Set(prev);
      const catId = `cat_${category}`;
      if (newSet.has(catId)) {
        newSet.delete(catId);
      } else {
        newSet.add(catId);
      }
      return newSet;
    });
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (isJobNode(node)) {
      setSelectedJob(node);
    }
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedJob(null);
  }, []);

  const handleRebuild = useCallback(async () => {
    try {
      await rebuild();
      message.success("图谱已刷新");
    } catch (err) {
      message.error("刷新失败");
    }
  }, [rebuild]);

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingWrapper}>
          <Spin />
          <p style={{ color: "#ef4444", marginTop: 8 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingWrapper}>
          <Spin size="large" />
          <p style={{ color: "#64748b", marginTop: 8 }}>加载图谱数据...</p>
        </div>
      </div>
    );
  }

  const nodes = data.nodes as GraphNode[];
  const edges = data.edges.map((e) => ({ source: e.source, target: e.target }));

  return (
    <div className={styles.container}>
      <div
        className={`${styles.graphPane} ${selectedJob ? styles.withDetail : ""}`}
      >
        <GraphControls
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategories={selectedCategories}
          onCategoryToggle={handleCategoryToggle}
          onRebuild={handleRebuild}
          loading={loading}
        />
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          searchQuery={searchQuery}
          selectedCategories={selectedCategories}
          collapsedCategories={collapsedCategories}
          onNodeClick={handleNodeClick}
          onCategoryClick={handleCategoryClick}
        />
      </div>

      {selectedJob && (
        <div
          className={`${styles.detailPane} ${selectedJob ? styles.visible : ""}`}
        >
          <NodeDetailPanel node={selectedJob} onClose={handleCloseDetail} />
        </div>
      )}
    </div>
  );
}

export default JobGraph;
