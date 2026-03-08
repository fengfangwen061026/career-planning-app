import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Result, Skeleton, message } from 'antd';
import { BuildOutlined } from '@ant-design/icons';
import { graphApi } from '../api/graph';
import { CytoscapeGraph, DetailPanel, GraphStats, GraphToolbar } from '../components/graph';
import { useGraphData } from '../hooks/useGraphData';
import type { AdaptedGraphEdge, AdaptedGraphNode, GraphEdgeType, GraphLayoutType } from '../types/graph';
import { buildGraphView, getEdgeTypeOptions, getLevelLegend } from '../utils/graphAdapter';

export default function JobGraph() {
  const { rawData, adaptedData, loading, refreshing, error, refetch } = useGraphData();
  const [building, setBuilding] = useState(false);
  const [startNodeId, setStartNodeId] = useState<string | undefined>(undefined);
  const [edgeTypeFilter, setEdgeTypeFilter] = useState<GraphEdgeType | undefined>(undefined);
  const [currentLayout, setCurrentLayout] = useState<GraphLayoutType>('cose');
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | undefined>(undefined);

  const graphView = useMemo(() => {
    if (!adaptedData) {
      return null;
    }

    return buildGraphView(adaptedData, {
      startNodeId,
      edgeTypeFilter,
      focusDepth: 1,
    });
  }, [adaptedData, edgeTypeFilter, startNodeId]);

  const nodeLookup = useMemo(() => {
    const lookup = new Map<string, AdaptedGraphNode>();
    for (const node of adaptedData?.nodes ?? []) {
      lookup.set(node.id, node);
    }
    return lookup;
  }, [adaptedData]);

  const edgeLookup = useMemo(() => {
    const lookup = new Map<string, AdaptedGraphEdge>();
    for (const edge of adaptedData?.edges ?? []) {
      lookup.set(edge.id, edge);
    }
    return lookup;
  }, [adaptedData]);

  const selectedNode = selectedNodeId ? nodeLookup.get(selectedNodeId) ?? null : null;
  const selectedEdge = selectedEdgeId ? edgeLookup.get(selectedEdgeId) ?? null : null;

  const startNodeOptions = useMemo(
    () =>
      (adaptedData?.nodes ?? [])
        .slice()
        .sort((a, b) => a.fullLabel.localeCompare(b.fullLabel, 'zh-CN'))
        .map((node) => ({
          value: node.id,
          label: node.fullLabel,
        })),
    [adaptedData],
  );

  const edgeTypeOptions = useMemo(() => (adaptedData ? getEdgeTypeOptions(adaptedData) : []), [adaptedData]);
  const levelLegend = useMemo(() => (adaptedData ? getLevelLegend(adaptedData) : []), [adaptedData]);

  const dirtyDataCount = adaptedData
    ? adaptedData.warnings.invalidEdges + adaptedData.warnings.invalidNodes + adaptedData.warnings.duplicateEdges
    : 0;

  useEffect(() => {
    if (!graphView) {
      return;
    }

    const visibleNodeIds = new Set(graphView.nodes.map((node) => node.id));
    const visibleEdgeIds = new Set(graphView.edges.map((edge) => edge.id));

    if (selectedNodeId && !visibleNodeIds.has(selectedNodeId)) {
      setSelectedNodeId(undefined);
    }
    if (selectedEdgeId && !visibleEdgeIds.has(selectedEdgeId)) {
      setSelectedEdgeId(undefined);
    }
  }, [graphView, selectedEdgeId, selectedNodeId]);

  const handleBuildGraph = async () => {
    setBuilding(true);
    try {
      await graphApi.buildGraph();
      message.success('图谱构建完成，已刷新最新数据。');
      await refetch();
    } catch (buildError) {
      message.error(buildError instanceof Error ? buildError.message : '图谱构建失败，请稍后重试。');
    } finally {
      setBuilding(false);
    }
  };

  const handleCanvasClick = () => {
    setSelectedNodeId(undefined);
    setSelectedEdgeId(undefined);
  };

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(undefined);
  };

  const handleEdgeSelect = (edgeId: string) => {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(undefined);
  };

  const handleResetFilters = () => {
    setStartNodeId(undefined);
    setEdgeTypeFilter(undefined);
    setSelectedNodeId(undefined);
    setSelectedEdgeId(undefined);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-slate-900">岗位知识图谱</h1>
          <p className="mt-1 text-sm text-slate-500">基于统一适配层展示岗位节点与职业迁移关系，支持局部视图、边筛选与固定详情面板。</p>
        </div>

        <Button icon={<BuildOutlined />} onClick={handleBuildGraph} loading={building}>
          重建图谱
        </Button>
      </div>

      {adaptedData && graphView ? <GraphStats data={adaptedData} view={graphView} layout={currentLayout} /> : null}

      <GraphToolbar
        startNodeId={startNodeId}
        startNodeOptions={startNodeOptions}
        edgeTypeFilter={edgeTypeFilter}
        edgeTypeOptions={edgeTypeOptions}
        currentLayout={currentLayout}
        levelLegend={levelLegend}
        onStartNodeChange={setStartNodeId}
        onEdgeTypeChange={setEdgeTypeFilter}
        onLayoutChange={setCurrentLayout}
        onRefresh={() => void refetch()}
        loading={refreshing}
      />

      {dirtyDataCount > 0 && adaptedData ? (
        <Alert
          type="warning"
          showIcon
          message="检测到部分脏数据，已自动过滤并继续渲染有效图谱。"
          description={`过滤异常节点 ${adaptedData.warnings.invalidNodes} 条，异常边 ${adaptedData.warnings.invalidEdges} 条，重复边 ${adaptedData.warnings.duplicateEdges} 条。`}
        />
      ) : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Skeleton active paragraph={{ rows: 12 }} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Skeleton active paragraph={{ rows: 10 }} />
          </div>
        </div>
      ) : null}

      {!loading && error ? (
        <Result
          status="error"
          title="图谱加载失败"
          subTitle={error}
          extra={
            <Button type="primary" onClick={() => void refetch()} loading={refreshing}>
              重新加载
            </Button>
          }
        />
      ) : null}

      {!loading && !error && adaptedData && graphView && graphView.stats.nodeCount === 0 ? (
        <Empty
          className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16"
          description="当前筛选条件下暂无图谱数据"
        >
          <Button onClick={handleResetFilters}>重置筛选</Button>
        </Empty>
      ) : null}

      {!loading && !error && adaptedData && graphView && graphView.stats.nodeCount > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="flex flex-col gap-3">
            {graphView.meta.message ? <Alert type="info" showIcon message={graphView.meta.message} /> : null}

            {rawData ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <CytoscapeGraph
                  elements={graphView.elements}
                  nodeCount={graphView.stats.nodeCount}
                  selectedNodeId={selectedNodeId}
                  selectedEdgeId={selectedEdgeId}
                  layout={currentLayout}
                  onNodeSelect={handleNodeSelect}
                  onEdgeSelect={handleEdgeSelect}
                  onCanvasClick={handleCanvasClick}
                />
              </div>
            ) : null}
          </section>

          <DetailPanel node={selectedNode} edge={selectedEdge} nodeLookup={nodeLookup} />
        </div>
      ) : null}
    </div>
  );
}
