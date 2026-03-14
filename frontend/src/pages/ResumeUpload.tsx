import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Upload,
  Button,
  Steps,
  Tabs,
  Tag,
  Alert,
  Space,
  Typography,
  Popover,
  message,
  Result,
} from 'antd';
import {
  InboxOutlined,
  CheckCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { resumeApi } from '../api/resume';
import type { ResumeParseResult } from '../types/profiles';
import type { ResumeUploadResponse } from '../types/student';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

type UploadStep = 'upload' | 'preview' | 'complete';

// 默认学生 UUID
const DEFAULT_STUDENT_UUID = '9e882ecb-816d-4478-b836-4dcaf7bc1660';

export default function ResumeUpload() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<UploadStep>('upload');
  const [loading, setLoading] = useState(false);
  const [uploadResponse, setUploadResponse] = useState<ResumeUploadResponse | null>(null);
  const [studentId] = useState(DEFAULT_STUDENT_UUID);

  // Helper to get typed parsed data
  const getParsedData = (): ResumeParseResult | null => {
    if (!uploadResponse?.parsed_data) return null;
    return uploadResponse.parsed_data as unknown as ResumeParseResult;
  };

  // File validation
  const beforeUpload = (file: File) => {
    const isValidType = file.type === 'application/pdf' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!isValidType) {
      message.error('仅支持 PDF 和 DOCX 格式');
      return false;
    }

    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('文件大小不能超过 5MB');
      return false;
    }

    return false; // Prevent auto upload
  };

  const handleUpload = async (file: File) => {
    setLoading(true);

    try {
      const response = await resumeApi.uploadResume(file);
      setUploadResponse(response.data);

      // Check missing suggestions
      if (response.data.missing_suggestions && response.data.missing_suggestions.length > 0) {
        response.data.missing_suggestions.forEach((suggestion: string) => {
          message.warning(suggestion);
        });
      }

      setCurrentStep('preview');
    } catch (error) {
      message.error('上传失败，请重试');
    } finally {
      setLoading(false);
    }

    return false;
  };

  const handleConfirm = async () => {
    if (!uploadResponse) return;

    const parsedData = getParsedData();
    if (!parsedData) return;

    setLoading(true);
    try {
      await resumeApi.confirmResume(studentId, uploadResponse.resume.id, {
        raw_text: parsedData.raw_text,
        education: parsedData.education,
        experience: parsedData.experience,
        projects: parsedData.projects,
        skills: parsedData.skills,
        certificates: parsedData.certificates,
        awards: parsedData.awards,
        self_intro: parsedData.self_intro,
        parse_confidence: parsedData.parse_confidence,
        missing_fields: parsedData.missing_fields,
      });

      message.success('简历确认成功');
      setCurrentStep('complete');
    } catch (error) {
      message.error('确认失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentStep('upload');
    setUploadResponse(null);
  };

  const handleViewProfile = () => {
    if (uploadResponse) {
      // Use the studentId we stored
      navigate(`/students/${studentId}`);
    }
  };

  // Render evidence popover
  const renderEvidence = (evidence: string) => (
    <Popover content={<div style={{ maxWidth: 300 }}>{evidence}</div>} title="原文证据">
      <EyeOutlined className="ml-2 text-blue-500 cursor-pointer" />
    </Popover>
  );

  // Render education tab
  const renderEducation = () => {
    const parsedData = getParsedData();
    const education = parsedData?.education || [];
    if (!education || education.length === 0) {
      return <Text type="secondary">未找到教育经历</Text>;
    }

    return (
      <div className="space-y-4">
        {education.map((edu, index) => (
          <Card key={index} size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Text strong>{edu.school}</Text>
                <Tag color="blue">{edu.degree}</Tag>
              </Space>
              <Text type="secondary">{edu.major}</Text>
              {edu.gpa && <Text type="secondary">GPA: {edu.gpa}</Text>}
              {edu.start_year && edu.end_year && (
                <Text type="secondary">{edu.start_year} - {edu.end_year}</Text>
              )}
              <Space>
                {renderEvidence(edu.evidence)}
              </Space>
            </Space>
          </Card>
        ))}
      </div>
    );
  };

  // Render experience tab
  const renderExperience = () => {
    const parsedData = getParsedData();
    const experience = parsedData?.experience || [];
    if (!experience || experience.length === 0) {
      return <Text type="secondary">未找到实习/工作经历</Text>;
    }

    return (
      <div className="space-y-4">
        {experience.map((exp, index) => (
          <Card key={index} size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Text strong>{exp.company}</Text>
                <Tag color={exp.is_internship ? 'green' : 'orange'}>{exp.is_internship ? '实习' : '全职'}</Tag>
              </Space>
              <Text>{exp.role}</Text>
              {exp.start_date && exp.end_date && (
                <Text type="secondary">{exp.start_date} - {exp.end_date}</Text>
              )}
              <Paragraph type="secondary" ellipsis={{ rows: 2 }}>{exp.description}</Paragraph>
              <Space>
                {renderEvidence(exp.evidence)}
              </Space>
            </Space>
          </Card>
        ))}
      </div>
    );
  };

  // Render projects tab
  const renderProjects = () => {
    const parsedData = getParsedData();
    const projects = parsedData?.projects || [];
    if (!projects || projects.length === 0) {
      return <Text type="secondary">未找到项目经历</Text>;
    }

    return (
      <div className="space-y-4">
        {projects.map((proj, index) => (
          <Card key={index} size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>{proj.name}</Text>
              {proj.role && <Text type="secondary">角色: {proj.role}</Text>}
              <Paragraph type="secondary" ellipsis={{ rows: 2 }}>{proj.description}</Paragraph>
              {proj.tech_stack && proj.tech_stack.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {proj.tech_stack.map((tech, i) => (
                    <Tag key={i} color="purple">{tech}</Tag>
                  ))}
                </div>
              )}
              {proj.outcome && <Text type="secondary">成果: {proj.outcome}</Text>}
              <Space>
                {renderEvidence(proj.evidence)}
              </Space>
            </Space>
          </Card>
        ))}
      </div>
    );
  };

  // Render skills tab
  const renderSkills = () => {
    const parsedData = getParsedData();
    const skills = parsedData?.skills || [];
    if (!skills || skills.length === 0) {
      return <Text type="secondary">未找到技能信息</Text>;
    }

    // Group by category
    const grouped = skills.reduce((acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = [];
      }
      acc[skill.category].push(skill);
      return acc;
    }, {} as Record<string, typeof skills>);

    return (
      <div className="space-y-4">
        {Object.entries(grouped).map(([category, categorySkills]) => (
          <Card key={category} size="small" title={category}>
            <div className="flex flex-wrap gap-2">
              {categorySkills.map((skill, index) => (
                <Tag
                  key={index}
                  color={
                    skill.proficiency === '熟练' ? 'green' :
                    skill.proficiency === '掌握' ? 'blue' :
                    skill.proficiency === '了解' ? 'orange' : 'default'
                  }
                >
                  {skill.name} ({skill.proficiency})
                  {skill.evidence && (
                    <span className="ml-1">{renderEvidence(skill.evidence)}</span>
                  )}
                </Tag>
              ))}
            </div>
          </Card>
        ))}
      </div>
    );
  };

  // Render certificates tab
  const renderCertificates = () => {
    const parsedData = getParsedData();
    const certificates = parsedData?.certificates || [];
    if (!certificates || certificates.length === 0) {
      return <Text type="secondary">未找到证书信息</Text>;
    }

    return (
      <div className="space-y-4">
        {certificates.map((cert, index) => (
          <Card key={index} size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>{cert.name}</Text>
              {cert.level && <Tag>{cert.level}</Tag>}
              {cert.obtained_date && <Text type="secondary">{cert.obtained_date}</Text>}
              <Space>
                {renderEvidence(cert.evidence)}
              </Space>
            </Space>
          </Card>
        ))}
      </div>
    );
  };

  // Step configuration
  const steps = [
    { title: '上传简历' },
    { title: '预览解析结果' },
    { title: '完成' },
  ];

  const currentStepIndex = currentStep === 'upload' ? 0 : currentStep === 'preview' ? 1 : 2;

  return (
    <div className="p-6">
      <Title level={2}>简历上传与解析</Title>

      <Steps current={currentStepIndex} className="mb-8">
        {steps.map(item => (
          <Steps.Step key={item.title} title={item.title} />
        ))}
      </Steps>

      {/* Step 1: Upload */}
      {currentStep === 'upload' && (
        <Card>
          <Dragger
            beforeUpload={beforeUpload}
            showUploadList={false}
            customRequest={({ file }) => handleUpload(file as File)}
            accept=".pdf,.docx"
            disabled={loading}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined className="text-4xl text-gray-400" />
            </p>
            <p className="text-lg">点击或拖拽文件到此处上传</p>
            <p className="text-gray-400">支持 PDF、DOCX 格式，文件大小不超过 5MB</p>
          </Dragger>
        </Card>
      )}

      {/* Step 2: Preview */}
      {currentStep === 'preview' && uploadResponse && (
        <div className="space-y-4">
          {/* Confidence warning */}
          {getParsedData()?.parse_confidence !== undefined && getParsedData()!.parse_confidence < 0.6 && (
            <Alert
              type="warning"
              message="解析置信度较低"
              description="解析结果可能存在误差，请仔细核对并手动修正"
              showIcon
            />
          )}

          {/* Confidence indicator */}
          <Card size="small">
            <Space>
              <Text>解析置信度:</Text>
              <Text strong style={{
                color: (getParsedData()?.parse_confidence ?? 0) >= 0.6 ? 'green' : 'orange'
              }}>
                {((getParsedData()?.parse_confidence ?? 0) * 100).toFixed(0)}%
              </Text>
            </Space>
          </Card>

          {/* Parse results */}
          <Tabs
            defaultActiveKey="education"
            items={[
              { key: 'education', label: '教育经历', children: renderEducation() },
              { key: 'experience', label: '实习/工作', children: renderExperience() },
              { key: 'projects', label: '项目经历', children: renderProjects() },
              { key: 'skills', label: '技能证书', children: (
                <>
                  {renderSkills()}
                  <div className="mt-4">{renderCertificates()}</div>
                </>
              )},
            ]}
          />

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <Button onClick={handleReset}>重新上传</Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleConfirm}
              loading={loading}
            >
              确认解析结果
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Complete */}
      {currentStep === 'complete' && (
        <Result
          status="success"
          title="简历上传成功"
          subTitle="简历已成功解析并保存，您可以继续查看学生画像"
          extra={[
            <Button key="reset" onClick={handleReset}>
              上传其他简历
            </Button>,
            <Button
              key="profile"
              type="primary"
              onClick={handleViewProfile}
            >
              查看学生画像
            </Button>,
          ]}
        />
      )}
    </div>
  );
}
