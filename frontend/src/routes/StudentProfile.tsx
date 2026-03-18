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

// 饼图颜色
const PIE_COLORS = ['#C4758A', '#CB8A4A', '#5B6FD4', '#5E8F6E'];
const SOFT_SKILL_DIMENSIONS = ['学习能力', '沟通能力', '团队协作', '创新能力', '抗压能力'] as const;

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
  const completenessScoreRaw = currentProfile?.completeness_score || 0;
  const completenessScore = completenessScoreRaw <= 1 ? Math.round(completenessScoreRaw * 100) : completenessScoreRaw;
  const competitivenessScoreRaw = Number(profileJson?.competitiveness_score || 0);
  const competitivenessScore =
    competitivenessScoreRaw <= 1 ? Math.round(competitivenessScoreRaw * 100) : Math.round(competitivenessScoreRaw);
  const educationList = Array.isArray(profileJson?.education) ? profileJson.education : [];
  const awards = Array.isArray(profileJson?.awards) ? profileJson.awards : [];
  const certificateNames = Array.isArray(profileJson?.certificate_names)
    ? profileJson.certificate_names
    : Array.isArray(profileJson?.certificates)
      ? profileJson.certificates.map((cert) => cert?.name).filter(Boolean)
      : [];
  const rawSoftSkills = profileJson?.soft_skills;
  const softSkillMap =
    Array.isArray(rawSoftSkills)
      ? Object.fromEntries(rawSoftSkills.map((item) => [item.dimension, item]))
      : Object.fromEntries(
          Object.entries(rawSoftSkills || {}).map(([dimension, score]) => [
            dimension,
            {
              dimension,
              score: typeof score === 'number' ? (score <= 1 ? score : score / 100) : 0,
              evidence: '暂无数据',
            },
          ]),
        );
  const softSkillItems = SOFT_SKILL_DIMENSIONS.map((dimension) => {
    const item = softSkillMap[dimension];
    if (!item) {
      return { dimension, score: 0, evidence: '暂无数据' };
    }
    return {
      dimension,
      score: typeof item.score === 'number' ? (item.score <= 1 ? item.score : item.score / 100) : 0,
      evidence: item.evidence || '暂无数据',
    };
  });
  const experienceMonths = Number(profileJson?.experience_months || 0);

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

  const softSkills = profileJson?.soft_skills || {};

  return (
    <div data-module="students" className="p-6">
      {/* 页面标题区 */}
      <div className="page-header-anim" style={{ marginBottom: 28 }}>
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
            {/* 基本信息卡片 + 核心评分 */}
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
                    <Descriptions.Item label="专业">
                      {profileJson?.basic_info?.major || educationList[0]?.major || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="经历月数">
                      {experienceMonths > 0 ? `${experienceMonths} 个月` : '-'}
                    </Descriptions.Item>
                  </Descriptions>
                </Col>
                <Col xs={24} md={10}>
                  <Title level={4} className="text-center" style={{ color: '#0A0A0A', marginBottom: '16px' }}>
                    <CrownOutlined className="mr-2" style={{ color: MODULE_COLOR }} />
                    画像摘要
                  </Title>
                  <div className="flex flex-wrap justify-center gap-6">
                    <div className="text-center">
                      <Progress
                        type="circle"
                        percent={completenessScore}
                        size={112}
                        strokeColor={PIE_COLORS[0]}
                        format={(percent) => `${percent}`}
                      />
                      <div className="mt-3">
                        <Text strong style={{ color: '#374151' }}>完整度评分</Text>
                      </div>
                    </div>
                    <div className="text-center">
                      <Progress
                        type="circle"
                        percent={competitivenessScore}
                        size={112}
                        strokeColor={PIE_COLORS[1]}
                        format={(percent) => `${percent}`}
                      />
                      <div className="mt-3">
                        <Text strong style={{ color: '#374151' }}>综合竞争力</Text>
                      </div>
                    </div>
                  </div>
                </Col>
              </Row>
              <div className="mt-6">
                <Title level={5} style={{ color: '#0A0A0A', marginBottom: '12px' }}>
                  <WarningOutlined className="mr-2" style={{ color: '#CB8A4A' }} />
                  缺失项建议
                </Title>
                {currentProfile.missing_suggestions && currentProfile.missing_suggestions.length > 0 ? (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {currentProfile.missing_suggestions.map((suggestion, index) => (
                      <Alert key={index} message={suggestion} type="warning" showIcon />
                    ))}
                  </Space>
                ) : (
                  <Alert message="画像信息较完整，当前没有额外完善建议。" type="success" showIcon />
                )}
              </div>
            </GlassCard>

            {/* 三栏布局 */}
            <Row gutter={24} className="mb-6">
              {/* 左侧栏：技能栈可视化 */}
              <Col xs={24} lg={6}>
                {/* 左列 flex 容器：技能栈 + 获奖信息竖向堆叠 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* 卡片1：技能栈 */}
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

                  {/* 卡片2：获奖信息 */}
                  {awards.length > 0 && (
                    <GlassCard className="h-full">
                      <Title level={4} className="m-0" style={{ color: '#0A0A0A', marginBottom: '16px' }}>
                        <TrophyOutlined className="mr-2" style={{ color: MODULE_COLOR }} />
                        获奖信息
                      </Title>
                      <div className="space-y-2">
                        {awards.map((award: { name: string; level?: string; date?: string }, index: number) => (
                          <div
                            key={`${award.name}-${index}`}
                            style={{
                              background: 'rgba(249,250,251,0.8)',
                              borderRadius: '0 8px 8px 0',
                              padding: '8px 12px',
                              marginBottom: '8px',
                              borderLeft: '3px solid #C4758A',
                            }}
                          >
                            <Text strong style={{ color: '#0A0A0A', fontSize: '14px' }}>{award.name}</Text>
                            <div>
                              <Text type="secondary" className="text-sm">
                                {[award.level, award.date].filter(Boolean).join(' | ') || '暂无级别/时间'}
                              </Text>
                            </div>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  )}
                </div>
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
                    {certificateNames.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {certificateNames.map((name, index) => (
                          <Tag
                            key={`${name}-${index}`}
                            style={{
                              background: 'rgba(196,117,138,0.10)',
                              color: '#8A3A50',
                              border: '1px solid rgba(196,117,138,0.20)',
                              borderRadius: '999px',
                              padding: '4px 10px',
                            }}
                          >
                            {name}
                          </Tag>
                        ))}
                      </div>
                    ) : (
                      <Text type="secondary">暂无证书信息</Text>
                    )}
                  </div>

                  {/* 软素养评估 */}
                  <div>
                    <Text strong type="secondary" style={{ color: '#6B7280' }}>
                      软素养评估
                    </Text>
                    {softSkillItems.some((item) => item.score > 0) ? (
                      <div className="mt-3">
                        {softSkillItems.map((item) => {
                          const percent = Math.round(item.score * 100);
                          return (
                            <div key={item.dimension} className="mb-4">
                              <div className="flex items-center justify-between mb-1">
                                <Text style={{ color: '#374151' }}>{item.dimension}</Text>
                                <Text type="secondary">{percent > 0 ? `${percent}%` : '暂无数据'}</Text>
                              </div>
                              <Progress
                                percent={percent}
                                size="small"
                                status={percent > 0 ? getScoreStatus(percent) : 'normal'}
                                strokeColor={percent > 0 ? getScoreColor(percent) : '#D1D5DB'}
                              />
                              <Text type="secondary" className="block mt-1">
                                {item.evidence || '暂无数据'}
                              </Text>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Text type="secondary">暂无软素养数据</Text>
                    )}
                  </div>
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
