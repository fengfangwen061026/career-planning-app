import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Divider,
  Drawer,
  Empty,
  Modal,
  Progress,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  HighlightOutlined,
  HistoryOutlined,
  PlusOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { FileText } from 'lucide-react';

import { reportsApi } from '../api/reports';
import { studentsApi } from '../api/students';
import { GlassCard } from '../components/GlassCard';
import LoadingState from '../components/LoadingState';
import type { StudentResponse } from '../types/student';
import type {
  CareerReportResponse,
  ReportActionItem,
  ReportChapter,
  ReportContent,
  ReportDimension,
  ReportPathNode,
  ReportVersionResponse,
} from '../types/report';

const { Title, Paragraph, Text } = Typography;

const EMPTY_CONTENT = (): ReportContent => ({
  title: '智引鸿图职业发展报告',
  summary: '',
  target_job: {},
  dimensions: [],
  actions: [],
  paths: { primary_path: [], alt_paths: [] },
  chapters: [
    { chapter_id: 1, title: '一、个人优势总结', text: '', status: 'pending' },
    { chapter_id: 2, title: '二、目标岗位分析', text: '', status: 'pending' },
    { chapter_id: 3, title: '三、差距与行动计划', text: '', status: 'pending' },
    { chapter_id: 4, title: '四、职业路径规划', text: '', status: 'pending' },
    { chapter_id: 5, title: '五、评估周期', text: '', status: 'pending' },
  ],
});

interface ReportStreamEvent {
  type?: 'stage' | 'chapter' | 'complete' | 'error';
  progress?: number;
  message?: string;
  data?: {
    report?: CareerReportResponse;
  } | ReportChapter;
}

function normalizeContent(raw: unknown): ReportContent {
  if (!raw || typeof raw !== 'object') {
    return EMPTY_CONTENT();
  }
  const source = raw as Record<string, unknown>;
  const base = EMPTY_CONTENT();
  const chapters = Array.isArray(source.chapters) ? source.chapters : [];
  const normalizedChapters = base.chapters.map((fallbackChapter) => {
    const current = chapters.find(
      (chapter) =>
        typeof chapter === 'object' &&
        chapter !== null &&
        Number((chapter as Record<string, unknown>).chapter_id) === fallbackChapter.chapter_id
    ) as Record<string, unknown> | undefined;
    return {
      chapter_id: fallbackChapter.chapter_id,
      title: String(current?.title || fallbackChapter.title),
      text: String(current?.text || ''),
      data: current?.data,
      status: String(current?.status || (current?.text ? 'done' : fallbackChapter.status)),
    };
  });

  return {
    title: String(source.title || base.title),
    summary: String(source.summary || ''),
    target_job: (source.target_job as Record<string, unknown>) || {},
    dimensions: (Array.isArray(source.dimensions) ? source.dimensions : []) as ReportDimension[],
    actions: (Array.isArray(source.actions) ? source.actions : []) as ReportActionItem[],
    paths: (source.paths as ReportContent['paths']) || base.paths,
    chapters: normalizedChapters,
    metadata: (source.metadata as Record<string, unknown>) || {},
  };
}

function mergeChapter(content: ReportContent, incoming: ReportChapter): ReportContent {
  const next = {
    ...content,
    chapters: content.chapters.map((chapter) =>
      chapter.chapter_id === incoming.chapter_id
        ? { ...chapter, ...incoming, status: 'done' }
        : chapter
    ),
  };
  if (incoming.chapter_id === 2 && incoming.data && typeof incoming.data === 'object') {
    const data = incoming.data as { dimensions?: ReportDimension[] };
    next.dimensions = data.dimensions || [];
  }
  if (incoming.chapter_id === 3 && Array.isArray(incoming.data)) {
    next.actions = incoming.data as ReportActionItem[];
  }
  if (incoming.chapter_id === 4 && incoming.data && typeof incoming.data === 'object') {
    next.paths = incoming.data as ReportContent['paths'];
  }
  return next;
}

