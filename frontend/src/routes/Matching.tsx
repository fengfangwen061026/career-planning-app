import { useState, useEffect } from 'react';
import {
  Button,
  Empty,
  message,
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
import { BarChart2 } from 'lucide-react';
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

// 模块专属色 - 靛蓝色系
const MODULE_COLOR = '#5B6FD4';
const MODULE_BG = '#ECEDFC';

// Score color helper (语义色：绿=优，琥珀=良，珊瑚=差)
const getScoreColor = (score: number): string => {
  if (score >= 80) return '#5E8F6E';
  if (score >= 60) return '#CB8A4A';
  return '#E07B6A';
};

// Total score color helper (for main score display)
const getTotalScoreColor = (score: number): string => {
  if (score >= 80) return '#5E8F6E';
  if (score >= 60) return '#CB8A4A';
  return '#E07B6A';
};

// Dimension color helper (四维专属色)
const getDimensionColor = (dimension: string): string => {
  switch (dimension) {
    case 'basic': return '#5B6FD4';   // 基础要求 - 靛蓝
    case 'skill': return '#4B9AB3';   // 技术技能 - 青蓝
    case 'competency': return '#C4758A'; // 软技能 - 玫瑰粉
    case 'potential': return '#5E8F6E';   // 发展潜力 - 绿
    default: return '#5B6FD4';
  }
};

// 进度条颜色
const getWeightColor = (pct: number): string => {
  if (pct >= 80) return '#4455B8';
  if (pct >= 60) return '#5B6FD4';
  if (pct >= 40) return '#8A9AE0';
  return '#C4CAEF';
};

// Gap priority helper (差距分析色)
const getGapPriorityInfo = (priority: string) => {
  switch (priority) {
    case 'high':
      return {
        color: '#E07B6A',
        label: '高优先',
        bgColor: 'rgba(224,123,106,0.08)',
        borderColor: 'rgba(224,123,106,0.20)',
        dot: '#E07B6A',
      };
    case 'medium':
      return {
        color: '#CB8A4A',
        label: '中优先',
        bgColor: 'rgba(203,138,74,0.08)',
        borderColor: 'rgba(203,138,74,0.18)',
        dot: '#CB8A4A',
      };
    case 'low':
      return {
        color: '#5E8F6E',
        label: '低优先',
        bgColor: 'rgba(94,143,110,0.08)',
        borderColor: 'rgba(94,143,110,0.18)',
        dot: '#5E8F6E',
      };
    default:
      return {
        color: '#8C8C8C',
        label: '未知',
        bgColor: '#FAFAFA',
        borderColor: '#E5E7EB',
        dot: '#8C8C8C',
      };
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
  const immediate: ActionItem[] = [];
  const nearTerm: ActionItem[] = [];
  const longTerm: ActionItem[] = [];

  gaps.forEach(gap => {
    const actionItem: ActionItem = {
      action: gap.suggestion,
      reason: `${gap.current_level} → ${gap.required_level}`,
      gap_item: gap.gap_item,
    };

    if (gap.dimension === 'skill' && gap.priority === 'high') {
      immediate.push(actionItem);
    }
    else if (gap.dimension === 'skill' && gap.priority === 'medium') {
      nearTerm.push(actionItem);
    }
    else if (gap.dimension === 'competency' || gap.dimension === 'potential') {
      longTerm.push(actionItem);
    }
    else if (gap.dimension === 'basic') {
      nearTerm.push(actionItem);
    }
    else {
      longTerm.push(actionItem);
    }
  });

  return { immediate, near_term: nearTerm, long_term: longTerm };
};

// Custom progress bar component with elastic animation
interface ProgressBarProps {
  percent: number;
  color: string;
}

const ProgressBar = ({ percent, color }: ProgressBarProps) => {
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${percent}%`,
          backgroundColor: color,
          animation: 'elasticWidth 0.8s ease-out',
        }}
      />
    </div>
  );
};

// Custom glass card component
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const GlassCard = ({ children, className = '', style = {}, onClick }: GlassCardProps) => {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.88)',
        borderRadius: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)',
        padding: '24px',
        ...style,
      }}
    >
      {children}
    </div>
  );
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

  // Custom progress bar for left panel list
  const renderMiniProgress = (score: number) => {
    const color = getTotalScoreColor(score);
    return (
      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    );
  };

  // Render left panel - recommendation list
  const renderLeftPanel = () => (
    <div className="h-full flex flex-col" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)' }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: '#E5E7EB' }}>
        <h2 className="text-lg font-semibold mb-3" style={{ color: '#0A0A0A' }}>岗位推荐</h2>
        <div className="flex gap-2">
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={runRecommend}
            loading={matching}
            disabled={!selectedStudent}
            block
            style={{ background: '#5B6FD4', borderColor: '#5B6FD4' }}
          >
            一键推荐
          </Button>
        </div>
      </div>

      {/* Student selector */}
      <div className="p-4 border-b" style={{ borderColor: '#E5E7EB' }}>
        <span style={{ color: '#6B7280', fontSize: '14px' }}>选择学生:</span>
        <select
          className="ml-2 p-2 border rounded text-sm"
          style={{ borderColor: '#E5E7EB', borderRadius: '8px' }}
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
                <GlassCard
                  key={result.id}
                  className={`mb-2 cursor-pointer transition-all ${isSelected ? 'ring-2' : ''}`}
                  style={{
                    padding: '12px',
                    border: isSelected ? `2px solid ${MODULE_COLOR}` : '1px solid rgba(255,255,255,0.9)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedResult(result)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate" style={{ color: '#0A0A0A' }}>
                        {result.role_name || `岗位 #${index + 1}`}
                      </div>
                      <div className="text-xs" style={{ color: '#6B7280' }}>排名 #{index + 1}</div>
                    </div>
                    <div
                      className="text-2xl font-bold ml-2"
                      style={{ color: getTotalScoreColor(result.total_score) }}
                    >
                      {result.total_score.toFixed(0)}
                    </div>
                  </div>

                  {/* Score bar */}
                  {renderMiniProgress(result.total_score)}

                  {/* Four dimension progress bars */}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1">
                      <SafetyOutlined className="text-xs" style={{ color: '#5B6FD4' }} />
                      <span className="text-xs" style={{ color: '#6B7280', width: '32px' }}>基础</span>
                      <div className="flex-1">
                        {renderMiniProgress(result.scores.basic.score)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <ThunderboltOutlined className="text-xs" style={{ color: '#4B9AB3' }} />
                      <span className="text-xs" style={{ color: '#6B7280', width: '32px' }}>技能</span>
                      <div className="flex-1">
                        {renderMiniProgress(result.scores.skill.score)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <StarOutlined className="text-xs" style={{ color: '#C4758A' }} />
                      <span className="text-xs" style={{ color: '#6B7280', width: '32px' }}>素养</span>
                      <div className="flex-1">
                        {renderMiniProgress(result.scores.competency.score)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <RocketOutlined className="text-xs" style={{ color: '#5E8F6E' }} />
                      <span className="text-xs" style={{ color: '#6B7280', width: '32px' }}>潜力</span>
                      <div className="flex-1">
                        {renderMiniProgress(result.scores.potential.score)}
                      </div>
                    </div>
                  </div>

                  {/* Gap badges */}
                  <div className="mt-2 flex gap-1">
                    {gapCounts.high > 0 && (
                      <Badge count={gapCounts.high} style={{ backgroundColor: '#E07B6A' }} />
                    )}
                    {gapCounts.medium > 0 && (
                      <Badge count={gapCounts.medium} style={{ backgroundColor: '#CB8A4A' }} />
                    )}
                    {gapCounts.low > 0 && (
                      <Badge count={gapCounts.low} style={{ backgroundColor: '#5E8F6E' }} />
                    )}
                    {gapCounts.high + gapCounts.medium + gapCounts.low === 0 && (
                      <Tag style={{
                        background: 'rgba(94,143,110,0.10)',
                        color: '#3A6B4D',
                        border: '1px solid rgba(94,143,110,0.20)',
                        borderRadius: '6px',
                      }} className="text-xs">无差距</Tag>
                    )}
                  </div>
                </GlassCard>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar Chart */}
        <GlassCard>
          <div className="ds-section-title" style={{ color: MODULE_COLOR }}>四维能力对比雷达图</div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 12, fill: '#6B7280' }}
              />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar
                name="学生能力"
                dataKey="A"
                stroke="#5B6FD4"
                fill="rgba(91,111,212,0.10)"
                strokeWidth={2}
              />
              <Radar
                name="岗位要求"
                dataKey="B"
                stroke="#82ca9d"
                fill="rgba(130,202,157,0.12)"
                strokeWidth={2}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Skill Analysis */}
        <GlassCard>
          <div className="ds-section-title" style={{ color: MODULE_COLOR }}>技能匹配分析</div>
          {matched.length > 0 ? (
            <div className="mb-4">
              <div className="text-sm font-medium mb-2 flex items-center gap-1" style={{ color: '#5E8F6E' }}>
                <CheckCircleOutlined /> 已匹配技能 ({matched.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {matched.slice(0, 15).map((skill, idx) => (
                  <Tag key={idx} style={{
                    background: 'rgba(94,143,110,0.10)',
                    color: '#3A6B4D',
                    border: '1px solid rgba(94,143,110,0.20)',
                    borderRadius: '6px',
                  }}>{skill}</Tag>
                ))}
                {matched.length > 15 && <Tag style={{
                  background: 'rgba(94,143,110,0.08)',
                  color: '#5A7A60',
                  border: '1px solid rgba(94,143,110,0.15)',
                  borderRadius: '6px',
                }}>+{matched.length - 15}</Tag>}
              </div>
            </div>
          ) : null}

          {missing.length > 0 ? (
            <div>
              <div className="text-sm font-medium mb-2 flex items-center gap-1" style={{ color: '#E07B6A' }}>
                <CloseCircleOutlined /> 缺失技能 ({missing.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {missing.slice(0, 15).map((skill, idx) => (
                  <Tag key={idx} style={{
                    background: 'rgba(224,123,106,0.10)',
                    color: '#8A4A3A',
                    border: '1px solid rgba(224,123,106,0.20)',
                    borderRadius: '6px',
                  }}>{skill}</Tag>
                ))}
                {missing.length > 15 && <Tag style={{
                  background: 'rgba(224,123,106,0.08)',
                  color: '#A06050',
                  border: '1px solid rgba(224,123,106,0.15)',
                  borderRadius: '6px',
                }}>+{missing.length - 15}</Tag>}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1" style={{ color: '#5E8F6E' }}>
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
                  {['#E07B6A', '#CB8A4A', '#5E8F6E'].map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
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
        <GlassCard>
          <Empty description="恭喜！暂无差距项" />
        </GlassCard>
      );
    }

    const highGaps = sortedGaps.filter(g => g.priority === 'high');
    const mediumGaps = sortedGaps.filter(g => g.priority === 'medium');
    const lowGaps = sortedGaps.filter(g => g.priority === 'low');

    return (
      <div className="space-y-4">
        {/* High Priority */}
        {highGaps.length > 0 && (
          <GlassCard
            style={{
              borderLeft: '4px solid #E07B6A',
              padding: '16px 24px',
            }}
          >
            <div className="flex items-center gap-2 mb-4" style={{ color: '#E07B6A' }}>
              <CloseCircleOutlined />
              <span className="font-semibold">高优先级差距 ({highGaps.length})</span>
            </div>
            <div className="space-y-3">
              {highGaps.map((gap, idx) => {
                const priorityInfo = getGapPriorityInfo('high');
                return (
                  <div
                    key={idx}
                    style={{
                      background: priorityInfo.bgColor,
                      border: `1px solid ${priorityInfo.borderColor}`,
                      borderRadius: '10px',
                      padding: '12px 16px',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: priorityInfo.dot }}
                      />
                      <div className="flex-1">
                        <div className="font-medium" style={{ color: '#0A0A0A' }}>{gap.gap_item}</div>
                        <div className="text-sm mt-1" style={{ color: '#6B7280' }}>
                          {gap.current_level} → {gap.required_level}
                        </div>
                        <div className="text-sm mt-2" style={{ color: '#5B6FD4' }}>{gap.suggestion}</div>
                      </div>
                      <Tag style={{
                        background: 'rgba(224,123,106,0.10)',
                        color: '#8A4A3A',
                        border: '1px solid rgba(224,123,106,0.20)',
                        borderRadius: '6px',
                      }}>高</Tag>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        )}

        {/* Medium Priority */}
        {mediumGaps.length > 0 && (
          <GlassCard
            style={{
              borderLeft: '4px solid #CB8A4A',
              padding: '16px 24px',
            }}
          >
            <div className="flex items-center gap-2 mb-4" style={{ color: '#CB8A4A' }}>
              <ExclamationCircleOutlined />
              <span className="font-semibold">中优先级差距 ({mediumGaps.length})</span>
            </div>
            <div className="space-y-3">
              {mediumGaps.map((gap, idx) => {
                const priorityInfo = getGapPriorityInfo('medium');
                return (
                  <div
                    key={idx}
                    style={{
                      background: priorityInfo.bgColor,
                      border: `1px solid ${priorityInfo.borderColor}`,
                      borderRadius: '10px',
                      padding: '12px 16px',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: priorityInfo.dot }}
                      />
                      <div className="flex-1">
                        <div className="font-medium" style={{ color: '#0A0A0A' }}>{gap.gap_item}</div>
                        <div className="text-sm mt-1" style={{ color: '#6B7280' }}>
                          {gap.current_level} → {gap.required_level}
                        </div>
                        <div className="text-sm mt-2" style={{ color: '#5B6FD4' }}>{gap.suggestion}</div>
                      </div>
                      <Tag style={{
                        background: 'rgba(203,138,74,0.10)',
                        color: '#7D4F1E',
                        border: '1px solid rgba(203,138,74,0.20)',
                        borderRadius: '6px',
                      }}>中</Tag>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        )}

        {/* Low Priority */}
        {lowGaps.length > 0 && (
          <GlassCard
            style={{
              borderLeft: '4px solid #5E8F6E',
              padding: '16px 24px',
            }}
          >
            <div className="flex items-center gap-2 mb-4" style={{ color: '#5E8F6E' }}>
              <CheckCircleOutlined />
              <span className="font-semibold">低优先级差距 ({lowGaps.length})</span>
            </div>
            <div className="space-y-3">
              {lowGaps.map((gap, idx) => {
                const priorityInfo = getGapPriorityInfo('low');
                return (
                  <div
                    key={idx}
                    style={{
                      background: priorityInfo.bgColor,
                      border: `1px solid ${priorityInfo.borderColor}`,
                      borderRadius: '10px',
                      padding: '12px 16px',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: priorityInfo.dot }}
                      />
                      <div className="flex-1">
                        <div className="font-medium" style={{ color: '#0A0A0A' }}>{gap.gap_item}</div>
                        <div className="text-sm mt-1" style={{ color: '#6B7280' }}>
                          {gap.current_level} → {gap.required_level}
                        </div>
                        <div className="text-sm mt-2" style={{ color: '#5B6FD4' }}>{gap.suggestion}</div>
                      </div>
                      <Tag style={{
                        background: 'rgba(94,143,110,0.10)',
                        color: '#3A6B4D',
                        border: '1px solid rgba(94,143,110,0.20)',
                        borderRadius: '6px',
                      }}>低</Tag>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        )}
      </div>
    );
  };

  // Render Tab3: 行动计划
  const renderActionPlan = () => {
    if (!selectedResult) return <Empty description="请选择一个岗位" />;

    const actionPlan = generateActionPlan(selectedResult.gaps);

    return (
      <div className="space-y-4">
        {/* 即时行动 */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4" style={{ color: '#E07B6A' }}>
            <ClockCircleOutlined />
            <span className="font-semibold">即时行动 (1-2周)</span>
          </div>
          {actionPlan.immediate.length > 0 ? (
            <div className="space-y-3">
              {actionPlan.immediate.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(224,123,106,0.06)',
                    border: '1px solid rgba(224,123,106,0.15)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                  }}
                >
                  <div className="font-medium" style={{ color: '#0A0A0A' }}>{item.gap_item}</div>
                  <div className="text-sm mt-1" style={{ color: '#6B7280' }}>{item.reason}</div>
                  <div className="text-sm mt-2" style={{ color: '#5B6FD4' }}>{item.action}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#9CA3AF' }}>暂无即时行动项</div>
          )}
        </GlassCard>

        {/* 近期行动 */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4" style={{ color: '#CB8A4A' }}>
            <AimOutlined />
            <span className="font-semibold">近期行动 (1-3月)</span>
          </div>
          {actionPlan.near_term.length > 0 ? (
            <div className="space-y-3">
              {actionPlan.near_term.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(203,138,74,0.06)',
                    border: '1px solid rgba(203,138,74,0.15)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                  }}
                >
                  <div className="font-medium" style={{ color: '#0A0A0A' }}>{item.gap_item}</div>
                  <div className="text-sm mt-1" style={{ color: '#6B7280' }}>{item.reason}</div>
                  <div className="text-sm mt-2" style={{ color: '#5B6FD4' }}>{item.action}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#9CA3AF' }}>暂无近期行动项</div>
          )}
        </GlassCard>

        {/* 长期行动 */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4" style={{ color: '#5E8F6E' }}>
            <BookOutlined />
            <span className="font-semibold">长期规划 (3-6月)</span>
          </div>
          {actionPlan.long_term.length > 0 ? (
            <div className="space-y-3">
              {actionPlan.long_term.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(94,143,110,0.06)',
                    border: '1px solid rgba(94,143,110,0.15)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                  }}
                >
                  <div className="font-medium" style={{ color: '#0A0A0A' }}>{item.gap_item}</div>
                  <div className="text-sm mt-1" style={{ color: '#6B7280' }}>{item.reason}</div>
                  <div className="text-sm mt-2" style={{ color: '#5B6FD4' }}>{item.action}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#9CA3AF' }}>暂无长期规划项</div>
          )}
        </GlassCard>
      </div>
    );
  };

  // 页面标题区
  const renderPageHeader = () => (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(91,111,212,0.10)',
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          color: MODULE_COLOR,
          marginBottom: 10,
        }}
      >
        <BarChart2 size={12} /> 匹配推荐
      </div>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: '#0A0A0A',
          letterSpacing: '-0.8px',
          margin: 0,
        }}
      >
        匹配推荐
      </h1>
      <p style={{ fontSize: 14, color: '#6B7280', margin: '6px 0 0 0' }}>
        基于学生画像与岗位画像的智能匹配
      </p>
    </div>
  );

  return (
    <div className="p-6">
      {renderPageHeader()}

      {loading ? (
        <LoadingState />
      ) : (
        <div className="flex gap-4" style={{ height: 'calc(100vh - 240px)' }}>
          {/* 左侧：推荐列表 */}
          <div className="w-80 flex-shrink-0 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.88)' }}>
            {renderLeftPanel()}
          </div>

          {/* 右侧：详情面板 */}
          <div className="flex-1 overflow-hidden rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.88)', background: 'rgba(255,255,255,0.82)' }}>
            {selectedResult ? (
              <div className="h-full flex flex-col">
                {/* 岗位信息头 */}
                <div className="p-4 border-b" style={{ borderColor: '#E5E7EB' }}>
                  <div className="flex items-center gap-4">
                    {/* 总分大数字 */}
                    <div
                      className="text-5xl font-bold"
                      style={{ color: getTotalScoreColor(selectedResult.total_score), minWidth: '100px' }}
                    >
                      {selectedResult.total_score.toFixed(0)}
                    </div>
                    <div>
                      <div className="text-lg font-semibold" style={{ color: '#0A0A0A' }}>
                        {selectedResult.role_name || '未知岗位'}
                      </div>
                      <div className="text-sm" style={{ color: '#6B7280' }}>
                        综合匹配度
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tab 内容区 */}
                <div className="flex-1 overflow-auto p-4">
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                      { key: '1', label: '匹配分析', children: renderMatchAnalysis() },
                      { key: '2', label: '差距清单', children: renderGapList() },
                      { key: '3', label: '行动计划', children: renderActionPlan() },
                    ]}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <Empty description="请从左侧选择一个岗位查看详情" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
