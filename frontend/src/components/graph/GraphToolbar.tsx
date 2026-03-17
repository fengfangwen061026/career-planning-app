import { Button, Select, Space, Tag, Tooltip } from 'antd';
import { BorderOutlined, AppstoreOutlined, ReloadOutlined, TableOutlined, DeploymentUnitOutlined } from '@ant-design/icons';
import type { GraphEdgeType, GraphLayoutType } from '../../types/graph';

const LAYOUT_OPTIONS: Array<{
  value: GraphLayoutType;
  label: string;
  icon: typeof AppstoreOutlined;
}> = [
  { value: 'radial', label: '径向图谱', icon: DeploymentUnitOutlined },
  { value: 'cose', label: '自适应布局', icon: AppstoreOutlined },
  { value: 'circle', label: '环形布局', icon: BorderOutlined },
  { value: 'grid', label: '网格布局', icon: TableOutlined },
];

interface GraphToolbarProps {
  startNodeId?: string;
  startNodeOptions: Array<{ value: string; label: string }>;
  edgeTypeFilter?: GraphEdgeType;
  edgeTypeOptions: Array<{ value: GraphEdgeType; label: string }>;
  currentLayout: GraphLayoutType;
  levelLegend: Array<{ key: string; label: string; color: string }>;
  onStartNodeChange: (value?: string) => void;
  onEdgeTypeChange: (value?: GraphEdgeType) => void;
  onLayoutChange: (value: GraphLayoutType) => void;
  onRefresh: () => void;
  loading?: boolean;
  showFilters?: boolean;
}

export function GraphToolbar({
  startNodeId,
  startNodeOptions,
  edgeTypeFilter,
  edgeTypeOptions,
  currentLayout,
  levelLegend,
  onStartNodeChange,
  onEdgeTypeChange,
  onLayoutChange,
  onRefresh,
  loading,
  showFilters = true,
}: GraphToolbarProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className={`grid flex-1 gap-3 ${showFilters ? 'md:grid-cols-3' : 'md:grid-cols-1'}`}>
          {showFilters ? (
            <>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">起始岗位</div>
                <Select
                  allowClear
                  showSearch
                  className="w-full"
                  placeholder="选择起始岗位查看局部子图"
                  optionFilterProp="label"
                  value={startNodeId}
                  options={startNodeOptions}
                  onChange={(value) => onStartNodeChange(value)}
                />
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">边类型</div>
                <Select
                  allowClear
                  className="w-full"
                  placeholder="全部关系"
                  value={edgeTypeFilter}
                  options={edgeTypeOptions}
                  onChange={(value) => onEdgeTypeChange(value)}
                />
              </div>
            </>
          ) : null}

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">布局切换</div>
            <Space.Compact className="w-full">
              {LAYOUT_OPTIONS.map((layout) => {
                const Icon = layout.icon;
                return (
                  <Tooltip key={layout.value} title={layout.label}>
                    <Button
                      className="flex-1"
                      type={currentLayout === layout.value ? 'primary' : 'default'}
                      icon={<Icon />}
                      onClick={() => onLayoutChange(layout.value)}
                    />
                  </Tooltip>
                );
              })}
            </Space.Compact>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
            刷新图谱
          </Button>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <Tag color="blue">内环: 岗位分类</Tag>
            <Tag color="default">外环: 岗位节点</Tag>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">图例</div>
        <div className="flex flex-wrap gap-2">
          {levelLegend.map((item) => (
            <span
              key={item.key}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