function renderDimensionCards(dimensions: ReportDimension[]) {
  if (!dimensions.length) {
    return null;
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
      {dimensions.map((dimension) => (
        <div
          key={dimension.key}
          style={{
            padding: 14,
            borderRadius: 14,
            background: '#F8FAFC',
            border: '1px solid #E5E7EB',
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 800, color: '#2563EB', lineHeight: 1 }}>
            {dimension.score}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>{dimension.label}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6, lineHeight: 1.6 }}>
            {dimension.reason}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderActionItems(actions: ReportActionItem[]) {
  if (!actions.length) {
    return null;
  }
  return (
    <div className="grid gap-3 mt-4">
      {actions.map((action, index) => (
        <div
          key={`${action.item}-${index}`}
          style={{
            padding: 16,
            borderRadius: 14,
            background: '#F8FAFC',
            border: '1px solid #E5E7EB',
            display: 'grid',
            gap: 6,
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <strong>{action.item}</strong>
            <Tag color={action.priority === '必须补齐' ? 'red' : action.priority === '建议提升' ? 'orange' : 'blue'}>
              {action.priority}
            </Tag>
          </div>
          <Text type="secondary">{action.gap_desc}</Text>
          <Paragraph style={{ marginBottom: 0 }}>{action.action}</Paragraph>
          <Text type="secondary">周期：{action.timeline} / 影响：{action.score_impact}</Text>
        </div>
      ))}
    </div>
  );
}

function renderPathNodes(nodes: ReportPathNode[]) {
  if (!nodes.length) {
    return null;
  }
  return (
    <div className="grid gap-3 mt-4">
      {nodes.map((node, index) => (
        <div
          key={`${node.title}-${index}`}
          style={{
            padding: 16,
            borderRadius: 14,
            border: `1px solid ${node.is_current ? '#C7D2FE' : '#E5E7EB'}`,
            background: node.is_current ? '#EEF2FF' : '#F8FAFC',
          }}
        >
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{node.stage}</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{node.title}</div>
          <div style={{ color: '#4B5563', lineHeight: 1.7 }}>{node.condition}</div>
        </div>
      ))}
    </div>
  );
}

export default function Report() {
  const [students, setStudents] = useState<StudentResponse[]>([]);
  const [reports, setReports] = useState<CareerReportResponse[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>();
  const [selectedReport, setSelectedReport] = useState<CareerReportResponse | null>(null);
  const [reportContent, setReportContent] = useState<ReportContent | null>(null);
  const [streamPreview, setStreamPreview] = useState<ReportContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ message: string; percent: number } | null>(null);
  const [versions, setVersions] = useState<ReportVersionResponse[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<ReportVersionResponse | null>(null);
  const [completeness, setCompleteness] = useState<{
    complete: boolean;
    missing_items: string[];
    suggestions: string[];
  } | null>(null);
  const [completenessOpen, setCompletenessOpen] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void fetchStudents();
    return () => streamAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      void fetchReports(selectedStudent);
    } else {
      setReports([]);
      setSelectedReport(null);
      setReportContent(null);
    }
  }, [selectedStudent]);

  const activeContent = useMemo(() => streamPreview || reportContent, [streamPreview, reportContent]);

  async function fetchStudents() {
    const response = await studentsApi.getStudents();
    setStudents(response.data);
  }

  async function fetchReports(studentId: string) {
    setLoading(true);
    try {
      const response = await reportsApi.getReports({ student_id: studentId });
      setReports(response.data);
    } catch {
      message.error('获取报告列表失败');
    } finally {
      setLoading(false);
    }
  }

  async function fetchReportContent(reportId: string) {
    try {
      const response = await reportsApi.getReport(reportId);
      setSelectedReport(response.data);
      setReportContent(normalizeContent(response.data.content_json));
      await fetchVersions(reportId);
    } catch {
      message.error('获取报告内容失败');
    }
  }

  async function fetchVersions(reportId: string) {
    try {
      const response = await reportsApi.getReportVersions(reportId);
      setVersions(response.data);
    } catch {
      setVersions([]);
    }
  }

  async function handleGenerateReport() {
    if (!selectedStudent) {
      message.warning('请先选择学生');
      return;
    }

    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    setGenerating(true);
    setProgress({ message: '正在准备报告上下文', percent: 0 });
    setStreamPreview(EMPTY_CONTENT());

    try {
      const response = await fetch(reportsApi.buildGenerateReportStreamUrl(selectedStudent), {
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          if (!block.startsWith('data: ')) {
            continue;
          }
          const event = JSON.parse(block.slice(6)) as ReportStreamEvent;

          if (event.type === 'stage') {
            setProgress({ message: event.message || '正在生成报告', percent: event.progress || 0 });
            continue;
          }

          if (event.type === 'chapter' && event.data && typeof event.data === 'object') {
            const chapter = event.data as ReportChapter;
            setProgress({ message: event.message || '已生成章节', percent: event.progress || 0 });
            setStreamPreview((prev) => mergeChapter(prev || EMPTY_CONTENT(), chapter));
            continue;
          }

          if (event.type === 'complete') {
            const finalReport = (event.data as { report?: CareerReportResponse } | undefined)?.report;
            if (!finalReport) {
              throw new Error('报告生成完成，但未收到报告数据');
            }
            await fetchReports(selectedStudent);
            await fetchReportContent(finalReport.id);
            setStreamPreview(null);
            setProgress({ message: event.message || '报告生成完成', percent: 100 });
            message.success('报告生成完成');
            setTimeout(() => setProgress(null), 1200);
            continue;
          }

          if (event.type === 'error') {
            throw new Error(event.message || '报告生成失败');
          }
        }
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        message.error(error instanceof Error ? error.message : '报告生成失败');
      }
      setStreamPreview(null);
      setProgress(null);
    } finally {
      setGenerating(false);
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
      }
    }
  }

  async function handleExport(format: 'pdf' | 'docx') {
    if (!selectedReport) {
      return;
    }
    try {
      const response = await reportsApi.exportReport({ report_id: selectedReport.id, format });
      const contentType = response.headers['content-type'];
      const blob = new Blob([response.data], {
        type: typeof contentType === 'string' ? contentType : 'application/octet-stream',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedReport.title || '智引鸿图职业发展报告'}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success(format === 'pdf' ? 'PDF 导出成功' : 'Word 导出成功');
    } catch (error) {
      const detail =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : '导出失败';
      message.error(detail || '导出失败');
    }
  }

  async function handlePolish() {
    if (!selectedReport) {
      return;
    }
    setPolishing(true);
    try {
      const response = await reportsApi.polishReport(selectedReport.id);
      message.success(response.data.changes?.length ? 'AI 增强润色完成' : '当前报告无需额外润色');
      await fetchReportContent(selectedReport.id);
    } catch (error) {
      const detail =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : 'AI 润色失败';
      message.error(detail || 'AI 润色失败');
    } finally {
      setPolishing(false);
    }
  }

  async function handleCheck() {
    if (!selectedReport) {
      return;
    }
    try {
      const response = await reportsApi.checkReportCompleteness(selectedReport.id);
      setCompleteness(response.data);
      setCompletenessOpen(true);
    } catch {
      message.error('完整性检查失败');
    }
  }

  function handleRollback(version: ReportVersionResponse) {
    if (!selectedReport) {
      return;
    }
    Modal.confirm({
      title: '确认回退到该版本？',
      content: `当前报告内容将被版本 ${version.version} 覆盖。`,
      onOk: async () => {
        await reportsApi.updateReport(selectedReport.id, {
          content_json: version.content,
        });
        message.success('已回退到指定版本');
        await fetchReportContent(selectedReport.id);
        setVersionsOpen(false);
      },
    });
  }

  return (
    <div data-module="reports" className="p-6">
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 12px',
            borderRadius: 999,
            background: 'rgba(94,138,124,0.10)',
            color: '#5E8A7C',
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          <FileText size={12} />
          报告导出
        </div>
        <Title level={2} style={{ margin: 0 }}>
          智引鸿图报告中心
        </Title>
        <Text type="secondary">生成、查看并导出与移动端 demo 结构一致的智引鸿图职业发展报告。</Text>
      </div>

      <GlassCard style={{ padding: 20, marginBottom: 16 }}>
        <Space wrap size={12}>
          <Select
            placeholder="选择学生"
            style={{ width: 240 }}
            value={selectedStudent}
            allowClear
            onChange={(value) => {
              setSelectedStudent(value);
              setSelectedReport(null);
              setReportContent(null);
              setStreamPreview(null);
            }}
            options={students.map((student) => ({
              value: student.id,
              label: student.name || student.email,
            }))}
          />
          <Select
            placeholder="选择已有报告"
            style={{ width: 320 }}
            value={selectedReport?.id}
            allowClear
            disabled={!selectedStudent}
            onChange={(value) => {
              const report = reports.find((item) => item.id === value) || null;
              setSelectedReport(report);
              if (report) {
                void fetchReportContent(report.id);
              } else {
                setReportContent(null);
              }
            }}
            options={reports.map((report) => ({
              value: report.id,
              label: `${report.title || '未命名报告'} · v${report.version || '1.0'}`,
            }))}
          />
          <Button type="primary" icon={<PlusOutlined />} loading={generating} onClick={handleGenerateReport}>
            {generating ? '生成中...' : '生成报告'}
          </Button>
          {selectedReport && (
            <>
              <Divider type="vertical" />
              <Button icon={<HighlightOutlined />} loading={polishing} onClick={handlePolish}>
                AI 增强润色
              </Button>
              <Button icon={<CheckOutlined />} onClick={handleCheck}>
                完整性检查
              </Button>
              <Button icon={<FilePdfOutlined />} onClick={() => handleExport('pdf')}>
                导出 PDF
              </Button>
              <Button icon={<FileWordOutlined />} onClick={() => handleExport('docx')}>
                导出 Word
              </Button>
              <Button icon={<HistoryOutlined />} onClick={() => setVersionsOpen(true)}>
                版本历史
              </Button>
            </>
          )}
        </Space>
      </GlassCard>

      {progress && (
        <GlassCard style={{ padding: 20, marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>{progress.message}</Text>
            <Progress percent={progress.percent} status={progress.percent >= 100 ? 'success' : 'active'} />
          </Space>
        </GlassCard>
      )}

      {loading ? (
        <LoadingState />
      ) : !activeContent && !selectedReport ? (
        <GlassCard style={{ padding: 48, textAlign: 'center' }}>
          <Empty description="请选择学生并生成或查看报告" />
        </GlassCard>
      ) : (
        <div className="grid gap-4">
          <GlassCard style={{ padding: 24 }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <Title level={3} style={{ marginBottom: 8 }}>
                  {activeContent?.title || selectedReport?.title || '智引鸿图职业发展报告'}
                </Title>
                <Paragraph style={{ marginBottom: 0 }}>
                  {activeContent?.summary || selectedReport?.summary || '暂无摘要'}
                </Paragraph>
              </div>
              {selectedReport && <Tag color="blue">v{selectedReport.version || '1.0'}</Tag>}
            </div>
          </GlassCard>

          {activeContent?.chapters.map((chapter) => (
            <GlassCard key={chapter.chapter_id} style={{ padding: 24 }}>
              <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                <Title level={4} style={{ marginBottom: 0 }}>
                  {chapter.title}
                </Title>
                <Tag color={chapter.status === 'done' ? 'green' : generating ? 'blue' : 'default'}>
                  {chapter.status === 'done' ? '已生成' : generating ? '生成中' : '待补充'}
                </Tag>
              </div>
              {chapter.text ? (
                <Paragraph style={{ marginBottom: 0, lineHeight: 1.9 }}>{chapter.text}</Paragraph>
              ) : (
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  该章节尚未生成内容。
                </Paragraph>
              )}
              {chapter.chapter_id === 2 && renderDimensionCards(activeContent.dimensions)}
              {chapter.chapter_id === 3 && renderActionItems(activeContent.actions)}
              {chapter.chapter_id === 4 && renderPathNodes(activeContent.paths.primary_path)}
            </GlassCard>
          ))}

          {selectedReport?.recommendations?.length ? (
            <GlassCard style={{ padding: 24 }}>
              <Title level={4}>推荐建议</Title>
              <div className="grid gap-3">
                {selectedReport.recommendations.map((item, index) => {
                  const recommendation = item as { title?: string; content?: string; type?: string };
                  return (
                    <div
                      key={`${recommendation.title}-${index}`}
                      style={{
                        padding: 16,
                        borderRadius: 14,
                        background: '#F8FAFC',
                        border: '1px solid #E5E7EB',
                      }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <Tag color={recommendation.type === 'positive' ? 'green' : recommendation.type === 'warning' ? 'red' : 'blue'}>
                          {recommendation.title}
                        </Tag>
                      </div>
                      <Paragraph style={{ marginBottom: 0 }}>{recommendation.content}</Paragraph>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          ) : null}
        </div>
      )}

      <Drawer title="版本历史" open={versionsOpen} onClose={() => setVersionsOpen(false)} width={420}>
        {versions.length ? (
          <div className="grid gap-3">
            {versions.map((version) => (
              <GlassCard key={version.id} style={{ padding: 16 }}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <Tag color="blue">v{version.version}</Tag>
                  <Text type="secondary">{new Date(version.created_at).toLocaleString('zh-CN')}</Text>
                </div>
                {version.change_notes ? <Paragraph style={{ marginBottom: 12 }}>{version.change_notes}</Paragraph> : null}
                <Space>
                  <Button size="small" onClick={() => setPreviewVersion(version)}>
                    查看
                  </Button>
                  <Button size="small" icon={<RollbackOutlined />} onClick={() => handleRollback(version)}>
                    回退
                  </Button>
                </Space>
              </GlassCard>
            ))}
          </div>
        ) : (
          <Empty description="暂无版本历史" />
        )}
      </Drawer>

      <Modal
        title="完整性检查结果"
        open={completenessOpen}
        onCancel={() => setCompletenessOpen(false)}
        footer={<Button onClick={() => setCompletenessOpen(false)}>关闭</Button>}
      >
        {completeness ? (
          <div className="grid gap-4">
            <Alert type={completeness.complete ? 'success' : 'warning'} message={completeness.complete ? '当前报告内容完整' : '当前报告仍有缺项'} />
            {completeness.missing_items.length ? (
              <div>
                <Text strong>缺失项</Text>
                <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                  {completeness.missing_items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {completeness.suggestions.length ? (
              <div>
                <Text strong>建议</Text>
                <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                  {completeness.suggestions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        title={previewVersion ? `版本 ${previewVersion.version}` : '版本预览'}
        open={!!previewVersion}
        width={860}
        onCancel={() => setPreviewVersion(null)}
        footer={<Button onClick={() => setPreviewVersion(null)}>关闭</Button>}
      >
        <pre style={{ maxHeight: 480, overflow: 'auto', background: '#F8FAFC', padding: 16, borderRadius: 12 }}>
          {previewVersion ? JSON.stringify(previewVersion.content, null, 2) : ''}
        </pre>
      </Modal>
    </div>
  );
}
