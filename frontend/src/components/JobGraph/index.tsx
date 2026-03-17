import { useState, useCallback } from "react";
import { Spin, message } from "antd";
import { GraphCanvas } from "./GraphCanvas";
import { GraphControls } from "./GraphControls";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { useGraphData } from "./useGraphData";
import type { GraphNode, JobNode } from "./types";
import styles from "./JobGraph.module.css";

export function JobGraph() {
  const { data, loading, error, rebuild } = useGraphData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );
  const [selectedJob, setSelectedJob] = useState<JobNode | null>(null);

  const handleCategoryToggle = useCallback((category: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((item) => item !== category);
      }
      return [...prev, category];
    });
  }, []);

  const handleCategoryClick = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      const categoryId = `cat_${category}`;

      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }

      return next;
    });
  }, []);

  const handleJobSelect = useCallback((job: JobNode | null) => {
    setSelectedJob(job);
  }, []);

  const handleRebuild = useCallback(async () => {
    try {
      await rebuild();
      message.success("图谱已刷新");
    } catch {
      message.error("刷新失败");
    }
  }, [rebuild]);

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingWrapper}>
          <Spin />
          <p className={styles.statusTextError}>{error}</p>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingWrapper}>
          <Spin size="large" />
          <p className={styles.statusText}>加载图谱数据中...</p>
        </div>
      </div>
    );
  }

  const nodes = data.nodes as GraphNode[];
  const edges = data.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));

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
          selectedJob={selectedJob}
          onJobSelect={handleJobSelect}
          onCategoryClick={handleCategoryClick}
        />
      </div>

      <aside
        className={`${styles.detailPane} ${selectedJob ? styles.visible : ""}`}
      >
        {selectedJob ? (
          <NodeDetailPanel node={selectedJob} onClose={() => handleJobSelect(null)} />
        ) : null}
      </aside>
    </div>
  );
}

export default JobGraph;
