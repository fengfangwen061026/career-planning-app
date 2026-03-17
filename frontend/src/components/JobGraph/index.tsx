import { useEffect, useMemo, useState, useCallback } from "react";
import { Spin, message } from "antd";
import { GraphCanvas } from "./GraphCanvas";
import { GraphControls } from "./GraphControls";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { useGraphData } from "./useGraphData";
import type { GraphEdge, GraphNode, JobNode } from "./types";
import styles from "./JobGraph.module.css";

export function JobGraph() {
  const { data, loading, error, rebuild } = useGraphData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobNode | null>(null);

  const handleCategoryToggle = useCallback((category: string) => {
    setSelectedCategories((prev) => {
      const next = prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category];

      return next;
    });
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
  const searchLower = searchQuery.trim().toLowerCase();
  const searching = Boolean(searchLower);

  const visibleNodes = useMemo(() => {
    const nodesByType = {
      root: allNodes.find((node) => node.type === "root"),
      categories: allNodes.filter((node) => node.type === "category"),
      jobs: allNodes.filter((node) => node.type === "job"),
    };

    const visibleCategoryNames =
      !searching && selectedCategories.length > 0
        ? new Set(selectedCategories)
        : null;

    const categoryNodes = nodesByType.categories.filter((node) =>
      visibleCategoryNames ? visibleCategoryNames.has(node.label) : true
    );

    const nodes: GraphNode[] = [];
    if (nodesByType.root) {
      nodes.push(nodesByType.root);
    }
    nodes.push(...categoryNodes);

    if (searching) {
      nodes.push(...nodesByType.jobs);
      return nodes;
    }

    if (expandedCategory) {
      nodes.push(
        ...nodesByType.jobs.filter((node) => node.category === expandedCategory)
      );
    }

    return nodes;
  }, [allNodes, expandedCategory, searching, selectedCategories]);

  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = useMemo(
    () =>
      allEdges.filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
      ),
    [allEdges, visibleNodeIds]
  );

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

        <div className={styles.statsStrip}>
          共 {data.totals.role_count} 个岗位类型 · {data.totals.jd_count.toLocaleString()} 条招聘数据 · 覆盖 {data.totals.category_count} 大行业领域
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
          <NodeDetailPanel
            node={selectedJob}
            onClose={() => handleJobSelect(null)}
          />
        ) : null}
      </aside>
    </div>
  );
}

export default JobGraph;
