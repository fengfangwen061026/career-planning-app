import { useState, useEffect } from 'react';
import {
  Select,
  Space,
  Tag,
  Timeline,
  Progress,
  Empty,
  Alert,
  Descriptions,
  Typography,
  Row,
  Col,
} from 'antd';
import {
  UserOutlined,
  BookOutlined,
  ProjectOutlined,
  TrophyOutlined,
  CrownOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import { User } from 'lucide-react';
import { studentsApi } from '../api/students';
import type { StudentResponse, StudentProfileResponse } from '../types/student';

// 模块专属色 - 玫瑰粉色系
const MODULE_COLOR = '#C4758A';
const MODULE_BG = '#FAECF0';

const { Title, Text } = Typography;

// 技能等级颜色映射
const getLevelColor = (level?: string): { bg: string; color: string; border: string } => {
  switch (level) {
    case '精通':
      return { bg: 'rgba(196,117,138,0.12)', color: '#8A3A50', border: 'rgba(196,117,138,0.22)' };
    case '熟练':
      return { bg: 'rgba(203,138,74,0.10)', color: '#7D4F1E', border: 'rgba(203,138,74,0.20)' };
    case '了解':
    default:
      return { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' };
  }
};

// 评分颜色编码
const getScoreColor = (score: number): string => {
  if (score >= 80) return '#5E8F6E';
  if (score >= 60) return '#CB8A4A';
  return '#E07B6A';
};

// 评分状态
const getScoreStatus = (score: number): 'success' | 'normal' | 'exception' => {
  if (score >= 80) return 'success';
  if (score >= 60) return 'normal';
  return 'exception';
};

// Glass-morphism Card 组件
const GlassCard: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({
  children,
  className = '',
  style = {},
}) => (
  <div
    className={`glass-card ${className}`}
    style={{
      background: 'rgba(255,255,255,0.82)',
      backdropFilter: 'blur(12px)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)',
      padding: '20px',
      ...style,
    }}
  >
    {children}
  </div>
);

// 获取姓名首字母
const getInitials = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

interface PieChartData {
  name: string;
  value: number;
}

// 四维能力数据（用于雷达图）
const defaultRadarData = [
  { subject: '基础要求', A: 0, fullMark: 100 },
  { subject: '技术技能', A: 0, fullMark: 100 },
  { subject: '软技能', A: 0, fullMark: 100 },
  { subject: '发展潜力', A: 0, fullMark: 100 },
];

// 饼图颜色
const PIE_COLORS = ['#C4758A', '#CB8A4A', '#5B6FD4', '#5E8F6E'];

export default function StudentProfile() {
  const [students, setStudents] = useState<StudentResponse[]>([]);
  const [profiles, setProfiles] = useState<Map<string, StudentProfileResponse>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const response = await studentsApi.getStudents();
      setStudents(response.data);

      // Fetch profiles for all students
      const profileMap = new Map<string, StudentProfileResponse>();
      await Promise.all(
        response.data.map(async (student) => {
          try {
            const profileRes = await studentsApi.getStudentProfile(student.id);
            profileMap.set(student.id, profileRes.data);
          } catch {
            // Profile doesn't exist yet
          }
        })
      );
      setProfiles(profileMap);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentProfile = selectedStudentId ? profiles.get(selectedStudentId) : null;
  const profileJson = currentProfile?.profile_json;
  const studentName = profileJson?.basic_info?.name || students.find(s => s.id === selectedStudentId)?.name || '未知';
  const studentEmail = profileJson?.basic_info?.email || students.find(s => s.id === selectedStudentId)?.email || '';

  // 计算完整度饼图数据
  const completenessData: PieChartData[] = [
    { name: '完整度', value: currentProfile?.completeness_score || 0 },
    { name: '缺失', value: 100 - (currentProfile?.completeness_score || 0) },
  ];

  // 技能分类
  const skillsByCategory = profileJson?.skills?.reduce((acc, skill) => {
    const category = skill.category || '其他';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(skill);
    return acc;
  }, {} as Record<string, typeof profileJson.skills>) || {};

  // 项目/实习经历时间线数据
  const timelineItems = profileJson?.experiences
    ?.sort((a, b) => {
      // 按时间倒序排列
      const durationA = a.duration || '';
      const durationB = b.duration || '';
      return durationB.localeCompare(durationA);
    })
    .map((exp) => ({
      dot: exp.type === 'project' ? <ProjectOutlined /> : <BookOutlined />,
      children: (
        <div
          className="project-card"
          style={{
            background: 'rgba(249,250,251,0.8)',
            borderRadius: '10px',
            padding: '12px 16px',
            borderLeft: '3px solid #C4758A',
            marginBottom: '8px',
          }}
        >
          <Text strong style={{ fontSize: '15px' }}>{exp.title}</Text>
          {exp.company && <Text type="secondary"> - {exp.company}</Text>}
          {exp.duration && (
            <div>
              <Text type="secondary" className="text-sm">
                {exp.duration}
              </Text>
            </div>
          )}
          {exp.description && (
            <div className="mt-2">
              <Text type="secondary">{exp.description}</Text>
            </div>
          )}
        </div>
      ),
    })) || [];

  // 软技能数据
  const softSkills = profileJson?.soft_skills || {};
  const softSkillsData = Object.entries(softSkills).map(([key, value]) => ({
    subject: key,
    A: value,
    fullMark: 100,
  }));

  // 四维能力数据 - 使用软技能或默认值
  const getRadarData = () => {
    if (softSkillsData.length > 0) {
      // 如果有软技能数据，填充到四维
      const mapped = softSkillsData.slice(0, 4);
      while (mapped.length < 4) {
        mapped.push({ subject: defaultRadarData[mapped.length].subject, A: 0, fullMark: 100 });
      }
      return mapped;
    }
    // 使用默认四维数据，但如果有completeness_score可以展示
    const avgScore = currentProfile?.completeness_score || 0;
    return [
      { subject: '基础要求', A: avgScore, fullMark: 100 },
      { subject: '技术技能', A: avgScore * 0.9, fullMark: 100 },
      { subject: '软技能', A: avgScore * 0.85, fullMark: 100 },
      { subject: '发展潜力', A: avgScore * 0.8, fullMark: 100 },
    ];
  };

  const radarData = getRadarData();

  return (
    <div data-module="students" className="p-6">
      {/* 页面标题区 */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(196,117,138,0.10)',
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            color: MODULE_COLOR,
            marginBottom: 10,
          }}
        >
          <User size={12} /> 学生画像
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
          学生画像
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '6px 0 0 0' }}>
          查看和管理学生职业画像
        </p>
      </div>

      {/* 顶部 Avatar Banner */}
      <GlassCard className="mb-6" style={{ padding: '16px 24px' }}>
        <div className="flex items-center gap-4">
          {/* 圆形头像 */}
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #C4758A, #E07B6A)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '24px',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {getInitials(studentName)}
          </div>
          {/* 姓名和信息 */}
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0A0A0A', lineHeight: 1.3 }}>
              {studentName}
            </div>
            <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '2px' }}>
              {studentEmail || '暂无邮箱'}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 学生选择器 */}
      <GlassCard className="mb-6" style={{ padding: '16px 24px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong style={{ color: '#374151' }}>选择学生查看画像</Text>
          <Select
            placeholder="请选择学生"
            style={{ width: '100%', maxWidth: 400 }}
            loading={loading}
            value={selectedStudentId}
            onChange={setSelectedStudentId}
            allowClear
            optionLabelProp="label"
          >
            {students.map((student) => {
              const profile = profiles.get(student.id);
              const hasProfile = !!profile;
              return (
                <Select.Option
                  key={student.id}
                  value={student.id}
                  label={student.name || student.email}
                >
                  <Space>
                    <UserOutlined />
                    <span>{student.name || student.email}</span>
                    {hasProfile ? (
                      <Tag style={{
                        background: 'rgba(94,143,110,0.10)',
                        color: '#3A6B4D',
                        border: '1px solid rgba(94,143,110,0.20)',
                        borderRadius: '6px',
                      }}>已画像</Tag>
                    ) : (
                      <Tag>未画像</Tag>
                    )}
                  </Space>
                </Select.Option>
              );
            })}
          </Select>
        </Space>
      </GlassCard>

      {selectedStudentId ? (
        currentProfile ? (
          <div>
            {/* 基本信息卡片 + 完整度评分 */}
            <GlassCard className="mb-6">
              <Row gutter={24}>
                <Col xs={24} md={14}>
                  <Title level={4} style={{ color: '#0A0A0A', marginBottom: '16px' }}>
                    <UserOutlined className="mr-2" style={{ color: MODULE_COLOR }} />
                    基本信息
                  </Title>
                  <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
                    <Descriptions.Item label="姓名">
                      {profileJson?.basic_info?.name || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="邮箱">
                      {profileJson?.basic_info?.email || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="电话">
                      {profileJson?.basic_info?.phone || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="学校">
                      {profileJson?.basic_info?.school || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="学历">
                      {profileJson?.basic_info?.degree || '-'}
                    </Descriptions.Item>
                  </Descriptions>
                </Col>
                <Col xs={24} md={10}>
                  <Title level={4} className="text-center" style={{ color: '#0A0A0A', marginBottom: '16px' }}>
                    <CrownOutlined className="mr-2" style={{ color: MODULE_COLOR }} />
                    完整度评分
                  </Title>
                  <div className="flex justify-center items-center" style={{ height: 180 }}>
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie
                          data={completenessData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                        >
                          <Cell
                            fill={PIE_COLORS[0]}
                            key="complete"
                          />
                          <Cell fill="#f0f0f0" key="missing" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div
                      className="absolute"
                      style={{
                        position: 'absolute',
                        transform: 'translateX(-50%)',
                        left: '50%',
                      }}
                    >
                      <Title
                        level={2}
                        style={{
                          color: getScoreColor(currentProfile.completeness_score),
                          margin: 0,
                        }}
                      >
                        {currentProfile.completeness_score}
                      </Title>
                      <Text type="secondary">分</Text>
                    </div>
                  </div>
                </Col>
              </Row>
            </GlassCard>

            {/* 三栏布局 */}
            <Row gutter={24} className="mb-6">
              {/* 左侧栏：技能栈可视化 */}
              <Col xs={24} lg={6}>
                <GlassCard className="h-full">
                  <Title level={4} className="m-0" style={{ color: '#0A0A0A', marginBottom: '16px' }}>
                    <BookOutlined className="mr-2" style={{ color: MODULE_COLOR }} />
                    技能栈
                  </Title>
                  {Object.keys(skillsByCategory).length > 0 ? (
                    Object.entries(skillsByCategory).map(([category, skills]) => (
                      <div key={category} className="mb-4">
                        <Text strong type="secondary" style={{ color: '#6B7280' }}>
                          {category}
                        </Text>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {skills.map((skill, index) => {
                            const colors = getLevelColor(skill.level);
                            return (
                              <span
                                key={index}
                                style={{
                                  background: colors.bg,
                                  color: colors.color,
                                  border: `1px solid ${colors.border}`,
                                  borderRadius: '8px',
                                  padding: '4px 10px',
                                  fontSize: '13px',
                                  fontWeight: 500,
                                }}
                              >
                                {skill.name}
                                {skill.level && (
                                  <span className="ml-1 text-xs opacity-70">
                                    ({skill.level})
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty description="暂无技能数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </GlassCard>
              </Col>

              {/* 中间栏：项目/实习经历时间线 */}
              <Col xs={24} lg={10}>
                <GlassCard className="h-full">
                  <Title level={4} className="m-0" style={{ color: '#0A0A0A', marginBottom: '16px' }}>
                    <ProjectOutlined className="mr-2" style={{ color: MODULE_COLOR }} />
                    项目与实习经历
                  </Title>
                  <div className="timeline-custom">
                    <style>{`
                      .timeline-custom .ant-timeline-item-tail {
                        border-left-color: #E5E7EB;
                      }
                      .timeline-custom .ant-timeline-item-head {
                        color: #C4758A;
                        border-color: #C4758A;
                        background: #FAECF0;
                      }
                    `}</style>
                    {timelineItems.length > 0 ? (
                      <Timeline mode="left" items={timelineItems} />
                    ) : (
                      <Empty description="暂无经历数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                  </div>
                </GlassCard>
              </Col>

              {/* 右侧栏：证书和软素养评估 */}
              <Col xs={24} lg={8}>
                <GlassCard className="h-full">
                  <Title level={4} className="m-0" style={{ color: '#0A0A0A', marginBottom: '16px' }}>
                    <TrophyOutlined className="mr-2" style={{ color: MODULE_COLOR }} />
                    证书与软素养
                  </Title>
                  {/* 证书列表 */}
                  <div className="mb-6">
                    <Text strong type="secondary" style={{ color: '#6B7280' }}>
                      证书
                    </Text>
                    {profileJson?.certificates && profileJson.certificates.length > 0 ? (
                      <div className="mt-3">
                        {profileJson.certificates.map((cert, index) => (
                          <div
                            key={index}
                            style={{
                              background: 'rgba(249,250,251,0.8)',
                              borderRadius: '10px',
                              padding: '12px 16px',
                              marginBottom: '8px',
                              borderLeft: '3px solid #C4758A',
                            }}
                          >
                            <Text strong style={{ color: '#0A0A0A' }}>{cert.name}</Text>
                            <div>
                              <Text type="secondary" className="text-sm">
                                {cert.issuer}
                                {cert.date && ` - ${cert.date}`}
                              </Text>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Text type="secondary">暂无证书数据</Text>
                    )}
                  </div>

                  {/* 软素养评估 */}
                  <div>
                    <Text strong type="secondary" style={{ color: '#6B7280' }}>
                      软素养评估
                    </Text>
                    {Object.keys(softSkills).length > 0 ? (
                      <div className="mt-3">
                        {Object.entries(softSkills).map(([key, value]) => (
                          <div key={key} className="mb-3">
                            <Space>
                              <Text style={{ color: '#374151' }}>{key}</Text>
                              <Progress
                                percent={value}
                                size="small"
                                status={getScoreStatus(value)}
                                strokeColor={getScoreColor(value)}
                                style={{ width: 120 }}
                              />
                            </Space>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Text type="secondary">暂无软素养数据</Text>
                    )}
                  </div>
                </GlassCard>
              </Col>
            </Row>

            {/* 底部：竞争力评分 + 缺失项建议 */}
            <Row gutter={24}>
              {/* 左侧：竞争力综合评分（雷达图） */}
              <Col xs={24} lg={12}>
                <GlassCard>
                  <Title level={4} className="m-0" style={{ color: '#0A0A0A', marginBottom: '16px' }}>
                    竞争力综合评分
                  </Title>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#E5E7EB" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: '#6B7280', fontSize: 13 }}
                      />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                      <Radar
                        name="能力值"
                        dataKey="A"
                        stroke="#C4758A"
                        fill="rgba(196,117,138,0.12)"
                        fillOpacity={1}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </GlassCard>
              </Col>

              {/* 右侧：缺失项建议 */}
              <Col xs={24} lg={12}>
                <GlassCard>
                  <Title level={4} className="m-0" style={{ color: '#0A0A0A', marginBottom: '16px' }}>
                    <WarningOutlined className="mr-2" style={{ color: MODULE_COLOR }} />
                    缺失项建议
                  </Title>
                  {currentProfile.missing_suggestions &&
                  currentProfile.missing_suggestions.length > 0 ? (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {currentProfile.missing_suggestions.map((suggestion, index) => (
                        <Alert
                          key={index}
                          message={suggestion}
                          type="warning"
                          showIcon
                          className="mb-2"
                        />
                      ))}
                    </Space>
                  ) : (
                    <Empty
                      description="恭喜！您的画像已完整"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  )}
                </GlassCard>
              </Col>
            </Row>
          </div>
        ) : (
          <GlassCard>
            <Empty
              description="暂无画像，请先上传简历"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </GlassCard>
        )
      ) : (
        <GlassCard>
          <Empty
            description="请先选择学生"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </GlassCard>
      )}
    </div>
  );
}
