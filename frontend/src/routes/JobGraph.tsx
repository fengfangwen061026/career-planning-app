import { useState, useEffect, useRef } from 'react';
import { Card, Select, Empty, message, Tooltip, Button, Space } from 'antd';
import { ReloadOutlined, AppstoreOutlined, BorderOutlined, TableOutlined } from '@ant-design/icons';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import client from '../api/client';
import LoadingState from '../components/LoadingState';

// Type for Cytoscape style to avoid TS issues with custom properties
type CytoscapeStyle = Record<string, unknown>;

// Cytoscape element type from API
interface CytoscapeElement {
  data: {
    id?: string;
    label?: string;
    source?: string;
    target?: string;
    type?: string;
    level?: string;
    name?: string;
    description?: string;
    weight?: number;
    // For edges
    edge_type?: string;
    explanation?: Record<string, unknown>;
    // For nodes
    node_type?: string;
    metadata?: Record<string, unknown>;
  };
}

interface CytoscapeResponse {
  elements: CytoscapeElement[];
}

interface JobProfile {
  id: string;
  name: string;
  level?: string;
  description?: string;
  skills?: string[];
  requirements?: Record<string, unknown>;
}

const LEVEL_COLORS: Record<string, string> = {
  entry: '#52c41a',    // 绿色 - 初级
  growing: '#1890ff', // 蓝色 - 中级
  mature: '#722ed1',  // 紫色 - 高级
  expert: '#fa541c', // 橙色 - 专家
};

const LEVEL_SIZES: Record<string, number> = {
  entry: 40,
  growing: 50,
  mature: 60,
  expert: 70,
};

const EDGE_TYPE_LABELS: Record<string, string> = {
  vertical: '晋升',
  transition: '换岗',
};

const LAYOUTS = [
  { value: 'cose', label: '自动布局', icon: AppstoreOutlined },
  { value: 'circle', label: '圆形布局', icon: BorderOutlined },
  { value: 'grid', label: '网格布局', icon: TableOutlined },
];

