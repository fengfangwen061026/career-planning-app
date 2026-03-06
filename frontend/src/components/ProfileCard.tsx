import { Card, Tag, Empty } from 'antd';
import { UserOutlined, StarOutlined } from '@ant-design/icons';

interface ProfileCardProps {
  title: string;
  subtitle?: string;
  skills?: string[];
  experiences?: { title: string; company?: string; duration?: string }[];
  education?: { degree: string; school: string; duration?: string }[];
  projects?: { name: string; description?: string }[];
  interests?: string[];
  goals?: string[];
  loading?: boolean;
}

export default function ProfileCard({
  title,
  subtitle,
  skills,
  experiences,
  education,
  projects,
  interests,
  goals,
  loading,
}: ProfileCardProps) {
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <UserOutlined />
          {title}
        </span>
      }
      loading={loading}
    >
      {subtitle && <p className="text-gray-500 mb-4">{subtitle}</p>}

      {skills && skills.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">技能</h4>
          <div className="flex flex-wrap gap-1">
            {skills.map((skill, index) => (
              <Tag key={index} color="blue">{skill}</Tag>
            ))}
          </div>
        </div>
      )}

      {experiences && experiences.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">经历</h4>
          {experiences.map((exp, index) => (
            <div key={index} className="mb-2">
              <div className="font-medium">{exp.title}</div>
              {exp.company && <div className="text-sm text-gray-500">{exp.company}</div>}
              {exp.duration && <div className="text-xs text-gray-400">{exp.duration}</div>}
            </div>
          ))}
        </div>
      )}

      {education && education.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">教育</h4>
          {education.map((edu, index) => (
            <div key={index} className="mb-2">
              <div className="font-medium">{edu.degree}</div>
              <div className="text-sm text-gray-500">{edu.school}</div>
              {edu.duration && <div className="text-xs text-gray-400">{edu.duration}</div>}
            </div>
          ))}
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">项目</h4>
          {projects.map((project, index) => (
            <div key={index} className="mb-2">
              <div className="font-medium flex items-center gap-1">
                <StarOutlined />
                {project.name}
              </div>
              {project.description && (
                <div className="text-sm text-gray-500">{project.description}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {interests && interests.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">兴趣</h4>
          <div className="flex flex-wrap gap-1">
            {interests.map((interest, index) => (
              <Tag key={index} color="purple">{interest}</Tag>
            ))}
          </div>
        </div>
      )}

      {goals && goals.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">目标</h4>
          <ul className="list-disc list-inside">
            {goals.map((goal, index) => (
              <li key={index} className="text-sm">{goal}</li>
            ))}
          </ul>
        </div>
      )}

      {!skills?.length && !experiences?.length && !education?.length && !projects?.length && !interests?.length && !goals?.length && (
        <Empty description="暂无画像数据" />
      )}
    </Card>
  );
}
