import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Card,
  Upload,
  Button,
  Progress,
  Form,
  Input,
  Select,
  Space,
  Divider,
  Tag,
  message,
  Typography,
} from 'antd';
import {
  InboxOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  BookOutlined,
  ProjectOutlined,
  BankOutlined,
  ToolOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { studentsApi } from '../api/students';
import type { StudentResponse, ResumeUploadResponse, StudentProfileCreate } from '../types/student';

const { Title, Text } = Typography;
const { Dragger } = Upload;
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

type UploadStep = 'upload' | 'parsing' | 'preview' | 'complete';

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

      // Stop progress simulation and set to 100%
      clearInterval(progressInterval);
      setParseProgress(100);

      // Brief delay for animation
      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      // Extract parsed data from the ResumeUploadResponse
      const parsedRecord = response.data.parsed_data as Record<string, unknown> | undefined;
      // Extract name from raw_text (first line typically contains name)
      const rawText = (parsedRecord?.raw_text as string) || '';
      const nameMatch = rawText.split('\n')[0]?.match(/^[^\u0000-\u001F\u007F-\u9FFF]+/);

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
        position: exp.role as string,
        duration: exp.start_date && exp.end_date ? `${exp.start_date} - ${exp.end_date}` : undefined,
        description: exp.description as string | undefined,
      }));

      const extractedData: ParsedResumeData = {
        name: nameMatch ? nameMatch[0] : undefined,
        education: transformedEducation,
        projects: transformedProjects,
        experience: transformedExperience,
        skills: (parsedRecord?.skills as ParsedResumeData['skills']) || [],
      };

      setParsedData(extractedData);
      setResumeResponse(response.data);

      // Initialize form with parsed data
      profileForm.setFieldsValue({
        name: extractedData.name,
        phone: extractedData.contact?.phone,
        email: extractedData.contact?.email,
        location: extractedData.contact?.location,
        education: extractedData.education,
        projects: extractedData.projects,
        experience: extractedData.experience,
        skills: extractedData.skills,
      });

      setTimeout(() => {
        setUploadStep('preview');
      }, 500);
    } catch (error) {
      message.error('上传失败，请重试');
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

  // Render upload step
  const renderUploadStep = () => (
    <div
      className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Dragger
        beforeUpload={handleUpload}
        showUploadList={false}
        disabled={!selectedStudent || loading}
        accept=".pdf,.docx"
        className="bg-transparent"
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined className="text-4xl text-gray-400" />
        </p>
        <p className="text-lg text-gray-600">
          点击或拖拽文件到此区域上传
        </p>
        <p className="text-gray-400">
          支持 PDF、DOCX 格式文件
        </p>
      </Dragger>

      {!selectedStudent && (
        <div className="text-center mt-4 text-gray-400">
          请先选择学生后再上传简历
        </div>
      )}
    </div>
  );

  // Render parsing step
  const renderParsingStep = () => (
    <Card className="text-center py-8">
      <div className="mb-4">
        <InboxOutlined className="text-4xl text-blue-500" />
      </div>
      <Title level={4}>正在解析简历...</Title>
      <Progress
        percent={Math.round(parseProgress)}
        status="active"
        className="max-w-xs mx-auto"
      />
      <Text type="secondary">
        正在提取简历中的关键信息，请稍候
      </Text>
    </Card>
  );

  // Render preview step
  const renderPreviewStep = () => (
    <div className="space-y-4">
      <Card
        title={
          <Space>
            <UserOutlined />
            <span>基本信息</span>
          </Space>
        }
      >
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
      </Card>

      <Card
        title={
          <Space>
            <BookOutlined />
            <span>教育经历</span>
          </Space>
        }
      >
        {parsedData?.education?.map((edu, index) => (
          <div key={index} className="mb-4 last:mb-0">
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
            {index < (parsedData.education?.length || 0) - 1 && <Divider />}
          </div>
        ))}
      </Card>

      <Card
        title={
          <Space>
            <ProjectOutlined />
            <span>项目经验</span>
          </Space>
        }
      >
        {parsedData?.projects?.map((project, index) => (
          <div key={index} className="mb-4 last:mb-0">
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
            {index < (parsedData.projects?.length || 0) - 1 && <Divider />}
          </div>
        ))}
      </Card>

      <Card
        title={
          <Space>
            <BankOutlined />
            <span>实习经历</span>
          </Space>
        }
      >
        {parsedData?.experience?.map((exp, index) => (
          <div key={index} className="mb-4 last:mb-0">
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
            {index < (parsedData.experience?.length || 0) - 1 && <Divider />}
          </div>
        ))}
      </Card>

      <Card
        title={
          <Space>
            <ToolOutlined />
            <span>技能</span>
          </Space>
        }
      >
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
                <Tag key={index} color="blue">
                  {typeof skill === 'string' ? skill : skill.name}
                  {skill.proficiency && ` (${skill.proficiency})`}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-end space-x-4">
        <Button onClick={handleReset}>
          重新上传
        </Button>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={handleConfirmProfile}
          size="large"
        >
          确认并创建画像
        </Button>
      </div>
    </div>
  );

  // Render complete step
  const renderCompleteStep = () => (
    <Card className="text-center py-8">
      <div className="mb-4">
        <CheckCircleOutlined className="text-5xl text-green-500" />
      </div>
      <Title level={3}>学生画像创建成功</Title>
      <Text type="secondary" className="block mb-6">
        学生画像已成功创建，您可以在学生画像页面查看和管理
      </Text>
      <Space>
        <Button onClick={handleReset}>
          上传其他简历
        </Button>
        <Button type="primary" onClick={() => window.location.href = '/students'}>
          查看学生画像
        </Button>
      </Space>
    </Card>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">简历上传与解析</h1>

      {/* Student Selection */}
      <Card className="mb-4">
        <Space>
          <Select
            placeholder="选择学生"
            style={{ width: 250 }}
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
          <Button onClick={() => setStudentModalVisible(true)}>
            新建学生
          </Button>
        </Space>
      </Card>

      {/* Main Content */}
      {loading || uploadStep === 'parsing' ? (
        renderParsingStep()
      ) : uploadStep === 'complete' ? (
        renderCompleteStep()
      ) : uploadStep === 'preview' ? (
        renderPreviewStep()
      ) : (
        renderUploadStep()
      )}

      {/* Create Student Modal */}
      <Card
        title="新建学生"
        className="mt-4"
        extra={
          <Button type="primary" onClick={handleCreateStudent}>
            创建
          </Button>
        }
        style={{ display: studentModalVisible ? 'block' : 'none' }}
      >
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
      </Card>
    </div>
  );
}
