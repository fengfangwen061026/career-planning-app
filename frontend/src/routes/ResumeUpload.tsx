import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload,
  Button,
  Form,
  Input,
  Select,
  Space,
  Tag,
  message,
  Typography,
} from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  BookOutlined,
  ProjectOutlined,
  BankOutlined,
  ToolOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { Upload as UploadIcon, FileText, Loader2 } from 'lucide-react';
import { studentsApi } from '../api/students';
import type { StudentResponse, ResumeUploadResponse, StudentProfileCreate } from '../types/student';

// 模块专属色 - 琥珀橙色系
const MODULE_COLOR = '#CB8A4A';
const MODULE_BG = '#FEF5E9';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Parsed resume data structure
interface ParsedResumeData {
  name?: string;
  contact?: {
    phone?: string;
    email?: string;
    location?: string;
  };
  education?: Array<{
    school: string;
    degree: string;
    major?: string;
    start_year?: number;
    end_year?: number;
    gpa?: number;
    evidence?: string;
  }>;
  projects?: Array<{
    name: string;
    description?: string;
    tech_stack?: string[];
    role?: string;
    outcome?: string;
    evidence?: string;
  }>;
  experience?: Array<{
    company: string;
    position: string;
    duration?: string;
    description?: string;
  }>;
  skills?: Array<{
    name: string;
    category?: string;
    proficiency?: string;
    evidence?: string;
  }>;
}

function extractNameFromRawText(rawText: string): string | undefined {
  const firstLine = rawText.split('\n').find((line) => line.trim());
  if (!firstLine) {
    return undefined;
  }

  const colonMatch = firstLine.match(/(?:姓名|名字|Name)\s*[:：]\s*([^\s\t]+)/i);
  if (colonMatch?.[1]) {
    return colonMatch[1].trim();
  }

  const cleaned = firstLine.replace(/^(姓名|名字|Name)\s*[:：]?\s*/i, '').trim();
  return cleaned || undefined;
}

type UploadStep = 'upload' | 'parsing' | 'preview' | 'complete';

// Steps configuration
const STEPS = [
  { key: 'upload', label: '上传简历' },
  { key: 'parsing', label: '智能解析' },
  { key: 'preview', label: '预览确认' },
  { key: 'complete', label: '完成' },
];

// Custom glass-morphism card component
const GlassCard = ({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div
    className={className}
    style={{
      background: 'rgba(255,255,255,0.82)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.88)',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)',
      ...style,
    }}
  >
    {children}
  </div>
);