export default function JobGraph() {
  const [graphData, setGraphData] = useState<CytoscapeElement[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<JobProfile | null>(null);
  const [currentLayout, setCurrentLayout] = useState('cose');
  const [edgeTypeFilter, setEdgeTypeFilter] = useState<string | undefined>(undefined);
  const cyRef = useRef<Core | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch graph data from API
  useEffect(() => {
    fetchGraphData();
  }, [edgeTypeFilter]);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current || graphData.length === 0) return;

    // Destroy existing instance
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: graphData as ElementDefinition[],
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 8,
            'font-size': '12px',
            'color': '#595959',
            'background-color': 'data(color)',
            'width': 'data(size)',
            'height': 'data(size)',
            'border-width': 2,
            'border-color': '#ffffff',
          } as CytoscapeStyle,
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#1890ff',
          } as CytoscapeStyle,
        },
        {
          selector: 'edge[type="vertical"]',
          style: {
            'width': 3,
            'line-color': '#1890ff',
            'target-arrow-color': '#1890ff',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'line-style': 'solid',
          } as CytoscapeStyle,
        },
        {
          selector: 'edge[type="transition"]',
          style: {
            'width': 2,
            'line-color': '#52c41a',
            'target-arrow-color': '#52c41a',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'line-style': 'dashed',
            'line-dash-pattern': [8, 4],
          } as CytoscapeStyle,
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 4,
            'line-color': '#fa541c',
            'target-arrow-color': '#fa541c',
          } as CytoscapeStyle,
        },
      ],
      layout: {
        name: currentLayout,
        animate: true,
        animationDuration: 500,
      } as cytoscape.LayoutOptions,
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.3,
    });

    // Node click event - show tooltip
    cy.on('tap', 'node', async (evt) => {
      const node = evt.target;
      const nodeData = node.data() as Record<string, unknown>;

      // Show basic info in tooltip
      setSelectedNode({
        id: (nodeData.id as string) || '',
        name: (nodeData.label as string) || (nodeData.name as string) || '',
        level: nodeData.level as string | undefined,
        description: (nodeData.description as string) || '',
      });

      // Optionally fetch detailed profile from API
      try {
        const response = await client.get(`/graph/nodes/${nodeData.id}`);
        if (response.data) {
          setSelectedNode({
            id: response.data.id || (nodeData.id as string),
            name: response.data.name || (nodeData.label as string),
            level: response.data.level,
            description: response.data.description || '',
            skills: response.data.metadata?.skills as string[] || [],
            requirements: response.data.metadata,
          });
        }
      } catch {
        // Use basic data if API fails
        console.log('Using basic node data');
      }
    });

    // Background click - deselect
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    // Enable drag
    cy.on('dragfree', 'node', (evt) => {
      const node = evt.target;
      // Optionally save position
      console.log('Node moved:', node.id(), node.position());
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [graphData, currentLayout]);

  const fetchGraphData = async () => {
    setLoading(true);
    try {
      const params = edgeTypeFilter ? { edge_type: edgeTypeFilter } : {};
      const response = await client.get<CytoscapeResponse>('/graph/cytoscape', { params });

      // Transform data for Cytoscape
      const elements = response.data.elements.map((el) => {
        // Node
        if (el.data.id && el.data.label) {
          const level = el.data.level || 'entry';
          return {
            ...el,
            data: {
              ...el.data,
              color: LEVEL_COLORS[level] || LEVEL_COLORS.entry,
              size: LEVEL_SIZES[level] || LEVEL_SIZES.entry,
            },
          };
        }
        // Edge
        if (el.data.source && el.data.target) {
          return {
            ...el,
            data: {
              ...el.data,
              type: el.data.edge_type || 'vertical',
              label: el.data.edge_type ? EDGE_TYPE_LABELS[el.data.edge_type] : undefined,
            },
          };
        }
        return el;
      });

      setGraphData(elements);
    } catch {
      message.error('获取图谱数据失败');
      // Use mock data if API fails
      setGraphData(getMockData());
    } finally {
      setLoading(false);
    }
  };

  const getMockData = (): CytoscapeElement[] => {
    return [
      // Nodes
      { data: { id: '1', label: '初级前端工程师', level: 'entry', node_type: 'role' } },
      { data: { id: '2', label: '中级前端工程师', level: 'growing', node_type: 'role' } },
      { data: { id: '3', label: '高级前端工程师', level: 'mature', node_type: 'role' } },
      { data: { id: '4', label: '前端技术专家', level: 'expert', node_type: 'role' } },
      { data: { id: '5', label: '前端架构师', level: 'expert', node_type: 'role' } },
      { data: { id: '6', label: '初级后端工程师', level: 'entry', node_type: 'role' } },
      { data: { id: '7', label: '中级后端工程师', level: 'growing', node_type: 'role' } },
      // Edges - vertical (promotion)
      { data: { source: '1', target: '2', edge_type: 'vertical', type: 'vertical', weight: 1 } },
      { data: { source: '2', target: '3', edge_type: 'vertical', type: 'vertical', weight: 2 } },
      { data: { source: '3', target: '4', edge_type: 'vertical', type: 'vertical', weight: 3 } },
      { data: { source: '3', target: '5', edge_type: 'vertical', type: 'vertical', weight: 3 } },
      // Edges - transition (career change)
      { data: { source: '1', target: '6', edge_type: 'transition', type: 'transition', weight: 0.5 } },
      { data: { source: '2', target: '7', edge_type: 'transition', type: 'transition', weight: 0.6 } },
    ].map((el) => {
      if (el.data.id) {
        const level = el.data.level as string || 'entry';
        return {
          ...el,
          data: {
            ...el.data,
            color: LEVEL_COLORS[level] || LEVEL_COLORS.entry,
            size: LEVEL_SIZES[level] || LEVEL_SIZES.entry,
          },
        };
      }
      return el;
    }) as CytoscapeElement[];
  };

  const handleLayoutChange = (layout: string) => {
    setCurrentLayout(layout);
    if (cyRef.current) {
      const layoutInstance = cyRef.current.layout({
        name: layout,
        animate: true,
        animationDuration: 500,
      } as cytoscape.LayoutOptions);
      layoutInstance.run();
    }
  };

  const handleRefresh = () => {
    fetchGraphData();
  };

  // Get unique nodes for select dropdown
  const nodeOptions = graphData
    .filter((el) => el.data.id && el.data.label)
    .map((el) => ({
      value: el.data.id!,
      label: el.data.label!,
    }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">岗位图谱</h1>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* Control Panel */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">起始岗位:</span>
            <Select
              placeholder="选择起始岗位"
              style={{ width: 200 }}
              allowClear
              options={nodeOptions}
              onChange={(value) => {
                if (value && cyRef.current) {
                  const node = cyRef.current.getElementById(value);
                  if (node) {
                    cyRef.current.fit(node, 100);
                    node.select();
                  }
                }
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-600">边类型:</span>
            <Select
              placeholder="全部"
              style={{ width: 120 }}
              allowClear
              value={edgeTypeFilter}
              onChange={setEdgeTypeFilter}
              options={[
                { value: 'vertical', label: '晋升路径' },
                { value: 'transition', label: '换岗路径' },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-600">布局:</span>
            <Space.Compact>
              {LAYOUTS.map((layout) => (
                <Tooltip key={layout.value} title={layout.label}>
                  <Button
                    type={currentLayout === layout.value ? 'primary' : 'default'}
                    icon={<layout.icon />}
                    onClick={() => handleLayoutChange(layout.value)}
                  />
                </Tooltip>
              ))}
            </Space.Compact>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">职级:</span>
              {Object.entries(LEVEL_COLORS).map(([level, color]) => (
                <div key={level} className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-gray-500">
                    {level === 'entry' ? '初级' :
                     level === 'growing' ? '中级' :
                     level === 'mature' ? '高级' : '专家'}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">路径:</span>
              <div className="flex items-center gap-1">
                <div className="w-6 h-0.5 bg-blue-500" />
                <span className="text-gray-500">晋升</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-0.5 border-t-2 border-dashed border-green-500" />
                <span className="text-gray-500">换岗</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Graph Container */}
      <Card bodyStyle={{ padding: 0 }}>
        {loading ? (
          <div className="h-[600px] flex items-center justify-center">
            <LoadingState />
          </div>
        ) : graphData.length === 0 ? (
          <Empty
            className="h-[600px] flex items-center justify-center"
            description="暂无图谱数据，请先构建图谱"
          >
            <Button type="primary" onClick={handleRefresh}>
              加载数据
            </Button>
          </Empty>
        ) : (
          <div className="relative">
            <div
              ref={containerRef}
              className="h-[600px] w-full bg-gray-50"
              style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)' }}
            />

            {/* Node Info Panel */}
            {selectedNode && (
              <div className="absolute top-4 right-4 w-72 bg-white rounded-lg shadow-lg p-4 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {selectedNode.name}
                    </h3>
                    {selectedNode.level && (
                      <span
                        className="inline-block px-2 py-0.5 text-xs rounded-full text-white mt-1"
                        style={{ backgroundColor: LEVEL_COLORS[selectedNode.level] || LEVEL_COLORS.entry }}
                      >
                        {selectedNode.level === 'entry' ? '初级' :
                         selectedNode.level === 'growing' ? '中级' :
                         selectedNode.level === 'mature' ? '高级' : '专家'}
                      </span>
                    )}
                  </div>
                  <Button
                    type="text"
                    size="small"
                    onClick={() => setSelectedNode(null)}
                  >
                    ✕
                  </Button>
                </div>

                {selectedNode.description && (
                  <p className="text-gray-600 text-sm mt-2">
                    {selectedNode.description}
                  </p>
                )}

                {selectedNode.skills && selectedNode.skills.length > 0 && (
                  <div className="mt-3">
                    <span className="text-gray-500 text-sm">技能要求:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedNode.skills.slice(0, 6).map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded"
                        >
                          {skill}
                        </span>
                      ))}
                      {selectedNode.skills.length > 6 && (
                        <span className="text-gray-400 text-xs">
                          +{selectedNode.skills.length - 6}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-gray-400 text-xs">
                    ID: {selectedNode.id}
                  </span>
                </div>
              </div>
            )}

            {/* Interaction Tips */}
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-500 shadow">
              <div>拖拽: 移动节点</div>
              <div>滚轮: 缩放</div>
              <div>点击: 查看详情</div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
