import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Spin, message } from "antd";
import { GraphCanvas } from "./GraphCanvas";
import { GraphControls } from "./GraphControls";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { useGraphData } from "./useGraphData";
import type { GraphEdge, JobNode, RoleRelation } from "./types";
import styles from "./JobGraph.module.css";

export function JobGraph() {
  const { data, loading, error, rebuild } = useGraphData();
  const graphData = data ?? {
    nodes: [],
    edges: [],
    communities: [],
    totals: {
      role_count: 0,
      jd_count: 0,
      community_count: 0,
      edge_count: 0,
    },
    meta: {
      generated_at: "",
      edge_policy: "",
      transition_edge_count: 0,
      vertical_edge_count: 0,
    },
    generated_at: "",
  };
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobNode | null>(null);
  const [statsVisible, setStatsVisible] = useState(true);
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    statsTimerRef.current = setTimeout(() => setStatsVisible(false), 5000);
    return () => {
      if (statsTimerRef.current) {
        clearTimeout(statsTimerRef.current);
      }
    };
  }, []);

  const handleCommunityToggle = (communityId: string) => {
    setSelectedCommunities((prev) =>
      prev.includes(communityId)
        ? prev.filter((item) => item !== communityId)
        : [...prev, communityId]
    );
    setSelectedJob(null);
  };

  const handleJobSelect = (job: JobNode | null) => {
    setSelectedJob(job);
  };

  const handleRebuild = async () => {
    try {
      await rebuild();
      message.success("岗位画像网络已刷新");
    } catch {
      message.error("刷新失败");
    }
  };

  const visibleCommunityIds =
    selectedCommunities.length > 0 ? new Set(selectedCommunities) : null;

  const visibleNodes = graphData.nodes.filter((node) =>
    visibleCommunityIds ? visibleCommunityIds.has(node.community_id) : true
  );
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = graphData.edges.filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );

  const nodeById = useMemo(
    () => new Map(visibleNodes.map((node) => [node.id, node])),
    [visibleNodes]
  );

  const selectedRelations = useMemo(() => {
    if (!selectedJob) {
      return { transitions: [] as RoleRelation[], verticals: [] as RoleRelation[] };
    }

    const relations: RoleRelation[] = visibleEdges
      .filter((edge) => edge.source === selectedJob.id || edge.target === selectedJob.id)
      .map((edge) => {
        const relatedId = edge.source === selectedJob.id ? edge.target : edge.source;
        const relatedNode = nodeById.get(relatedId);
        if (!relatedNode) {
          return null;
        }
        return {
          node: relatedNode,
          edge,
          direction: edge.source === selectedJob.id ? "outgoing" : "incoming",
        } satisfies RoleRelation;
      })
      .filter((item): item is RoleRelation => item !== null);

    return {
      transitions: relations.filter((item) => item.edge.edge_type === "transition"),
      verticals: relations.filter((item) => item.edge.edge_type === "vertical"),
    };
  }, [nodeById, selectedJob, visibleEdges]);

  const communityOptions = graphData.communities.filter((community) =>
    community.node_ids.some((nodeId) => visibleNodeIds.has(nodeId)) ||
    selectedCommunities.length === 0
  );

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
          <p className={styles.statusText}>加载岗位画像网络中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={`${styles.graphPane} ${selectedJob ? styles.withDetail : ""}`}>
        <div className={styles.headerStack}>
          <GraphControls
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            communities={graphData.communities}
            selectedCommunities={selectedCommunities}
            onCommunityToggle={handleCommunityToggle}
            onRebuild={handleRebuild}
            loading={loading}
          />

          <div className={`${styles.statsStrip} ${statsVisible ? "" : styles.statsStripHidden}`}>
            共 {graphData.totals.role_count} 个岗位原型 · {graphData.totals.edge_count} 条关系边 · 覆盖{" "}
            {graphData.totals.community_count} 个关系社区
          </div>

          <div className={styles.legendStrip}>
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.legendLineTransition}`} />
              实线 = 横向换岗（蓝色）
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.legendLineVertical}`} />
              虚线 = 晋升方向（灰色）
            </span>
            <span className={styles.legendItem}>节点颜色 = 关系社区</span>
          </div>
        </div>

        <GraphCanvas
          nodes={visibleNodes}
          edges={visibleEdges}
          communities={communityOptions}
          searchQuery={deferredSearchQuery}
          selectedJob={selectedJob}
          onJobSelect={handleJobSelect}
        />
      </div>

      <aside className={`${styles.detailPane} ${selectedJob ? styles.visible : ""}`}>
        {selectedJob ? (
          <NodeDetailPanel
            node={selectedJob}
            transitions={selectedRelations.transitions}
            verticals={selectedRelations.verticals}
            onClose={() => handleJobSelect(null)}
          />
        ) : null}
      </aside>
    </div>
  );
}

export default JobGraph;
