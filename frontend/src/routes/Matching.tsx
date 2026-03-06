import { useState, useEffect } from 'react';
import {
  Card,
  Select,
  Button,
  Row,
  Col,
  Empty,
  message,
  Progress,
  Tag,
  Space,
  Steps,
  Badge,
  Divider,
  List,
} from 'antd';
import {
  PlayCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  AimOutlined,
  ThunderboltOutlined,
  BookOutlined,
  HeartOutlined,
  StarOutlined,
  ArrowRightOutlined,
  WarningOutlined,
  RocketOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { studentsApi } from '../api/students';
import { matchingApi } from '../api/matching';
import { jobsApi } from '../api/jobs';
import client from '../api/client';
import type { StudentResponse } from '../types/student';
import type { JobResponse, RoleResponse } from '../types/job';
import type { MatchResultResponse, GapItem, MatchingResponse } from '../types/matching';
import LoadingState from '../components/LoadingState';

// Score color helper
const getScoreColor = (score: number): string => {
  if (score >= 80) return '#52c41a'; // green
  if (score >= 60) return '#faad14'; // yellow
  return '#ff4d4f'; // red
};

// Gap priority helper
const getGapPriorityInfo = (priority: string) => {
  switch (priority) {
    case 'high':
      return { color: '#ff4d4f', label: '高优先', icon: <CloseCircleOutlined /> };
    case 'medium':
      return { color: '#faad14', label: '中优先', icon: <ExclamationCircleOutlined /> };
    case 'low':
      return { color: '#52c41a', label: '低优先', icon: <CheckCircleOutlined /> };
    default:
      return { color: '#8c8c8c', label: '未知', icon: null };
  }
};

// Career path types (from graph API)
interface CareerPathResult {
  from_role: string;
  from_level: string;
  to_role: string;
  to_level: string;
  path: Array<{
    node_id: string;
    name: string;
    level: string;
    node_type: string;
    edge?: {
      edge_type: string;
      weight: number;
      explanation: Record<string, unknown>;
    };
  }>;
  total_steps: number;
}

export default function Matching() {
  const [students, setStudents] = useState<StudentResponse[]>([]);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResultResponse[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);

  // Expanded card state
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [targetResultId, setTargetResultId] = useState<string | null>(null);
  const [careerPaths, setCareerPaths] = useState<CareerPathResult[]>([]);
  const [loadingPath, setLoadingPath] = useState(false);

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studentsRes, rolesRes] = await Promise.all([
        studentsApi.getStudents(),
        jobsApi.getRoles(),
      ]);
      setStudents(studentsRes.data);
      setRoles(rolesRes.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const runMatching = async () => {
    if (!selectedStudent) {
      message.warning('请先选择学生');
      return;
    }
    setMatching(true);
    setMatchResults([]);
    setExpandedResultId(null);
    setTargetResultId(null);
    setCareerPaths([]);
    try {
      const response = await matchingApi.recommendJobs(selectedStudent, { top_k: 10 });
      setMatchResults(response.data.results);
      message.success('匹配完成');
    } catch (error) {
      message.error('匹配失败');
    } finally {
      setMatching(false);
    }
  };

  const fetchCareerPath = async (roleName: string) => {
    if (!selectedStudent) return;

    setLoadingPath(true);
    try {
      // Use the graph career-path endpoint
      const response = await client.post<CareerPathResult[]>('/graph/career-path', {
        from_role: '通用',
        to_role: roleName,
        from_level: 'entry',
      });
      setCareerPaths(response.data);
      message.success('职业路径规划完成');
    } catch (error) {
      console.error('Career path error:', error);
      message.error('获取职业路径失败');
      setCareerPaths([]);
    } finally {
      setLoadingPath(false);
    }
  };

  // Prepare radar chart data for four dimensions
  const getRadarData = (result: MatchResultResponse) => {
    const scores = result.scores;
    return [
      { subject: '基础要求', A: scores.basic.score, B: 80, fullMark: 100 },
      { subject: '职业技能', A: scores.skill.score, B: 80, fullMark: 100 },
      { subject: '职业素养', A: scores.competency.score, B: 80, fullMark: 100 },
      { subject: '发展潜力', A: scores.potential.score, B: 80, fullMark: 100 },
    ];
  };

  // Render skill progress bar for four dimensions
  const renderDimensionProgress = (result: MatchResultResponse) => {
    const scores = result.scores;

    const dimensions = [
      { key: 'basic', label: '基础', score: scores.basic.score, icon: <SafetyOutlined className="text-blue-500" /> },
      { key: 'skill', label: '技能', score: scores.skill.score, icon: <ThunderboltOutlined className="text-purple-500" /> },
      { key: 'competency', label: '素养', score: scores.competency.score, icon: <StarOutlined className="text-green-500" /> },
      { key: 'potential', label: '潜力', score: scores.potential.score, icon: <RocketOutlined className="text-pink-500" /> },
    ];

    return (
      <div className="space-y-2 mt-3">
        {dimensions.map(dim => (
          <div key={dim.key} className="flex items-center gap-2">
            {dim.icon}
            <span className="text-xs text-gray-500 w-10">{dim.label}</span>
            <Progress
              percent={dim.score}
              size="small"
              strokeColor={getScoreColor(dim.score)}
              format={(p) => `${p?.toFixed(0)}%`}
              className="flex-1"
            />
          </div>
        ))}
      </div>
    );
  };

  // Render expanded details for a result
  const renderExpandedDetails = (result: MatchResultResponse) => {
    const isTarget = targetResultId === result.id;

    return (
      <div className="bg-gray-50 p-4 rounded-b-lg border-t">
        <Row gutter={24}>
          {/* Radar Chart */}
          <Col xs={24} lg={10}>
            <Card title="四维能力对比雷达图" size="small" className="h-full">
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={getRadarData(result)}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="学生能力"
                    dataKey="A"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                  />
                  <Radar
                    name="岗位要求"
                    dataKey="B"
                    stroke="#82ca9d"
                    fill="#82ca9d"
                    fillOpacity={0.6}
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          {/* Gap Analysis */}
          <Col xs={24} lg={14}>
            <Card title="差距分析清单" size="small" className="h-full">
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {result.gaps.length > 0 ? (
                  result.gaps
                    .sort((a, b) => {
                      const order = { high: 0, medium: 1, low: 2 };
                      return (order[a.priority as keyof typeof order] ?? 3) - (order[b.priority as keyof typeof order] ?? 3);
                    })
                    .map((gap, idx) => {
                      const info = getGapPriorityInfo(gap.priority);
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-2 rounded border-l-4 ${
                            gap.priority === 'low' ? 'bg-green-50' :
                            gap.priority === 'medium' ? 'bg-yellow-50' : 'bg-red-50'
                          }`}
                          style={{ borderLeftColor: info.color }}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span style={{ color: info.color }}>{info.icon}</span>
                              <span className="font-medium text-sm">{gap.gap_item}</span>
                              <Tag color="blue" className="text-xs">{gap.dimension}</Tag>
                            </div>
                            <div className="text-xs text-gray-500 ml-6 mt-1">
                              {gap.current_level} → {gap.required_level}: {gap.suggestion}
                            </div>
                          </div>
                          <Tag color={info.color}>{info.label}</Tag>
                        </div>
                      );
                    })
                ) : (
                  <Empty description="无差距项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </div>
            </Card>
          </Col>
        </Row>

        {/* Match Reasons */}
        <Row gutter={24} className="mt-4">
          <Col span={24}>
            <Card title="匹配原因" size="small">
              <Space wrap>
                {result.match_reasons?.map((reason, idx) => (
                  <Tag key={idx} color="blue" className="text-sm">
                    {reason}
                  </Tag>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Set Target Button */}
        <div className="mt-4 flex justify-center">
          <Button
            type={isTarget ? 'default' : 'primary'}
            icon={<AimOutlined />}
            size="large"
            onClick={() => {
              setTargetResultId(result.id);
              // Try to find role name from metadata or use job_profile_id
              // In a real scenario, we'd need to resolve the role name
              // For now, just set it
            }}
            disabled={isTarget}
            className={isTarget ? 'bg-green-50 border-green-500 text-green-600' : ''}
          >
            {isTarget ? '当前目标岗位' : '设为目标岗位'}
          </Button>
        </div>
      </div>
    );
  };

  // Render career path
  const renderCareerPath = () => {
    if (!targetResultId || !selectedStudent) return null;

    if (loadingPath) {
      return (
        <Card title="职业路径规划" className="mt-4">
          <LoadingState />
        </Card>
      );
    }

    if (careerPaths.length === 0) {
      return (
        <Card title="职业路径规划" className="mt-4">
          <Empty description="暂无职业路径数据" />
        </Card>
      );
    }

    return (
      <div className="mt-4 space-y-4">
        {careerPaths.map((pathResult, pathIdx) => (
          <Card
            key={pathIdx}
            title={
              <div className="flex items-center gap-2">
                <ThunderboltOutlined className="text-yellow-500" />
                <span>路径方案 {pathIdx + 1}: {pathResult.from_role} → {pathResult.to_role}</span>
                <Tag color="blue">{pathResult.to_level}</Tag>
                <Tag color="green">{pathResult.total_steps} 步</Tag>
              </div>
            }
          >
            <Steps
              current={pathResult.path.length - 1}
              direction="vertical"
              size="small"
              items={pathResult.path.map((step, idx) => ({
                title: (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{step.name}</span>
                    <Space>
                      <Tag color="blue">{step.level}</Tag>
                      {step.edge && (
                        <Tag color={step.edge.edge_type === 'vertical' ? 'cyan' : 'green'}>
                          {step.edge.edge_type === 'vertical' ? '晋升' : '转岗'}
                        </Tag>
                      )}
                    </Space>
                  </div>
                ),
                description: step.edge?.explanation ? (
                  <div className="text-gray-600 mt-1 text-sm">
                    {(step.edge.explanation as Record<string, string>).description || ''}
                  </div>
                ) : undefined,
                icon: (
                  <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                    {idx + 1}
                  </div>
                ),
              }))}
            />
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">岗位匹配推荐</h1>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Control Panel */}
      <Card className="mb-4">
        <Row gutter={16} align="middle">
          <Col>
            <span className="text-gray-600 mr-2">学生:</span>
            <Select
              placeholder="选择学生"
              style={{ width: 200 }}
              value={selectedStudent}
              onChange={(value) => {
                setSelectedStudent(value);
                setMatchResults([]);
                setExpandedResultId(null);
                setTargetResultId(null);
                setCareerPaths([]);
              }}
              allowClear
              options={students.map((s) => ({
                value: s.id,
                label: s.name || s.email,
              }))}
            />
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={matching}
              onClick={runMatching}
              disabled={!selectedStudent}
            >
              开始匹配
            </Button>
          </Col>
        </Row>
      </Card>

      {loading ? (
        <LoadingState />
      ) : matchResults.length === 0 ? (
        <Card>
          <Empty description="暂无匹配结果，请先选择学生并点击开始匹配">
            <p className="text-gray-400">匹配结果将显示学生与岗位的四维匹配度</p>
          </Empty>
        </Card>
      ) : (
        <>
          {/* Result Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {matchResults.map((result, index) => {
              const isExpanded = expandedResultId === result.id;
              const isTarget = targetResultId === result.id;

              return (
                <Card
                  key={result.id}
                  className={`relative transition-all duration-300 ${
                    isTarget ? 'ring-2 ring-green-500 shadow-lg' : ''
                  } ${isExpanded ? 'shadow-lg' : 'hover:shadow-md'}`}
                  hoverable={!isExpanded}
                  onClick={() => setExpandedResultId(isExpanded ? null : result.id)}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        匹配结果 #{index + 1}
                      </h3>
                      <p className="text-gray-500 text-sm">
                        岗位画像: {result.job_profile_id.slice(0, 8)}...
                      </p>
                    </div>
                    {isTarget && (
                      <Badge
                        count="目标"
                        style={{ backgroundColor: '#52c41a' }}
                      />
                    )}
                  </div>

                  {/* Overall Score */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-600">综合评分</span>
                      <span
                        className="text-2xl font-bold"
                        style={{ color: getScoreColor(result.total_score) }}
                      >
                        {result.total_score.toFixed(0)}
                      </span>
                    </div>
                    <Progress
                      percent={result.total_score}
                      strokeColor={getScoreColor(result.total_score)}
                      showInfo={false}
                    />
                  </div>

                  {/* Mini Dimension Progress */}
                  {renderDimensionProgress(result)}

                  {/* Rank Badge */}
                  <div className="absolute top-2 right-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Expanded Details */}
          {expandedResultId && (
            <Card className="mt-4">
              {(() => {
                const result = matchResults.find(r => r.id === expandedResultId);
                if (!result) return null;
                return renderExpandedDetails(result);
              })()}
            </Card>
          )}

          {/* Career Path Section */}
          {renderCareerPath()}
        </>
      )}
    </div>
  );
}
