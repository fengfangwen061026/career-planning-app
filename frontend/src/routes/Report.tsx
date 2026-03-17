import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Button,
  Space,
  Select,
  Menu,
  Progress,
  message,
  Modal,
  List,
  Tag,
  Typography,
  Divider,
  Empty,
  Alert,
  Drawer,
  Input,
} from 'antd';
import {
  PlusOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  EditOutlined,
  HistoryOutlined,
  RollbackOutlined,
  HighlightOutlined,
  CheckOutlined,
  DownloadOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { studentsApi } from '../api/students';
import { FileText } from 'lucide-react';
import { reportsApi } from '../api/reports';
import { matchingApi } from '../api/matching';
import client from '../api/client';
import type { StudentResponse } from '../types/student';
import type { CareerReportResponse, ReportVersionResponse } from '../types/report';
import type { MatchResultResponse } from '../types/matching';
// Note: MatchResultResponse has different fields than before (four-dimension scores)
import LoadingState from '../components/LoadingState';

// Glass-morphism 样式组件
// 模块专属色 - 蒂芙尼绿色系
const MODULE_COLOR = '#5E8A7C';
const MODULE_BG = '#EDF5F2';

const GlassCard = ({ children, className = '', style = {}, id = '' }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; id?: string }) => (
  <div
    id={id}
    className={className}
    style={{
      background: 'rgba(255,255,255,0.82)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)',
      ...style,
    }}
  >
    {children}
  </div>
);

