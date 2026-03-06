import { useState, useEffect } from 'react';
import {
  Card,
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
import { studentsApi } from '../api/students';
import type { StudentResponse, StudentProfileResponse } from '../types/student';

const { Title, Text } = Typography;

// 技能等级颜色映射
const getLevelColor = (level?: string): string => {
  switch (level) {
    case '精通':
      return 'red';
    case '熟练':
      return 'orange';
    case '了解':
      return 'blue';
    default:
      return 'default';
  }
};

// 评分颜色编码
const getScoreColor = (score: number): string => {
  if (score >= 80) return '#52c41a';
  if (score >= 60) return '#faad14';
  return '#ff4d4f';
};

// 评分状态
const getScoreStatus = (score: number): 'success' | 'normal' | 'exception' => {
  if (score >= 80) return 'success';
  if (score >= 60) return 'normal';
  return 'exception';
};

interface PieChartData {
  name: string;
  value: number;
}

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
        <Card size="small" className="mb-2">
          <Text strong>{exp.title}</Text>
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
        </Card>
      ),
    })) || [];

  // 软技能数据
  const softSkills = profileJson?.soft_skills || {};
  const softSkillsData = Object.entries(softSkills).map(([key, value]) => ({
    subject: key,
    A: value,
    fullMark: 100,
  }));

  // 雷达图数据（如果没有软技能数据，生成默认四维能力数据）
  const radarData = softSkillsData.length > 0
    ? softSkillsData
    : [
        { subject: '技术能力', A: 0, fullMark: 100 },
        { subject: '沟通能力', A: 0, fullMark: 100 },
        { subject: '团队协作', A: 0, fullMark: 100 },
        { subject: '学习能力', A: 0, fullMark: 100 },
      ];

  return (
    <div className="p-6">
      <Title level={2} className="mb-6">学生画像</Title>

      {/* 学生选择器 */}
      <Card className="mb-6">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>选择学生查看画像</Text>
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
                      <Tag color="green">已画像</Tag>
                    ) : (
                      <Tag>未画像</Tag>
                    )}
                  </Space>
                </Select.Option>
              );
            })}
          </Select>
        </Space>
      </Card>

      {selectedStudentId ? (
        currentProfile ? (
          <div>
            {/* 顶部：基本信息卡片 + 完整度评分 */}
            <Card className="mb-6">
              <Row gutter={24}>
                <Col xs={24} md={14}>
                  <Title level={4}>
                    <UserOutlined className="mr-2" />
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
                  <Title level={4} className="text-center">
                    <CrownOutlined className="mr-2" />
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
                            fill={getScoreColor(currentProfile.completeness_score)}
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
            </Card>

            {/* 三栏布局 */}
            <Row gutter={24} className="mb-6">
              {/* 左侧栏：技能栈可视化 */}
              <Col xs={24} lg={6}>
                <Card
                  title={
                    <Title level={4} className="m-0">
                      <BookOutlined className="mr-2" />
                      技能栈
                    </Title>
                  }
                  className="h-full"
                >
                  {Object.keys(skillsByCategory).length > 0 ? (
                    Object.entries(skillsByCategory).map(([category, skills]) => (
                      <div key={category} className="mb-4">
                        <Text strong type="secondary">
                          {category}
                        </Text>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {skills.map((skill, index) => (
                            <Tag
                              key={index}
                              color={getLevelColor(skill.level)}
                              className="m-1"
                            >
                              {skill.name}
                              {skill.level && (
                                <span className="ml-1 text-xs opacity-70">
                                  ({skill.level})
                                </span>
                              )}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty description="暂无技能数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </Card>
              </Col>

              {/* 中间栏：项目/实习经历时间线 */}
              <Col xs={24} lg={10}>
                <Card
                  title={
                    <Title level={4} className="m-0">
                      <ProjectOutlined className="mr-2" />
                      项目与实习经历
                    </Title>
                  }
                  className="h-full"
                >
                  {timelineItems.length > 0 ? (
                    <Timeline mode="left" items={timelineItems} />
                  ) : (
                    <Empty description="暂无经历数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </Card>
              </Col>

              {/* 右侧栏：证书和软素养评估 */}
              <Col xs={24} lg={8}>
                <Card
                  title={
                    <Title level={4} className="m-0">
                      <TrophyOutlined className="mr-2" />
                      证书与软素养
                    </Title>
                  }
                  className="h-full"
                >
                  {/* 证书列表 */}
                  <div className="mb-6">
                    <Text strong type="secondary">
                      证书
                    </Text>
                    {profileJson?.certificates && profileJson.certificates.length > 0 ? (
                      <div className="mt-3">
                        {profileJson.certificates.map((cert, index) => (
                          <Card key={index} size="small" className="mb-2">
                            <Text strong>{cert.name}</Text>
                            <div>
                              <Text type="secondary" className="text-sm">
                                {cert.issuer}
                                {cert.date && ` - ${cert.date}`}
                              </Text>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Text type="secondary">暂无证书数据</Text>
                    )}
                  </div>

                  {/* 软素养评估 */}
                  <div>
                    <Text strong type="secondary">
                      软素养评估
                    </Text>
                    {Object.keys(softSkills).length > 0 ? (
                      <div className="mt-3">
                        {Object.entries(softSkills).map(([key, value]) => (
                          <div key={key} className="mb-3">
                            <Space>
                              <Text>{key}</Text>
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
                </Card>
              </Col>
            </Row>

            {/* 底部：竞争力评分 + 缺失项建议 */}
            <Row gutter={24}>
              {/* 左侧：竞争力综合评分（雷达图） */}
              <Col xs={24} lg={12}>
                <Card
                  title={
                    <Title level={4} className="m-0">
                      竞争力综合评分
                    </Title>
                  }
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar
                        name="能力值"
                        dataKey="A"
                        stroke={getScoreColor(
                          radarData.reduce((sum, item) => sum + item.A, 0) / radarData.length
                        )}
                        fill={getScoreColor(
                          radarData.reduce((sum, item) => sum + item.A, 0) / radarData.length
                        )}
                        fillOpacity={0.6}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              {/* 右侧：缺失项建议 */}
              <Col xs={24} lg={12}>
                <Card
                  title={
                    <Title level={4} className="m-0">
                      <WarningOutlined className="mr-2" />
                      缺失项建议
                    </Title>
                  }
                >
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
                </Card>
              </Col>
            </Row>
          </div>
        ) : (
          <Card>
            <Empty
              description="暂无画像，请先上传简历"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Card>
        )
      ) : (
        <Card>
          <Empty
            description="请先选择学生查看画像"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}
    </div>
  );
}
