import { useEffect, useState, useCallback, useRef } from "react";
import { Spin, message } from "antd";
import { GraphCanvas } from "./GraphCanvas";
import { GraphControls } from "./GraphControls";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { useGraphData } from "./useGraphData";
import type { CategoryNode, GraphEdge, GraphNode, JobNode } from "./types";
import styles from "./JobGraph.module.css";

export function JobGraph() {
  const { data, loading, error, rebuild } = useGraphData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobNode | null>(null);

  // ── statsStrip 自动消失 ──────────────────────────
  const [statsVisible, setStatsVisible] = useState(true);
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    statsTimerRef.current = setTimeout(() => setStatsVisible(false), 4000);
    return () => {
      if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
    };
  }, []);
  // ────────────────────────────────────────────────

  const handleCategoryToggle = useCallback((category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category]
    );
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setExpandedCategory(null);
    } else {
      setSelectedJob(null);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (
      expandedCategory &&
      selectedCategories.length > 0 &&
      !selectedCategories.includes(expandedCategory)
    ) {
      setExpandedCategory(null);
      setSelectedJob(null);
    }
  }, [expandedCategory, selectedCategories]);

  const handleCategoryClick = useCallback((category: string) => {
    setExpandedCategory((prev) => (prev === category ? null : category));
    setSelectedJob(null);
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

  const allNodes = data.nodes as GraphNode[];
  const allEdges = data.edges as GraphEdge[];
  const searching = Boolean(searchQuery.trim());

  const rootNode = allNodes.find((node) => node.type === "root");
  const categoryNodes = allNodes.filter(
    (node): node is CategoryNode => node.type === "category"
  );
  const jobNodes = allNodes.filter((node): node is JobNode => node.type === "job");

  const visibleCategoryNames =
    !searching && selectedCategories.length > 0
      ? new Set(selectedCategories)
      : null;

  const visibleCategories = categoryNodes.filter((node) =>
    visibleCategoryNames ? visibleCategoryNames.has(node.label) : true
  );

  const visibleNodes: GraphNode[] = [];
  if (rootNode) {
    visibleNodes.push(rootNode);
  }
  visibleNodes.push(...visibleCategories);

  if (searching) {
    visibleNodes.push(...jobNodes);
  } else if (expandedCategory) {
    visibleNodes.push(
      ...jobNodes.filter((node) => node.category === expandedCategory)
    );
  }

  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = allEdges.filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );

  const totals = data.totals ?? {
    role_count: jobNodes.length,
    jd_count: 0,
    category_count: categoryNodes.length,
  };

  return (
    <div className={styles.container}>
      <div
        className={`${styles.graphPane} ${selectedJob ? styles.withDetail : ""}`}
      >
        <div className={styles.headerStack}>
          <GraphControls
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categories={categoryNodes}
            selectedCategories={selectedCategories}
            onCategoryToggle={handleCategoryToggle}
            onRebuild={handleRebuild}
            loading={loading}
          />

          <div
            className={`${styles.statsStrip} ${
              statsVisible ? "" : styles.statsStripHidden
            }`}
          >
            共 {totals.role_count} 个岗位类型 · {totals.jd_count.toLocaleString()} 条招聘数据 · 覆盖 {totals.category_count} 个行业领域
          </div>
        </div>

        <GraphCanvas
          nodes={visibleNodes}
          edges={visibleEdges}
          searchQuery={searchQuery}
          expandedCategory={expandedCategory}
          selectedJob={selectedJob}
          showExploreHint={!searching && !expandedCategory}
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
