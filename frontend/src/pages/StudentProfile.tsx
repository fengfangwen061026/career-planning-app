import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Progress,
  Tag,
  Timeline,
  TimelineItemProps,
  Badge,
  Alert,
  Spin,
  Empty,
  Popover,
  Row,
  Col,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  BankOutlined,
} from '@ant-design/icons';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { studentApi } from '../api/student';
import type { StudentProfileResponse } from '../types/student';

// 技能熟练度颜色映射
const proficiencyColors: Record<string, string> = {
  熟练: 'blue',
  掌握: 'green',
  了解: 'default',
  入门: 'default',
};

const proficiencyBgColors: Record<string, string> = {
  熟练: '#e6f7ff',
  掌握: '#f6ffed',
  了解: '#f5f5f5',
  入门: '#fafafa',
};

// 软技能维度
const SOFT_SKILL_DIMENSIONS = [
  '沟通能力',
  '团队协作',
  '抗压能力',
  '创新能力',
  '学习能力',
];

export default function StudentProfile() {
  const { studentId } = useParams<{ studentId: string }>();
  const [profile, setProfile] = useState<StudentProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await studentApi.getStudentProfile(studentId);
        setProfile(response.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6">
        <Alert
          message="Error"
          description={error || 'Profile not found'}
          type="error"
          showIcon
        />
      </div>
    );
  }

  const { profile_json, completeness_score, missing_suggestions = [] } = profile as any;

  // 提取数据 - handle both old and new format
  const basicInfo = (profile_json?.basic_info || profile_json || {}) as any;
  const skills = (profile_json?.skills || profile_json?.dimensions?.professional_skills || []) as any[];
  const experience = (profile_json?.experiences || profile_json?.experience || { work: [], projects: [] }) as any;
  const softSkills = (profile_json?.soft_skills || profile_json?.dimensions?.soft_competencies || {}) as any;
  const certificates = (profile_json?.certificates || []) as any[];
  const awards = (profile_json?.awards || []) as any[];

  // 计算竞争力评分（如果有的话）
  const competitivenessScore = Math.round(
    ((completeness_score || 0) * 0.6 + (profile_json?.skills?.length || 0) / 20) * 100
  );

  // 软技能雷达图数据
  const radarData = SOFT_SKILL_DIMENSIONS.map((dim) => ({
    subject: dim,
    value: softSkills?.[dim]?.score ? Math.round(softSkills[dim].score * 100) : 0,
    fullMark: 100,
  }));

  // 按 category 分组技能
  const skillsByCategory: Record<string, typeof skills> = {};
  skills.forEach((skill: any) => {
    const category = skill.category || '其他';
    if (!skillsByCategory[category]) {
      skillsByCategory[category] = [];
    }
    skillsByCategory[category].push(skill);
  });

  // Timeline 数据
  const timelineItems: TimelineItemProps[] = [];

  // 添加工作经历
  const workExp = experience?.work || [];
  workExp.forEach((exp: any) => {
    timelineItems.push({
      color: 'red',
      children: (
        <div className="mb-2">
          <div className="font-medium">{exp.title || exp.role}</div>
          <div className="text-sm text-gray-500">{exp.company}</div>
          {exp.duration && (
            <div className="text-xs text-gray-400">{exp.duration}</div>
          )}
          {exp.description && (
            <div className="text-sm text-gray-600 mt-1">
              {exp.description.length > 80
                ? exp.description.substring(0, 80) + '...'
                : exp.description}
            </div>
          )}
        </div>
      ),
    });
  });

  // 添加项目经历
  const projects = experience?.projects || [];
  projects.forEach((proj: any) => {
    timelineItems.push({
      color: 'blue',
      children: (
        <div className="mb-2">
          <div className="font-medium">{proj.name}</div>
          {proj.role && (
            <div className="text-sm text-gray-500">{proj.role}</div>
          )}
          {proj.duration && (
            <div className="text-xs text-gray-400">{proj.duration}</div>
          )}
          {proj.description && (
            <div className="text-sm text-gray-600 mt-1">
              {proj.description.length > 80
                ? proj.description.substring(0, 80) + '...'
                : proj.description}
            </div>
          )}
        </div>
      ),
    });
  });

  // 按时间排序（这里简单按出现顺序，实际可以根据 duration 排序）
  timelineItems.reverse();

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* 顶部信息条 */}
      <Card className="mb-4">
        <Row gutter={24} align="middle">
          <Col flex="auto">
            <div className="flex items-center gap-4">
              <BankOutlined className="text-2xl text-blue-600" />
              <div>
                <h1 className="text-xl font-bold m-0">
                  {basicInfo?.name || 'Student Profile'}
                </h1>
                <p className="text-gray-500 m-0">
                  {basicInfo?.school && `${basicInfo.school} | `}
                  {(basicInfo as any)?.major && `${(basicInfo as any).major} | `}
                  {basicInfo?.degree}
                </p>
              </div>
            </div>
          </Col>
          <Col>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <Progress
                  type="circle"
                  percent={Math.round((completeness_score || 0) * 100)}
                  size={80}
                  strokeColor="#1890ff"
                  format={(percent) => (
                    <span className="text-sm">
                      完整度
                      <br />
                      {percent}%
                    </span>
                  )}
                />
              </div>
              <div className="text-center">
                <Progress
                  type="circle"
                  percent={competitivenessScore}
                  size={80}
                  strokeColor="#52c41a"
                  format={(percent) => (
                    <span className="text-sm">
                      竞争力
                      <br />
                      {percent}%
                    </span>
                  )}
                />
              </div>
              {missing_suggestions.length > 0 && (
                <Badge
                  count={missing_suggestions.length}
                  overflowCount={10}
                >
                  <ExclamationCircleOutlined className="text-2xl text-orange-500" />
                </Badge>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* 主要内容区域 */}
      <Row gutter={16}>
        {/* 左列：技能栈 */}
        <Col span={8}>
          <Card title="技能栈" className="mb-4">
            {Object.keys(skillsByCategory).length === 0 ? (
              <Empty description="暂无技能信息" />
            ) : (
              Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                <div key={category} className="mb-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-2">
                    {category}
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {categorySkills.map((skill: any, idx: number) => (
                      <Popover
                        key={idx}
                        content={
                          skill.proficiency_evidence ? (
                            <div className="max-w-xs">{skill.proficiency_evidence}</div>
                          ) : (
                            '无具体证据'
                          )
                        }
                        title={skill.skill_name}
                      >
                        <Tag
                          color={proficiencyColors[skill.proficiency] || 'default'}
                          style={{
                            backgroundColor:
                              proficiencyBgColors[skill.proficiency] || '#f5f5f5',
                            cursor: 'pointer',
                          }}
                        >
                          {skill.skill_name}
                          {skill.proficiency && (
                            <span className="text-xs ml-1 opacity-70">
                              ({skill.proficiency})
                            </span>
                          )}
                        </Tag>
                      </Popover>
                    ))}
                  </div>
                </div>
              ))
            )}
          </Card>
        </Col>

        {/* 中列：实习和项目时间线 */}
        <Col span={8}>
          <Card title="经历" className="mb-4">
            {timelineItems.length === 0 ? (
              <Empty description="暂无经历信息" />
            ) : (
              <Timeline mode="left" items={timelineItems} />
            )}
          </Card>
        </Col>

        {/* 右列：软素养、证书、获奖 */}
        <Col span={8}>
          <Card title="软素养" className="mb-4">
            {radarData.every((d) => d.value === 0) ? (
              <Empty description="暂无软素养评估" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar
                    name="Score"
                    dataKey="value"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="证书" className="mb-4">
            {certificates.length === 0 ? (
              <Empty description="暂无证书" />
            ) : (
              <div className="flex flex-wrap gap-1">
                {certificates.map((cert: any, idx: number) => (
                  <Tag key={idx} color="blue">
                    {cert.name || cert}
                  </Tag>
                ))}
              </div>
            )}
          </Card>

          <Card title="获奖">
            {awards.length === 0 ? (
              <Empty description="暂无获奖信息" />
            ) : (
              <div className="flex flex-wrap gap-1">
                {awards.map((award: any, idx: number) => (
                  <Tag key={idx} color="gold" icon={<TrophyOutlined />}>
                    {award.name || award}
                  </Tag>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 底部：缺失项建议 */}
      {missing_suggestions.length > 0 && (
        <Card title="完善建议" className="mt-4">
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message={
              <ul className="m-0 pl-4">
                {(missing_suggestions as string[]).map((suggestion: string, idx: number) => (
                  <li key={idx}>{suggestion}</li>
                ))}
              </ul>
            }
          />
        </Card>
      )}
    </div>
  );
}
