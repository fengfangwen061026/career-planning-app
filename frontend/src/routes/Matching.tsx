import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Row,
  Col,
  Empty,
  message,
  Progress,
  Badge,
  Tabs,
  Tag,
  List,
} from 'antd';
import {
  RocketOutlined,
  ThunderboltOutlined,
  StarOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  AimOutlined,
  BookOutlined,
  ToolOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { studentsApi } from '../api/students';
import { matchingApi } from '../api/matching';
import { jobsApi } from '../api/jobs';
import type { StudentResponse } from '../types/student';
import type { RoleResponse } from '../types/job';
import type { MatchResultResponse, GapItem } from '../types/matching';
import LoadingState from '../components/LoadingState';

// Score color helper
const getScoreColor = (score: number): string => {
  if (score >= 80) return '#52c41a'; // green
  if (score >= 60) return '#faad14'; // yellow
  return '#ff4d4f'; // red;
};

// Gap priority helper
const getGapPriorityInfo = (priority: string) => {
  switch (priority) {
    case 'high':
      return { color: '#ff4d4f', label: '高优先', icon: <CloseCircleOutlined />, bgColor: '#fff2f0' };
    case 'medium':
      return { color: '#faad14', label: '中优先', icon: <ExclamationCircleOutlined />, bgColor: '#fffbe6' };
    case 'low':
      return { color: '#52c41a', label: '低优先', icon: <CheckCircleOutlined />, bgColor: '#f6ffed' };
    default:
      return { color: '#8c8c8c', label: '未知', icon: null, bgColor: '#fafafa' };
  }
};

// Action plan bucket type
type ActionBucket = 'immediate' | 'near_term' | 'long_term';

interface ActionItem {
  action: string;
  reason: string;
  gap_item: string;
}

// Generate action items from missing skills
const generateActionPlan = (gaps: GapItem[]): Record<ActionBucket, ActionItem[]> => {
  const immediate: ActionItem[] = [];  // 立即开始 - 必备技能缺失
  const nearTerm: ActionItem[] = [];  // 近期补充 - 优选技能
  const longTerm: ActionItem[] = [];  // 长期规划 - 素养/潜力提升

  gaps.forEach(gap => {
    const actionItem: ActionItem = {
      action: gap.suggestion,
      reason: `${gap.current_level} → ${gap.required_level}`,
      gap_item: gap.gap_item,
    };

    // 高优先级的技能差距 - 立即开始
    if (gap.dimension === 'skill' && gap.priority === 'high') {
      immediate.push(actionItem);
    }
    // 中优先级的技能差距 - 近期补充
    else if (gap.dimension === 'skill' && gap.priority === 'medium') {
      nearTerm.push(actionItem);
    }
    // 素养和潜力差距 - 长期规划
    else if (gap.dimension === 'competency' || gap.dimension === 'potential') {
      longTerm.push(actionItem);
    }
    // 基础差距 - 近期补充
    else if (gap.dimension === 'basic') {
      nearTerm.push(actionItem);
    }
    // 其他低优先级
    else {
      longTerm.push(actionItem);
    }
  });

  return { immediate, near_term: nearTerm, long_term: longTerm };
};

export default function Matching() {
  const [students, setStudents] = useState<StudentResponse[]>([]);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResultResponse[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<MatchResultResponse | null>(null);
  const [activeTab, setActiveTab] = useState('1');

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

  // 一键推荐
  const runRecommend = async () => {
    if (!selectedStudent) {
      message.warning('请先选择学生');
      return;
    }
    setMatching(true);
    setMatchResults([]);
    setSelectedResult(null);
    try {
      const response = await matchingApi.recommendJobs(selectedStudent, { top_k: 10 });
      setMatchResults(response.data.results);
      // Auto-select the first result
      if (response.data.results.length > 0) {
        setSelectedResult(response.data.results[0]);
      }
      message.success('推荐完成');
    } catch (error) {
      message.error('推荐失败');
    } finally {
      setMatching(false);
    }
  };

  // Single job matching
  const runSingleMatch = async (jobProfileId: string) => {
    if (!selectedStudent) {
      message.warning('请先选择学生');
      return;
    }
    setMatching(true);
    try {
      const response = await matchingApi.runMatch({
        student_id: selectedStudent,
        job_profile_id: jobProfileId,
      });
      // Update or add the result
      setMatchResults(prev => {
        const existing = prev.findIndex(r => r.job_profile_id === jobProfileId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = response.data;
          return updated;
        }
        return [response.data, ...prev];
      });
      setSelectedResult(response.data);
      message.success('匹配完成');
    } catch (error) {
      message.error('匹配失败');
    } finally {
      setMatching(false);
    }
  };

  // Get gap count by priority
  const getGapCountByPriority = (result: MatchResultResponse) => {
    return {
      high: result.gaps.filter(g => g.priority === 'high').length,
      medium: result.gaps.filter(g => g.priority === 'medium').length,
      low: result.gaps.filter(g => g.priority === 'low').length,
    };
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

  // Get matched and missing skills
  const getSkillAnalysis = (result: MatchResultResponse) => {
    const matched: string[] = [];
    const missing: string[] = [];

    result.scores.skill.items?.forEach(item => {
      if (item.matched) {
        matched.push(item.skill_name);
      } else if (item.importance === 'required') {
        missing.push(item.skill_name);
      }
    });

    return { matched, missing };
  };

  // Render left panel - recommendation list
  const renderLeftPanel = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold mb-3">岗位推荐</h2>
        <div className="flex gap-2">
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={runRecommend}
            loading={matching}
            disabled={!selectedStudent}
            block
          >
            一键推荐
          </Button>
        </div>
      </div>

      {/* Student selector */}
      <div className="p-4 border-b">
        <span className="text-gray-600 text-sm">选择学生:</span>
        <select
          className="ml-2 p-1 border rounded text-sm"
          value={selectedStudent || ''}
          onChange={(e) => {
            setSelectedStudent(e.target.value || null);
            setMatchResults([]);
            setSelectedResult(null);
          }}
        >
          <option value="">请选择...</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>{s.name || s.email}</option>
          ))}
        </select>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto p-2">
        {matchResults.length === 0 ? (
          <Empty
            description={selectedStudent ? '点击"一键推荐"获取匹配结果' : '请先选择学生'}
            className="mt-8"
          />
        ) : (
          <List
            dataSource={matchResults}
            renderItem={(result, index) => {
              const gapCounts = getGapCountByPriority(result);
              const isSelected = selectedResult?.id === result.id;

              return (
                <Card
                  key={result.id}
                  size="small"
                  className={`mb-2 cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-sm'
                  }`}
                  onClick={() => setSelectedResult(result)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {result.role_name || `岗位 #${index + 1}`}
                      </div>
                      <div className="text-xs text-gray-500">排名 #{index + 1}</div>
                    </div>
                    <div
                      className="text-2xl font-bold ml-2"
                      style={{ color: getScoreColor(result.total_score) }}
                    >
                      {result.total_score.toFixed(0)}
                    </div>
                  </div>

                  {/* Score bar */}
                  <Progress
                    percent={result.total_score}
                    strokeColor={getScoreColor(result.total_score)}
                    showInfo={false}
                    size="small"
                  />

                  {/* Four dimension progress bars */}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1">
                      <SafetyOutlined className="text-blue-500 text-xs" />
                      <span className="text-xs text-gray-500 w-8">基础</span>
                      <Progress
                        percent={result.scores.basic.score}
                        size="small"
                        strokeColor={getScoreColor(result.scores.basic.score)}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <ThunderboltOutlined className="text-purple-500 text-xs" />
                      <span className="text-xs text-gray-500 w-8">技能</span>
                      <Progress
                        percent={result.scores.skill.score}
                        size="small"
                        strokeColor={getScoreColor(result.scores.skill.score)}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <StarOutlined className="text-green-500 text-xs" />
                      <span className="text-xs text-gray-500 w-8">素养</span>
                      <Progress
                        percent={result.scores.competency.score}
                        size="small"
                        strokeColor={getScoreColor(result.scores.competency.score)}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <RocketOutlined className="text-pink-500 text-xs" />
                      <span className="text-xs text-gray-500 w-8">潜力</span>
                      <Progress
                        percent={result.scores.potential.score}
                        size="small"
                        strokeColor={getScoreColor(result.scores.potential.score)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  {/* Gap badges */}
                  <div className="mt-2 flex gap-1">
                    {gapCounts.high > 0 && (
                      <Badge count={gapCounts.high} style={{ backgroundColor: '#ff4d4f' }} />
                    )}
                    {gapCounts.medium > 0 && (
                      <Badge count={gapCounts.medium} style={{ backgroundColor: '#faad14' }} />
                    )}
                    {gapCounts.low > 0 && (
                      <Badge count={gapCounts.low} style={{ backgroundColor: '#52c41a' }} />
                    )}
                    {gapCounts.high + gapCounts.medium + gapCounts.low === 0 && (
                      <Tag color="success" className="text-xs">无差距</Tag>
                    )}
                  </div>
                </Card>
              );
            }}
          />
        )}
      </div>
    </div>
  );

  // Render Tab1: 匹配分析
  const renderMatchAnalysis = () => {
    if (!selectedResult) return <Empty description="请选择一个岗位" />;

    const radarData = getRadarData(selectedResult);
    const { matched, missing } = getSkillAnalysis(selectedResult);

    return (
      <Row gutter={[16, 16]}>
        {/* Radar Chart */}
        <Col xs={24} lg={12}>
          <Card title="四维能力对比雷达图" size="small">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
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

        {/* Skill Analysis */}
        <Col xs={24} lg={12}>
          <Card title="技能匹配分析" size="small">
            {matched.length > 0 ? (
              <div className="mb-4">
                <div className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
                  <CheckCircleOutlined /> 已匹配技能 ({matched.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {matched.slice(0, 15).map((skill, idx) => (
                    <Tag key={idx} color="success">{skill}</Tag>
                  ))}
                  {matched.length > 15 && <Tag color="success">+{matched.length - 15}</Tag>}
                </div>
              </div>
            ) : null}

            {missing.length > 0 ? (
              <div>
                <div className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
                  <CloseCircleOutlined /> 缺失技能 ({missing.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {missing.slice(0, 15).map((skill, idx) => (
                    <Tag key={idx} color="error">{skill}</Tag>
                  ))}
                  {missing.length > 15 && <Tag color="error">+{missing.length - 15}</Tag>}
                </div>
              </div>
            ) : (
              <div className="text-green-600 flex items-center gap-1">
                <CheckCircleOutlined /> 所有必备技能已匹配
              </div>
            )}

            {/* Skill score chart */}
            <div className="mt-4">
              <div className="text-sm font-medium mb-2">技能得分分布</div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart
                  data={[
                    { name: '必备', score: selectedResult.scores.skill.required_score || 0 },
                    { name: '优选', score: selectedResult.scores.skill.preferred_score || 0 },
                    { name: '加分', score: selectedResult.scores.skill.bonus_score || 0 },
                  ]}
                  layout="vertical"
                >
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" width={40} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                    {['#ff4d4f', '#faad14', '#52c41a'].map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>
    );
  };

  // Render Tab2: 差距清单
  const renderGapList = () => {
    if (!selectedResult) return <Empty description="请选择一个岗位" />;

    const sortedGaps = [...selectedResult.gaps].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority as keyof typeof order] ?? 3) - (order[b.priority as keyof typeof order] ?? 3);
    });

    if (sortedGaps.length === 0) {
      return (
        <Card>
          <Empty description="恭喜！暂无差距项" />
        </Card>
      );
    }

    // Group by priority
    const highGaps = sortedGaps.filter(g => g.priority === 'high');
    const mediumGaps = sortedGaps.filter(g => g.priority === 'medium');
    const lowGaps = sortedGaps.filter(g => g.priority === 'low');

    return (
      <div className="space-y-4">
        {/* High Priority */}
        {highGaps.length > 0 && (
          <Card
            title={
              <span className="text-red-600 flex items-center gap-2">
                <CloseCircleOutlined /> 高优先级差距 ({highGaps.length})
              </span>
            }
            className="border-l-4 border-l-red-500"
          >
            <div className="space-y-3">
              {highGaps.map((gap, idx) => (
                <div key={idx} className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{gap.gap_item}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {gap.current_level} → {gap.required_level}
                      </div>
                      <div className="text-sm text-blue-600 mt-2">{gap.suggestion}</div>
                    </div>
                    <Tag color="red">高</Tag>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Medium Priority */}
        {mediumGaps.length > 0 && (
          <Card
            title={
              <span className="text-yellow-600 flex items-center gap-2">
                <ExclamationCircleOutlined /> 中优先级差距 ({mediumGaps.length})
              </span>
            }
            className="border-l-4 border-l-yellow-500"
          >
            <div className="space-y-3">
              {mediumGaps.map((gap, idx) => (
                <div key={idx} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{gap.gap_item}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {gap.current_level} → {gap.required_level}
                      </div>
                      <div className="text-sm text-blue-600 mt-2">{gap.suggestion}</div>
                    </div>
                    <Tag color="gold">中</Tag>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Low Priority */}
        {lowGaps.length > 0 && (
          <Card
            title={
              <span className="text-green-600 flex items-center gap-2">
                <CheckCircleOutlined /> 低优先级差距 ({lowGaps.length})
              </span>
            }
            className="border-l-4 border-l-green-500"
          >
            <div className="space-y-3">
              {lowGaps.map((gap, idx) => (
                <div key={idx} className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{gap.gap_item}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {gap.current_level} → {gap.required_level}
                      </div>
                      <div className="text-sm text-blue-600 mt-2">{gap.suggestion}</div>
                    </div>
                    <Tag color="green">低</Tag>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  };

  // Render Tab3: 行动计划
  const renderActionPlan = () => {
    if (!selectedResult) return <Empty description="请选择一个岗位" />;

    const actionPlan = generateActionPlan(selectedResult.gaps);

    const bucketInfo = {
      immediate: {
        title: '立即开始',
        icon: <RocketOutlined />,
        color: '#ff4d4f',
        bgColor: '#fff2f0',
        description: '必备技能缺失，需要立即学习',
      },
      near_term: {
        title: '近期补充',
        icon: <ClockCircleOutlined />,
        color: '#faad14',
        bgColor: '#fffbe6',
        description: '优选技能和基础条件提升',
      },
      long_term: {
        title: '长期规划',
        icon: <BookOutlined />,
        color: '#52c41a',
        bgColor: '#f6ffed',
        description: '职业素养和潜力持续培养',
      },
    };

    return (
      <div className="space-y-4">
        {/* Immediate bucket */}
        <Card
          title={
            <span className="flex items-center gap-2" style={{ color: bucketInfo.immediate.color }}>
              {bucketInfo.immediate.icon} {bucketInfo.immediate.title}
            </span>
          }
          className="border-l-4"
          style={{ borderLeftColor: bucketInfo.immediate.color }}
        >
          <div className="text-sm text-gray-500 mb-3">{bucketInfo.immediate.description}</div>
          {actionPlan.immediate.length > 0 ? (
            <div className="space-y-2">
              {actionPlan.immediate.map((item, idx) => (
                <div key={idx} className="p-3 rounded-lg" style={{ backgroundColor: bucketInfo.immediate.bgColor }}>
                  <div className="font-medium">{item.gap_item}</div>
                  <div className="text-sm text-gray-600 mt-1">{item.action}</div>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="暂无项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        {/* Near term bucket */}
        <Card
          title={
            <span className="flex items-center gap-2" style={{ color: bucketInfo.near_term.color }}>
              {bucketInfo.near_term.icon} {bucketInfo.near_term.title}
            </span>
          }
          className="border-l-4"
          style={{ borderLeftColor: bucketInfo.near_term.color }}
        >
          <div className="text-sm text-gray-500 mb-3">{bucketInfo.near_term.description}</div>
          {actionPlan.near_term.length > 0 ? (
            <div className="space-y-2">
              {actionPlan.near_term.map((item, idx) => (
                <div key={idx} className="p-3 rounded-lg" style={{ backgroundColor: bucketInfo.near_term.bgColor }}>
                  <div className="font-medium">{item.gap_item}</div>
                  <div className="text-sm text-gray-600 mt-1">{item.action}</div>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="暂无项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        {/* Long term bucket */}
        <Card
          title={
            <span className="flex items-center gap-2" style={{ color: bucketInfo.long_term.color }}>
              {bucketInfo.long_term.icon} {bucketInfo.long_term.title}
            </span>
          }
          className="border-l-4"
          style={{ borderLeftColor: bucketInfo.long_term.color }}
        >
          <div className="text-sm text-gray-500 mb-3">{bucketInfo.long_term.description}</div>
          {actionPlan.long_term.length > 0 ? (
            <div className="space-y-2">
              {actionPlan.long_term.map((item, idx) => (
                <div key={idx} className="p-3 rounded-lg" style={{ backgroundColor: bucketInfo.long_term.bgColor }}>
                  <div className="font-medium">{item.gap_item}</div>
                  <div className="text-sm text-gray-600 mt-1">{item.action}</div>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="暂无项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </div>
    );
  };

  // Render right panel
  const renderRightPanel = () => {
    if (!selectedResult) {
      return (
        <div className="h-full flex items-center justify-center">
          <Empty description="请从左侧选择一个岗位查看详情" />
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {selectedResult.role_name || '目标岗位'}
              </h2>
              <div className="text-sm text-gray-500">
                综合评分:{' '}
                <span
                  className="text-2xl font-bold"
                  style={{ color: getScoreColor(selectedResult.total_score) }}
                >
                  {selectedResult.total_score.toFixed(0)}
                </span>
                /100
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-xs text-gray-500">差距项</div>
                <div className="text-xl font-bold">{selectedResult.gaps.length}</div>
              </div>
            </div>
          </div>

          {/* Summary progress */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              { key: 'basic', label: '基础', score: selectedResult.scores.basic.score, icon: <SafetyOutlined /> },
              { key: 'skill', label: '技能', score: selectedResult.scores.skill.score, icon: <ThunderboltOutlined /> },
              { key: 'competency', label: '素养', score: selectedResult.scores.competency.score, icon: <StarOutlined /> },
              { key: 'potential', label: '潜力', score: selectedResult.scores.potential.score, icon: <RocketOutlined /> },
            ].map(dim => (
              <div key={dim.key} className="text-center p-2 bg-white rounded">
                <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                  {dim.icon} {dim.label}
                </div>
                <div className="text-lg font-bold" style={{ color: getScoreColor(dim.score) }}>
                  {dim.score.toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-y-auto p-4">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: '1',
                label: (
                  <span>
                    <AimOutlined /> 匹配分析
                  </span>
                ),
                children: renderMatchAnalysis(),
              },
              {
                key: '2',
                label: (
                  <span>
                    <ExclamationCircleOutlined /> 差距清单
                  </span>
                ),
                children: renderGapList(),
              },
              {
                key: '3',
                label: (
                  <span>
                    <ToolOutlined /> 行动计划
                  </span>
                ),
                children: renderActionPlan(),
              },
            ]}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">人岗匹配推荐</h1>
        <Button icon={<RocketOutlined />} onClick={fetchData} loading={loading}>
          刷新
        </Button>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="h-[calc(100vh-120px)] flex gap-4">
          {/* Left Panel - 40% */}
          <div className="w-2/5 bg-white rounded-lg shadow overflow-hidden border">
            {renderLeftPanel()}
          </div>

          {/* Right Panel - 60% */}
          <div className="w-3/5 bg-white rounded-lg shadow overflow-hidden border">
            {renderRightPanel()}
          </div>
        </div>
      )}
    </div>
  );
}