// Step indicator component
const StepIndicator = ({ currentStep }: { currentStep: UploadStep }) => {
  const currentIndex = STEPS.findIndex(s => s.key === currentStep);

  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((step, index) => (
        <div key={step.key} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                index < currentIndex
                  ? 'bg-[#CB8A4A] text-white'
                  : index === currentIndex
                  ? 'bg-[#CB8A4A] text-white ring-4 ring-[#FEF5E9]'
                  : 'bg-[#E5E7EB] text-[#9CA3AF]'
              }`}
            >
              {index < currentIndex ? (
                <CheckCircleOutlined className="text-sm" />
              ) : (
                index + 1
              )}
            </div>
            <span
              className={`mt-2 text-xs font-medium ${
                index <= currentIndex ? 'text-[#CB8A4A]' : 'text-[#9CA3AF]'
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < STEPS.length - 1 && (
            <div
              className={`w-16 h-0.5 mx-2 mb-6 transition-colors duration-300 ${
                index < currentIndex ? 'bg-[#CB8A4A]' : 'bg-[#E5E7EB]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default function ResumeUpload() {
  const [students, setStudents] = useState<StudentResponse[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [studentModalVisible, setStudentModalVisible] = useState(false);
  const [studentForm] = Form.useForm();
  const [profileForm] = Form.useForm();

  // Upload state
  const [uploadStep, setUploadStep] = useState<UploadStep>('upload');
  const [parseProgress, setParseProgress] = useState(0);
  const [parsedData, setParsedData] = useState<ParsedResumeData | null>(null);
  const [resumeResponse, setResumeResponse] = useState<ResumeUploadResponse | null>(null);
  const [profileCreated, setProfileCreated] = useState(false);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (!parsedData) {
      return;
    }

    profileForm.setFieldsValue({
      name: parsedData.name,
      phone: parsedData.contact?.phone,
      email: parsedData.contact?.email,
      location: parsedData.contact?.location,
      education: parsedData.education,
      projects: parsedData.projects,
      experience: parsedData.experience,
      skills: parsedData.skills,
    });
  }, [parsedData, profileForm]);

  const fetchStudents = async () => {
    try {
      const response = await studentsApi.getStudents();
      setStudents(response.data);
    } catch (error) {
      message.error('获取学生列表失败');
    }
  };

  const handleCreateStudent = async () => {
    try {
      const values = await studentForm.validateFields();
      const response = await studentsApi.createStudent(values);
      message.success('创建成功');
      setStudentModalVisible(false);
      studentForm.resetFields();
      fetchStudents();
      setSelectedStudent(response.data.id);
    } catch (error) {
      message.error('创建失败');
    }
  };

  // Simulate parsing progress
  const simulateParsing = () => {
    setUploadStep('parsing');
    setParseProgress(0);

    const interval = setInterval(() => {
      setParseProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Simulate variable progress
        const increment = Math.random() * 15 + 5;
        return Math.min(prev + increment, 100);
      });
    }, 300);

    return interval;
  };

  const handleUpload = async (file: File) => {
    if (!selectedStudent) {
      message.warning('请先选择学生');
      return false;
    }

    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      message.error('仅支持 PDF 和文件 DOCX 格式');
      return false;
    }

    setLoading(true);
    setProfileCreated(false);

    try {
      // Start progress simulation
      const progressInterval = simulateParsing();

      // Upload resume
      const response = await studentsApi.uploadResume(selectedStudent, file);
      console.info('[ResumeUpload] upload response', response.data);
      console.info('[ResumeUpload] response.data keys', Object.keys(response.data ?? {}));
      console.info(
        '[ResumeUpload] parsed_data keys',
        Object.keys((response.data?.parsed_data as Record<string, unknown>) ?? {})
      );

      // Stop progress simulation and set to 100%
      clearInterval(progressInterval);
      setParseProgress(100);

      // Brief delay for animation
      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      // Extract parsed data from the ResumeUploadResponse
      const parsedRecord = response.data.parsed_data as Record<string, unknown> | undefined;
      console.info('[ResumeUpload] parsed_data', parsedRecord);
      // Extract name from raw_text (first line typically contains name)
      const rawText = (parsedRecord?.raw_text as string) || '';
      const extractedName = extractNameFromRawText(rawText);

      // Transform backend education format to form format
      const backendEducation = (parsedRecord?.education as Array<Record<string, unknown>>) || [];
      const transformedEducation = backendEducation.map((edu) => ({
        school: edu.school as string,
        degree: edu.degree as string,
        major: edu.major as string | undefined,
        duration: edu.start_year && edu.end_year ? `${edu.start_year} - ${edu.end_year}` : undefined,
        gpa: edu.gpa as number | undefined,
      }));

      // Transform backend project format to form format
      const backendProjects = (parsedRecord?.projects as Array<Record<string, unknown>>) || [];
      const transformedProjects = backendProjects.map((proj) => ({
        name: proj.name as string,
        description: proj.description as string | undefined,
        skills: proj.tech_stack as string[] | undefined,
        duration: undefined,
      }));

      // Transform backend experience format to form format
      const backendExperience = (parsedRecord?.experience as Array<Record<string, unknown>>) || [];
      const transformedExperience = backendExperience.map((exp) => ({
        company: exp.company as string,
        position: (exp.role as string | undefined) || (exp.position as string | undefined) || '',
        duration: exp.start_date && exp.end_date ? `${exp.start_date} - ${exp.end_date}` : undefined,
        description: exp.description as string | undefined,
      }));

      const extractedData: ParsedResumeData = {
        name: extractedName,
        education: transformedEducation,
        projects: transformedProjects,
        experience: transformedExperience,
        skills: (parsedRecord?.skills as ParsedResumeData['skills']) || [],
      };
      console.info('[ResumeUpload] extracted form data', extractedData);

      setParsedData(extractedData);
      setResumeResponse(response.data);

      setTimeout(() => {
        setUploadStep('preview');
      }, 500);
    } catch (error: any) {
      const errorMessage =
        error?.code === 'ECONNABORTED'
          ? '简历解析耗时较长，请稍后重试'
          : error?.response?.data?.detail || '上传失败，请重试';
      message.error(errorMessage);
      setUploadStep('upload');
    } finally {
      setLoading(false);
    }

    return false;
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0]);
    }
  }, []);

  const handleConfirmProfile = async () => {
    if (!selectedStudent || !parsedData) return;

    try {
      const values = await profileForm.validateFields();

      const profileData: StudentProfileCreate = {
        student_id: selectedStudent,
        skills: values.skills,
        education: values.education,
        projects: values.projects,
        experience: values.experience,
      };

      await studentsApi.createStudentProfile(selectedStudent, profileData);
      message.success('学生画像创建成功');
      setProfileCreated(true);
      setUploadStep('complete');
    } catch (error) {
      message.error('创建画像失败，请重试');
    }
  };

  const handleReset = () => {
    setUploadStep('upload');
    setParseProgress(0);
    setParsedData(null);
    setResumeResponse(null);
    setProfileCreated(false);
    profileForm.resetFields();
  };

  // Render upload step - left panel
  const renderUploadPanel = () => (
    <div className="w-full lg:w-[40%]">
      <div
        className={`relative rounded-[16px] p-8 transition-all duration-300 cursor-pointer ${
          isDragging
            ? 'border-2 border-dashed border-[#CB8A4A] bg-[#FEF5E9]'
            : selectedStudent
            ? 'border-2 border-dashed border-[#E5E7EB] hover:border-[#CB8A4A] bg-[rgba(249,250,251,0.8)]'
            : 'border-2 border-dashed border-[#E5E7EB] bg-[rgba(249,250,251,0.8)] opacity-60'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <UploadIcon
            size={48}
            className={`mb-4 transition-colors ${isDragging ? 'text-[#CB8A4A]' : 'text-[#D1D5DB]'}`}
          />
          <p className="text-[14px] text-[#6B7280] mb-2">
            点击或拖拽文件到此区域上传
          </p>
          <p className="text-[12px] text-[#9CA3AF]">
            支持 PDF、DOCX 格式文件
          </p>

          {!selectedStudent && (
            <div className="mt-4 text-[12px] text-[#9CA3AF]">
              请先选择学生后再上传简历
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          accept=".pdf,.docx"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          disabled={!selectedStudent || loading}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleUpload(e.target.files[0]);
            }
          }}
        />
      </div>
    </div>
  );

  // Render parsing step
  const renderParsingStep = () => (
    <GlassCard className="text-center py-12">
      <div className="mb-6">
        <Loader2 className="w-12 h-12 text-[#CB8A4A] animate-spin mx-auto" />
      </div>
      <Title level={4} className="mb-4">正在解析简历...</Title>

      {/* Custom progress bar */}
      <div className="max-w-xs mx-auto mb-4">
        <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#CB8A4A] transition-all duration-300 ease-out rounded-full"
            style={{ width: `${Math.round(parseProgress)}%` }}
          />
        </div>
        <p className="text-[14px] text-[#6B7280] mt-2">
          {Math.round(parseProgress)}%
        </p>
      </div>

      <Text type="secondary">
        正在提取简历中的关键信息，请稍候
      </Text>
    </GlassCard>
  );

  // Render preview step
  const renderPreviewPanel = () => (
    <div className="w-full lg:w-[60%] space-y-4">
      <GlassCard>
        <div className="ds-section-title" style={{ color: MODULE_COLOR }}>
          <UserOutlined />
          基本信息
        </div>
        <Form form={profileForm} layout="vertical">
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="name"
              label="姓名"
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="请输入姓名" />
            </Form.Item>
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
            </Form.Item>
            <Form.Item
              name="phone"
              label="电话"
            >
              <Input prefix={<PhoneOutlined />} placeholder="请输入电话" />
            </Form.Item>
            <Form.Item
              name="location"
              label="所在地"
            >
              <Input placeholder="请输入所在地" />
            </Form.Item>
          </div>
        </Form>
      </GlassCard>

      <GlassCard>
        <div className="ds-section-title" style={{ color: MODULE_COLOR }}>
          <BookOutlined />
          教育经历
        </div>
        {parsedData?.education?.map((edu, index) => (
          <div key={index} className={index > 0 ? 'mt-4 pt-4 border-t border-[#E5E7EB]' : ''}>
            <Form.Item
              name={['education', index, 'school']}
              label="学校"
              className="mb-2"
            >
              <Input placeholder="学校名称" />
            </Form.Item>
            <div className="grid grid-cols-3 gap-4">
              <Form.Item
                name={['education', index, 'degree']}
                label="学历"
              >
                <Select
                  placeholder="请选择学历"
                  options={[
                    { value: '高中', label: '高中' },
                    { value: '大专', label: '大专' },
                    { value: '本科', label: '本科' },
                    { value: '硕士', label: '硕士' },
                    { value: '博士', label: '博士' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name={['education', index, 'major']}
                label="专业"
              >
                <Input placeholder="专业名称" />
              </Form.Item>
              <Form.Item
                name={['education', index, 'duration']}
                label="时间"
              >
                <Input placeholder="例如: 2020 - 2024" />
              </Form.Item>
            </div>
          </div>
        ))}
      </GlassCard>

      <GlassCard>
        <div className="ds-section-title" style={{ color: MODULE_COLOR }}>
          <ProjectOutlined />
          项目经验
        </div>
        {parsedData?.projects?.map((project, index) => (
          <div key={index} className={index > 0 ? 'mt-4 pt-4 border-t border-[#E5E7EB]' : ''}>
            <Form.Item
              name={['projects', index, 'name']}
              label="项目名称"
              className="mb-2"
            >
              <Input placeholder="项目名称" />
            </Form.Item>
            <Form.Item
              name={['projects', index, 'description']}
              label="项目描述"
              className="mb-2"
            >
              <TextArea rows={2} placeholder="项目描述" />
            </Form.Item>
            <Form.Item
              name={['projects', index, 'duration']}
              label="时间"
              className="mb-2"
            >
              <Input placeholder="例如: 2023.06 - 2023.12" />
            </Form.Item>
            <Form.Item
              name={['projects', index, 'skills']}
              label="技术栈"
            >
              <Select
                mode="tags"
                placeholder="输入技术栈并按回车"
              />
            </Form.Item>
          </div>
        ))}
      </GlassCard>

      <GlassCard>
        <div className="ds-section-title" style={{ color: MODULE_COLOR }}>
          <BankOutlined />
          实习经历
        </div>
        {parsedData?.experience?.map((exp, index) => (
          <div key={index} className={index > 0 ? 'mt-4 pt-4 border-t border-[#E5E7EB]' : ''}>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name={['experience', index, 'company']}
                label="公司"
              >
                <Input placeholder="公司名称" />
              </Form.Item>
              <Form.Item
                name={['experience', index, 'position']}
                label="职位"
              >
                <Input placeholder="职位名称" />
              </Form.Item>
            </div>
            <Form.Item
              name={['experience', index, 'duration']}
              label="时间"
              className="mb-2"
            >
              <Input placeholder="例如: 2023.07 - 2023.09" />
            </Form.Item>
            <Form.Item
              name={['experience', index, 'description']}
              label="工作描述"
            >
              <TextArea rows={2} placeholder="工作描述" />
            </Form.Item>
          </div>
        ))}
      </GlassCard>

      <GlassCard>
        <div className="ds-section-title" style={{ color: MODULE_COLOR }}>
          <ToolOutlined />
          技能
        </div>
        <Form.Item name="skills">
          <Select
            mode="tags"
            placeholder="输入技能并按回车确认"
          />
        </Form.Item>
        <div className="mt-2">
          {parsedData?.skills && parsedData.skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {parsedData.skills.map((skill, index) => (
                <Tag key={index} style={{
                  background: 'rgba(203,138,74,0.10)',
                  color: '#7D4F1E',
                  border: '1px solid rgba(203,138,74,0.18)',
                  borderRadius: '6px',
                }}>
                  {typeof skill === 'string' ? skill : skill.name}
                  {skill.proficiency && ` (${skill.proficiency})`}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </GlassCard>

      <div className="flex justify-end space-x-4">
        <Button
          onClick={handleReset}
          style={{
            borderRadius: '10px',
            padding: '10px 24px',
          }}
        >
          重新上传
        </Button>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={handleConfirmProfile}
          size="large"
          style={{
            background: '#CB8A4A',
            borderRadius: '10px',
            padding: '10px 24px',
            fontWeight: 600,
          }}
        >
          确认并创建画像
        </Button>
      </div>
    </div>
  );

  // Render complete step
  const renderCompleteStep = () => (
    <GlassCard className="text-center py-12 max-w-md mx-auto">
      <div className="mb-6">
        <CheckCircleOutlined className="text-5xl text-[#5E8F6E]" />
      </div>
      <Title level={3} className="mb-2">学生画像创建成功</Title>
      <Text type="secondary" className="block mb-6">
        学生画像已成功创建，您可以在学生画像页面查看和管理
      </Text>
      <Space>
        <Button
          onClick={handleReset}
          style={{
            borderRadius: '10px',
            padding: '10px 24px',
          }}
        >
          上传其他简历
        </Button>
        <Button
          type="primary"
          onClick={() => window.location.href = '/students'}
          style={{
            background: '#CB8A4A',
            borderRadius: '10px',
            padding: '10px 24px',
            fontWeight: 600,
          }}
        >
          查看学生画像
        </Button>
      </Space>
    </GlassCard>
  );

  return (
    <div className="ds-page">
      {/* 页面标题区 */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(203,138,74,0.10)',
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            color: MODULE_COLOR,
            marginBottom: 10,
          }}
        >
          <UploadIcon size={12} /> 简历上传
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
          简历上传与解析
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '6px 0 0 0' }}>
          上传简历并自动解析生成学生画像
        </p>
      </div>

      {/* Step Indicator */}
      {uploadStep !== 'complete' && <StepIndicator currentStep={uploadStep} />}

      {/* Student Selection */}
      <GlassCard className="mb-6">
        <Space>
          <Select
            placeholder="选择学生"
            style={{ width: 250, borderRadius: '10px' }}
            value={selectedStudent}
            onChange={(value) => {
              setSelectedStudent(value);
              handleReset();
            }}
            allowClear
            options={students.map((s) => ({
              value: s.id,
              label: s.name || s.email,
            }))}
          />
          <Button
            onClick={() => setStudentModalVisible(true)}
            style={{
              borderRadius: '10px',
              padding: '10px 24px',
            }}
          >
            新建学生
          </Button>
        </Space>
      </GlassCard>

      {/* Main Content */}
      {loading || uploadStep === 'parsing' ? (
        renderParsingStep()
      ) : uploadStep === 'complete' ? (
        renderCompleteStep()
      ) : uploadStep === 'preview' ? (
        // Two-column layout for preview
        <div className="flex flex-col lg:flex-row gap-6">
          {renderUploadPanel()}
          {renderPreviewPanel()}
        </div>
      ) : (
        // Two-column layout for upload
        <div className="flex flex-col lg:flex-row gap-6">
          {renderUploadPanel()}
          {/* Empty right panel as placeholder */}
          <div className="w-full lg:w-[60%]">
            <GlassCard className="h-full flex items-center justify-center min-h-[300px]">
              <div className="text-center">
                <FileText className="w-16 h-16 text-[#E5E7EB] mx-auto mb-4" />
                <p className="text-[#9CA3AF]">
                  上传简历后将在此处显示解析结果
                </p>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* Create Student Modal */}
      <div style={{ display: studentModalVisible ? 'block' : 'none' }}>
        <GlassCard className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#374151]">新建学生</h3>
            <Button
              type="primary"
              onClick={handleCreateStudent}
              style={{
                background: '#CB8A4A',
                borderRadius: '10px',
                padding: '10px 24px',
                fontWeight: 600,
              }}
            >
              创建
            </Button>
          </div>
          <Form form={studentForm} layout="vertical">
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="name" label="姓名">
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="电话">
              <Input />
            </Form.Item>
          </Form>
        </GlassCard>
      </div>
    </div>
  );
}
