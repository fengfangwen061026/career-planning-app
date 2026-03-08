import type { ReactNode } from 'react';
import { Descriptions, Empty, Tag } from 'antd';
import type { AdaptedGraphEdge, AdaptedGraphNode } from '../../types/graph';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasDeepNestedObject(value: Record<string, unknown>): boolean {
  return Object.values(value).some((item) =>
    isPlainObject(item) && Object.values(item).some((nested) => isPlainObject(nested)),
  );
}

function renderObjectEntries(value: Record<string, unknown>): ReactNode {
  if (hasDeepNestedObject(value)) {
    return (
      <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      {Object.entries(value).map(([key, item]) => (
        <div key={key} className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{key}</div>
          <div className="mt-1 break-all text-slate-800">
            {isPlainObject(item) ? renderObjectEntries(item) : formatValue(item)}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400">-</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-400">-</span>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {value.map((item, index) => (
          <Tag key={`${String(item)}-${index}`}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</Tag>
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    return renderObjectEntries(value);
  }

  return <span>{String(value)}</span>;
}

function buildExtraEntries(rawData: Record<string, unknown>, excludedKeys: string[]) {
  const excludedKeySet = new Set(excludedKeys);

  return Object.entries(rawData).filter(([key, value]) => !excludedKeySet.has(key) && value !== undefined && value !== null && value !== '');
}

interface DetailPanelProps {
  node?: AdaptedGraphNode | null;
  edge?: AdaptedGraphEdge | null;
  nodeLookup: Map<string, AdaptedGraphNode>;
}

export function DetailPanel({ node, edge, nodeLookup }: DetailPanelProps) {
  const sourceNode = edge ? nodeLookup.get(edge.source) : undefined;
  const targetNode = edge ? nodeLookup.get(edge.target) : undefined;

  return (
    <aside className="h-full rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="text-sm font-semibold text-slate-900">详情面板</div>
        <div className="mt-1 text-xs text-slate-500">点击节点或边后，在这里查看结构化信息。</div>
      </div>

      <div className="h-[calc(100%-73px)] overflow-auto px-5 py-4">
        {!node && !edge ? (
          <div className="flex h-full items-center justify-center">
            <Empty description="请选择节点或边查看详情" />
          </div>
        ) : null}

        {node ? (
          <div className="space-y-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">{node.fullLabel}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {node.level ? <Tag color="blue">{node.level}</Tag> : null}
                {node.nodeType ? <Tag>{node.nodeType}</Tag> : null}
                <Tag color="gold">度数 {node.degree}</Tag>
              </div>
            </div>

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="ID">{node.id}</Descriptions.Item>
              <Descriptions.Item label="展示标签">{node.label}</Descriptions.Item>
              <Descriptions.Item label="完整名称">{node.fullLabel}</Descriptions.Item>
              <Descriptions.Item label="职级">{node.level ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="节点类型">{node.nodeType ?? '-'}</Descriptions.Item>
            </Descriptions>

            <Descriptions column={1} size="small" bordered title="原始字段">
              {buildExtraEntries(node.rawData, ['id', 'label', 'name', 'node_type', 'type', 'level']).map(([key, value]) => (
                <Descriptions.Item key={key} label={key}>
                  {formatValue(value)}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </div>
        ) : null}

        {edge ? (
          <div className="space-y-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">关系详情</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Tag color={edge.edgeType === 'vertical' ? 'blue' : edge.edgeType === 'transition' ? 'green' : 'default'}>
                  {edge.edgeType}
                </Tag>
                {typeof edge.weight === 'number' ? <Tag color="gold">权重 {edge.weight}</Tag> : null}
              </div>
            </div>

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="关系 ID">{edge.id}</Descriptions.Item>
              <Descriptions.Item label="来源节点">{sourceNode?.fullLabel ?? edge.source}</Descriptions.Item>
              <Descriptions.Item label="目标节点">{targetNode?.fullLabel ?? edge.target}</Descriptions.Item>
              <Descriptions.Item label="关系类型">{edge.edgeType}</Descriptions.Item>
              <Descriptions.Item label="权重">{edge.weight ?? '-'}</Descriptions.Item>
            </Descriptions>

            <Descriptions column={1} size="small" bordered title="原始字段">
              {buildExtraEntries(edge.rawData, ['id', 'source', 'target', 'edge_type', 'type', 'weight']).map(([key, value]) => (
                <Descriptions.Item key={key} label={key}>
                  {formatValue(value)}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
