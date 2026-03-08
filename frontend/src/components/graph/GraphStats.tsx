import { Card, Statistic } from 'antd';
import type { AdaptedGraphData, AdaptedGraphView, GraphLayoutType } from '../../types/graph';

interface GraphStatsProps {
  data: AdaptedGraphData;
  view: AdaptedGraphView;
  layout: GraphLayoutType;
}

export function GraphStats({ data, view, layout }: GraphStatsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Card size="small">
        <Statistic title="节点总数" value={data.stats.nodeCount} />
      </Card>
      <Card size="small">
        <Statistic title="边总数" value={data.stats.edgeCount} />
      </Card>
      <Card size="small">
        <Statistic title="当前视图节点" value={view.stats.nodeCount} />
      </Card>
      <Card size="small">
        <Statistic title="当前视图边" value={view.stats.edgeCount} />
      </Card>
      <Card size="small">
        <Statistic title="当前布局" value={layout.toUpperCase()} />
      </Card>
    </div>
  );
}