const GlassPanel = ({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div
    className={className}
    style={{
      background: 'rgba(255,255,255,0.82)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.88)',
      ...style,
    }}
  >
    {children}
  </div>
);
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// 报告章节结构
interface ReportSection {
  title: string;
  content: string;
  key_points?: string[];
}

interface ReportChapter {
  chapter_id: number;
  title: string;
  description?: string;
  sections: ReportSection[];
  tables?: { title: string; headers: string[]; rows: string[][] }[];
  charts?: { type: string; title: string; data: Record<string, unknown> }[];
}

interface ReportContent {
  outline?: {
    title: string;
    chapters: ReportChapter[];
  };
  chapters: ReportChapter[];
  metadata?: {
    generated_at: string;
    student_id: string;
    version: string;
  };
}

export default function Report() {
  const [students, setStudents] = useState<StudentResponse[]>([]);
  const [reports, setReports] = useState<CareerReportResponse[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResultResponse[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<CareerReportResponse | null>(null);
  const [reportContent, setReportContent] = useState<ReportContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState<{ chapter: string; progress: number } | null>(null);

  // 编辑状态
  const [editingChapter, setEditingChapter] = useState<number | null>(null);
  const [editedContent, setEditedContent] = useState<Record<number, ReportChapter>>({});
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 版本管理
  const [versions, setVersions] = useState<ReportVersionResponse[]>([]);
  const [versionsVisible, setVersionsVisible] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ReportVersionResponse | null>(null);

  // 完整性检查
  const [completenessVisible, setCompletenessVisible] = useState(false);
  const [completenessResult, setCompletenessResult] = useState<{
    complete: boolean;
    missing_items: string[];
    suggestions: string[];
  } | null>(null);

  // 润色
  const [polishing, setPolishing] = useState(false);
  const [polishChanges, setPolishChanges] = useState<string[]>([]);

  // 侧边栏
  const [tocVisible, setTocVisible] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      fetchReports(selectedStudent);
      fetchMatchResults(selectedStudent);
    }
  }, [selectedStudent]);

  const fetchStudents = async () => {
    try {
      const response = await studentsApi.getStudents();
      setStudents(response.data);
    } catch (error) {
      message.error('获取学生列表失败');
    }
  };

  const fetchReports = async (studentId: string) => {
    setLoading(true);
    try {
      const response = await reportsApi.getReports({ student_id: studentId });
      setReports(response.data);
    } catch (error) {
      message.error('获取报告列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchResults = async (studentId: string) => {
    try {
      const response = await matchingApi.getMatchingResults(studentId);
      setMatchResults(response.data.results);
    } catch (error) {
      // No results yet
    }
  };

  const fetchReportContent = async (reportId: string) => {
    try {
      const response = await reportsApi.getReport(reportId);
      const contentJson = response.data.content_json;
      // 安全地将 content_json 转换为 ReportContent
      if (contentJson && typeof contentJson === 'object' && 'chapters' in contentJson) {
        setReportContent(contentJson as unknown as ReportContent);
      }
      setEditedContent({});
      setSaveStatus('saved');

      // 获取版本列表
      fetchVersions(reportId);
    } catch (error) {
      message.error('获取报告内容失败');
    }
  };

  const fetchVersions = async (reportId: string) => {
    try {
      const response = await reportsApi.getReportVersions(reportId);
      setVersions(response.data);
    } catch (error) {
      console.error('获取版本列表失败', error);
    }
  };

  const generateReport = async () => {
    if (!selectedStudent) {
      message.warning('请先选择学生');
      return;
    }
    setGenerating(true);
    setGeneratingProgress({ chapter: '准备生成报告...', progress: 0 });

    try {
      // 模拟进度更新（实际应该用WebSocket或SSE）
      const progressSteps = [
        { chapter: '生成报告纲要...', progress: 20 },
        { chapter: '生成个人画像分析...', progress: 40 },
        { chapter: '生成目标岗位分析...', progress: 60 },
        { chapter: '生成人岗匹配评估...', progress: 80 },
        { chapter: '生成能力提升建议...', progress: 90 },
        { chapter: '生成职业发展规划...', progress: 95 },
      ];

      for (const step of progressSteps) {
        setGeneratingProgress(step);
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      const response = await reportsApi.generateReport({
        student_id: selectedStudent,
        include_export: false,
      });

      message.success('报告生成成功');
      fetchReports(selectedStudent);
      setSelectedReport(response.data);
      await fetchReportContent(response.data.id);
      setGeneratingProgress({ chapter: '完成', progress: 100 });

      setTimeout(() => setGeneratingProgress(null), 1000);
    } catch (error) {
      message.error('报告生成失败');
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  // 自动保存到后端
  const autoSaveContent = useCallback(async () => {
    if (!selectedReport || !reportContent) return;

    setSaveStatus('saving');
    try {
      // 合并编辑内容
      const updatedContent = {
        ...reportContent,
        chapters: reportContent.chapters.map(ch => editedContent[ch.chapter_id] || ch),
      };

      await reportsApi.updateReport(selectedReport.id, {
        content_json: updatedContent as unknown as Record<string, unknown>,
      });

      setReportContent(updatedContent);
      setSaveStatus('saved');
      message.success('已自动保存');
    } catch (error) {
      console.error('自动保存失败', error);
      setSaveStatus('unsaved');
    }
  }, [selectedReport, reportContent, editedContent]);

  // 防抖保存
  useEffect(() => {
    if (Object.keys(editedContent).length === 0) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('unsaved');
    saveTimeoutRef.current = setTimeout(() => {
      autoSaveContent();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editedContent, autoSaveContent]);

  // 更新章节内容
  const updateChapterContent = (chapterId: number, sectionIndex: number, field: 'title' | 'content', value: string) => {
    const chapter = reportContent?.chapters.find(c => c.chapter_id === chapterId);
    if (!chapter) return;

    const updatedChapter = {
      ...chapter,
      sections: chapter.sections.map((s, i) =>
        i === sectionIndex ? { ...s, [field]: value } : s
      ),
    };

    setEditedContent(prev => ({
      ...prev,
      [chapterId]: updatedChapter,
    }));
  };

  // 添加新段落
  const addSection = (chapterId: number) => {
    const chapter = reportContent?.chapters.find(c => c.chapter_id === chapterId);
    if (!chapter) return;

    const newSection: ReportSection = {
      title: '新章节',
      content: '请输入内容...',
    };

    const updatedChapter = {
      ...chapter,
      sections: [...chapter.sections, newSection],
    };

    setEditedContent(prev => ({
      ...prev,
      [chapterId]: updatedChapter,
    }));
  };

  // 删除段落
  const deleteSection = (chapterId: number, sectionIndex: number) => {
    const chapter = reportContent?.chapters.find(c => c.chapter_id === chapterId);
    if (!chapter) return;

    const updatedChapter = {
      ...chapter,
      sections: chapter.sections.filter((_, i) => i !== sectionIndex),
    };

    setEditedContent(prev => ({
      ...prev,
      [chapterId]: updatedChapter,
    }));
  };

  // 智能润色
  const polishReport = async () => {
    if (!selectedReport) return;

    setPolishing(true);
    try {
      const response = await client.post<{ polished: boolean; changes?: string[]; version?: string; error?: string }>(
        `/reports/${selectedReport.id}/polish`
      );
      const result = response.data;

      if (result.polished) {
        setPolishChanges(result.changes || []);
        message.success(`润色完成，版本更新为 ${result.version}`);
        await fetchReportContent(selectedReport.id);
      } else {
        message.error(result.error || '润色失败');
      }
    } catch (error) {
      message.error('润色失败');
    } finally {
      setPolishing(false);
    }
  };

  // 完整性检查
  const checkCompleteness = async () => {
    if (!selectedReport) return;

    try {
      const response = await client.post<{ complete: boolean; missing_items: string[]; suggestions: string[] }>(
        `/reports/${selectedReport.id}/check`
      );
      setCompletenessResult(response.data);
      setCompletenessVisible(true);
    } catch (error) {
      message.error('检查失败');
    }
  };

  // 导出报告
  const exportReport = async (format: 'pdf' | 'docx') => {
    if (!selectedReport) return;

    try {
      const response = await reportsApi.exportReport({
        report_id: selectedReport.id,
        format,
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `职业规划报告_${selectedReport.version || '1.0'}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  // 回退版本
  const rollbackToVersion = async (version: ReportVersionResponse) => {
    if (!selectedReport) return;

    Modal.confirm({
      title: '确认回退',
      content: `确定要回退到版本 ${version.version} 吗？当前内容将被覆盖。`,
      onOk: async () => {
        try {
          await reportsApi.updateReport(selectedReport.id, {
            content_json: version.content,
          });
          message.success('已回退到指定版本');
          await fetchReportContent(selectedReport.id);
          setVersionsVisible(false);
        } catch (error) {
          message.error('回退失败');
        }
      },
    });
  };

  // 渲染章节内容
  const renderChapter = (chapter: ReportChapter, isEditing: boolean) => {
    const displayChapter = editedContent[chapter.chapter_id] || chapter;

    // 关键词高亮处理
    const highlightKeywords = (text: string) => {
      if (!text) return text;
      // 简单处理：将关键词用高亮样式包裹
      return text;
    };

    return (
      <GlassCard
        id={`chapter-${chapter.chapter_id}`}
        key={chapter.chapter_id}
        className="mb-4"
        style={{ padding: 32, marginBottom: 16, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: 16 }}
      >
        <div className="flex items-center justify-between mb-4">
          <Title level={3} className="!mb-0" style={{ fontSize: 20, fontWeight: 700, color: '#0A0A0A' }}>
            {chapter.chapter_id}. {displayChapter.title}
          </Title>
          {isEditing && (
            <Tag color="blue">编辑中</Tag>
          )}
        </div>

        {displayChapter.description && (
          <Text type="secondary" className="mb-4 block" style={{ fontSize: 14, lineHeight: 1.8, color: '#374151' }}>
            {displayChapter.description}
          </Text>
        )}

        <Divider />

        {displayChapter.sections.map((section, sectionIndex) => (
          <div
            key={sectionIndex}
            className="mb-6 p-4 rounded-lg"
            style={{ background: 'rgba(238,242,255,0.5)', borderRadius: 12, padding: 20, marginBottom: 16 }}
          >
            <div className="flex items-start justify-between mb-2">
              {isEditing ? (
                <Input
                  value={section.title}
                  onChange={(e) => updateChapterContent(chapter.chapter_id, sectionIndex, 'title', e.target.value)}
                  className="font-medium mb-2"
                  placeholder="小节标题"
                  style={{ fontWeight: 600 }}
                />
              ) : (
                <Title level={5} className="!mb-2" style={{ fontSize: 16, fontWeight: 600, color: '#1F2937' }}>
                  {section.title}
                </Title>
              )}
              {isEditing && (
                <Button
                  type="text"
                  danger
                  size="small"
                  onClick={() => deleteSection(chapter.chapter_id, sectionIndex)}
                >
                  删除
                </Button>
              )}
            </div>

            {isEditing ? (
              <TextArea
                value={section.content}
                onChange={(e) => updateChapterContent(chapter.chapter_id, sectionIndex, 'content', e.target.value)}
                autoSize={{ minRows: 3 }}
                placeholder="请输入内容..."
              />
            ) : (
              <Paragraph style={{ fontSize: 14, lineHeight: 1.8, color: '#374151' }}>
                {section.content || '暂无内容'}
              </Paragraph>
            )}

            {section.key_points && section.key_points.length > 0 && !isEditing && (
              <ul className="list-disc list-inside mt-2 text-gray-600" style={{ fontSize: 14, lineHeight: 1.8, color: '#374151' }}>
                {section.key_points.map((point, i) => (
                  <li key={i}>
                    <span style={{ background: '#EDF5F2', color: '#5E8A7C', borderRadius: 4, padding: '1px 6px' }}>{point}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {isEditing && (
          <Button
            type="dashed"
            onClick={() => addSection(chapter.chapter_id)}
            block
          >
            + 添加段落
          </Button>
        )}
      </GlassCard>
    );
  };

  // 页面标题区
  const pageHeader = (
    <div style={{ marginBottom: 28, padding: '0 16px' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(94,138,124,0.10)',
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          color: MODULE_COLOR,
          marginBottom: 10,
        }}
      >
        <FileText size={12} /> 报告导出
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
        报告导出
      </h1>
      <p style={{ fontSize: 14, color: '#6B7280', margin: '6px 0 0 0' }}>
        生成和管理职业规划报告
      </p>
    </div>
  );

  return (
    <div data-module="reports" className="p-6">
      {pageHeader}
      <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <GlassPanel className="mb-4 p-4" style={{ margin: '0 16px', marginTop: 16 }}>
        <Space wrap>
          <Select
            placeholder="选择学生"
            style={{ width: 250 }}
            value={selectedStudent}
            onChange={(val) => {
              setSelectedStudent(val);
              setSelectedReport(null);
              setReportContent(null);
            }}
            allowClear
            options={students.map((s) => ({
              value: s.id,
              label: s.name || s.email,
            }))}
          />

          <Select
            placeholder="选择报告"
            style={{ width: 300 }}
            value={selectedReport?.id}
            onChange={(val) => {
              const report = reports.find(r => r.id === val);
              setSelectedReport(report || null);
              if (report) fetchReportContent(report.id);
            }}
            allowClear
            disabled={!selectedStudent}
            options={reports.map((r) => ({
              value: r.id,
              label: `${r.title || '未命名'} (v${r.version || '1.0'})`,
            }))}
          />

          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={generating}
            onClick={generateReport}
          >
            {generating ? '生成中...' : '一键生成'}
          </Button>

          {selectedReport && (
            <>
              <Divider type="vertical" />

              <Button
                icon={<HighlightOutlined />}
                onClick={polishReport}
                loading={polishing}
              >
                智能润色
              </Button>

              <Button
                icon={<CheckOutlined />}
                onClick={checkCompleteness}
              >
                完整性检查
              </Button>

              <Button
                icon={<DownloadOutlined />}
                onClick={() => exportReport('pdf')}
              >
                导出 PDF
              </Button>

              <Button
                icon={<HistoryOutlined />}
                onClick={() => setVersionsVisible(true)}
              >
                版本管理
              </Button>

              <Divider type="vertical" />

              <Button
                type={editingChapter !== null ? 'primary' : 'default'}
                icon={<EditOutlined />}
                onClick={() => setEditingChapter(editingChapter === null ? 1 : null)}
              >
                {editingChapter !== null ? '退出编辑' : '编辑'}
              </Button>

              <Tag color={saveStatus === 'saved' ? 'green' : saveStatus === 'saving' ? 'blue' : 'orange'}>
                {saveStatus === 'saved' ? '已保存' : saveStatus === 'saving' ? '保存中...' : '未保存'}
              </Tag>
            </>
          )}
        </Space>
      </GlassPanel>

      {/* 生成进度 */}
      {generatingProgress && (
        <GlassPanel className="mb-4" style={{ margin: '0 16px' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>{generatingProgress.chapter}</Text>
            <Progress
              percent={generatingProgress.progress}
              status={generatingProgress.progress === 100 ? 'success' : 'active'}
            />
          </Space>
        </GlassPanel>
      )}

      {/* 主内容区 */}
      {loading ? (
        <LoadingState />
      ) : !selectedReport ? (
        <GlassPanel className="flex-1 flex items-center justify-center" style={{ margin: '0 16px', minHeight: 400 }}>
          <div className="text-center">
            <FilePdfOutlined style={{ fontSize: 48, color: '#9CA3AF' }} />
            <Typography.Title level={4} style={{ color: '#6B7280', marginTop: 16 }}>
              请选择学生和报告，或生成新报告
            </Typography.Title>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => selectedStudent && generateReport()} disabled={!selectedStudent}>
              生成报告
            </Button>
          </div>
        </GlassPanel>
      ) : (
        <div className="flex-1 flex gap-4 overflow-hidden px-4 pb-4">
          {/* 左侧导航 */}
          {tocVisible && reportContent && (
            <GlassPanel
              className="w-60 flex-shrink-0 overflow-auto"
              style={{ width: 240, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRight: '1px solid var(--gray-200)' }}
            >
              <div className="p-4 border-b border-gray-200">
                <Space>
                  <MenuOutlined />
                  <span className="font-medium">目录</span>
                </Space>
              </div>
              <Menu
                mode="inline"
                style={{ background: 'transparent', borderRight: 0 }}
                selectedKeys={[]}
                items={reportContent.chapters.map(ch => ({
                  key: ch.chapter_id,
                  label: (
                    <div
                      className="py-2 px-2 rounded-lg text-sm cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => {
                        const element = document.getElementById(`chapter-${ch.chapter_id}`);
                        element?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      {ch.chapter_id}. {ch.title}
                    </div>
                  ),
                }))}
              />
            </GlassPanel>
          )}

          {/* 中间报告内容 */}
          <GlassCard
            className="flex-1 overflow-auto"
            style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)' }}
          >
            {/* 报告头部 */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <Space>
                <span className="text-lg font-semibold">{reportContent?.outline?.title || selectedReport.title || '职业规划报告'}</span>
                <span className="bg-blue-50 text-indigo-600 rounded-md px-2 py-1 text-xs font-medium">v{selectedReport.version || '1.0'}</span>
              </Space>
              <div className="flex gap-3">
                <Button
                  style={{ background: '#5E8A7C', borderRadius: 10, fontWeight: 600, color: 'white', border: 'none', padding: '10px 24px' }}
                  icon={<FilePdfOutlined />}
                  onClick={() => exportReport('pdf')}
                >
                  导出 PDF
                </Button>
                <Button
                  style={{ background: 'transparent', border: '1.5px solid var(--gray-200)', borderRadius: 10, color: '#374151' }}
                  icon={<FileWordOutlined />}
                  onClick={() => exportReport('docx')}
                >
                  导出 Word
                </Button>
                <Button
                  type="text"
                  onClick={() => setTocVisible(!tocVisible)}
                >
                  {tocVisible ? '隐藏目录' : '显示目录'}
                </Button>
              </div>
            </div>

            {/* 报告主体 */}
            <div className="p-6 overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {reportContent?.chapters ? (
              <div className="max-w-4xl mx-auto">
                {/* 摘要 */}
                <GlassCard className="mb-4 p-6" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: 16, marginBottom: 16 }}>
                  <Title level={5} style={{ fontSize: 20, fontWeight: 700, color: '#0A0A0A', marginBottom: 12 }}>报告摘要</Title>
                  <Paragraph style={{ fontSize: 14, lineHeight: 1.8, color: '#374151' }}>
                    {selectedReport.summary || '暂无摘要'}
                  </Paragraph>
                </GlassCard>

                {/* 章节内容 */}
                {reportContent.chapters.map(chapter =>
                  renderChapter(chapter, editingChapter === chapter.chapter_id)
                )}

                {/* 推荐建议 */}
                {selectedReport.recommendations && selectedReport.recommendations.length > 0 && (
                  <GlassCard className="mt-4 p-6" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: 16 }}>
                    <Title level={5} style={{ fontSize: 20, fontWeight: 700, color: '#0A0A0A', marginBottom: 12 }}>推荐建议</Title>
                    <List
                      size="small"
                      dataSource={selectedReport.recommendations}
                      renderItem={(item: unknown) => {
                        const rec = item as { type?: string; title?: string; content?: string };
                        return (
                          <List.Item>
                            <Tag color={rec.type === 'positive' ? 'green' : rec.type === 'warning' ? 'red' : 'orange'}>
                              {rec.title}
                            </Tag>
                            <Text>{rec.content}</Text>
                          </List.Item>
                        );
                      }}
                    />
                  </GlassCard>
                )}

                {/* 润色变更提示 */}
                {polishChanges.length > 0 && (
                  <Alert
                    className="mt-4"
                    type="success"
                    message="润色完成"
                    description={
                      <ul className="list-disc list-inside">
                        {polishChanges.slice(0, 5).map((change, i) => (
                          <li key={i}>{change}</li>
                        ))}
                      </ul>
                    }
                    closable
                    onClose={() => setPolishChanges([])}
                  />
                )}
              </div>
            ) : (
              <Empty description="报告内容为空" />
            )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* 版本管理抽屉 */}
      <Drawer
        title={<span style={{ fontWeight: 600 }}>版本历史</span>}
        placement="right"
        width={400}
        open={versionsVisible}
        onClose={() => setVersionsVisible(false)}
      >
        {versions.length > 0 ? (
          <List
            dataSource={versions}
            renderItem={(version) => (
              <List.Item
                style={{ borderBottom: '1px solid var(--gray-100)', padding: '12px 0' }}
                actions={[
                  <Button
                    key="view"
                    type="link"
                    size="small"
                    onClick={() => setSelectedVersion(version)}
                  >
                    查看
                  </Button>,
                  <Button
                    key="rollback"
                    type="link"
                    size="small"
                    icon={<RollbackOutlined />}
                    onClick={() => rollbackToVersion(version)}
                  >
                    回退
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <span className="bg-blue-50 text-indigo-600 rounded-md px-2 py-1 text-xs font-medium" style={{ background: '#EDF5F2', color: '#5E8A7C', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>
                      v{version.version}
                    </span>
                  }
                  description={
                    <div>
                      <Text type="secondary">
                        {new Date(version.created_at).toLocaleString('zh-CN')}
                      </Text>
                      {version.change_notes && (
                        <div className="text-xs text-gray-500 mt-1">
                          {version.change_notes}
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无版本历史" />
        )}
      </Drawer>

      {/* 完整性检查弹窗 */}
      <Modal
        title="完整性检查结果"
        open={completenessVisible}
        onCancel={() => setCompletenessVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setCompletenessVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        {completenessResult && (
          <div>
            <Alert
              type={completenessResult.complete ? 'success' : 'warning'}
              message={completenessResult.complete ? '报告完整' : '存在缺失项'}
              className="mb-4"
            />

            {!completenessResult.complete && completenessResult.missing_items.length > 0 && (
              <div className="mb-4">
                <Text strong>缺失项：</Text>
                <ul className="list-disc list-inside mt-2">
                  {completenessResult.missing_items.map((item, i) => (
                    <li key={i} className="text-red-500">{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {completenessResult.suggestions.length > 0 && (
              <div>
                <Text strong>建议：</Text>
                <ul className="list-disc list-inside mt-2">
                  {completenessResult.suggestions.map((suggestion, i) => (
                    <li key={i}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 版本预览弹窗 */}
      <Modal
        title={`版本 ${selectedVersion?.version} 预览`}
        open={!!selectedVersion}
        onCancel={() => setSelectedVersion(null)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setSelectedVersion(null)}>
            关闭
          </Button>,
          selectedVersion && (
            <Button
              key="rollback"
              type="primary"
              icon={<RollbackOutlined />}
              onClick={() => {
                rollbackToVersion(selectedVersion);
                setSelectedVersion(null);
              }}
            >
              回退到此版本
            </Button>
          ),
        ]}
      >
        {selectedVersion && (
          <pre className="max-h-96 overflow-auto bg-gray-50 p-4 rounded">
            {JSON.stringify(selectedVersion.content, null, 2)}
          </pre>
        )}
      </Modal>
    </div>
    </div>
  );
}
