import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Input,
  Empty,
  Button,
  Tag,
  Collapse,
  Modal,
  Form,
  message,
  Spin,
  Space,
  Select,
} from 'antd';
import client from '../api/client';
import {
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts';
import { jobsApi } from '../api/jobs';
import type { RoleResponse, JobProfileResponse, JobProfileHistoryResponse } from '../types/job';
import LoadingState from '../components/LoadingState';

const { Panel } = Collapse;

interface RoleWithProfile extends RoleResponse {
  profiles?: JobProfileResponse[];
  loading?: boolean;
}

// 画像维度类型
interface ProfileData {
  skills?: { name: string; weight: number }[];
  competencies?: string[];
  certificates?: string[];
  tools?: string[];
  keywords?: { word: string; weight: number }[];
}

const categoryColors: Record<string, string> = {
  技术: 'blue',
  产品: 'purple',
  设计: 'orange',
  运营: 'green',
  市场: 'red',
  销售: 'cyan',
  职能: 'gold',
  其他: 'default',
};

export default function JobProfiles() {
  const [searchParams] = useSearchParams();
  const [roles, setRoles] = useState<RoleWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState(searchParams.get('keyword') || '');
  const [selectedRole, setSelectedRole] = useState<RoleWithProfile | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState<JobProfileResponse | null>(null);
  const [editForm] = Form.useForm();
  const [batchGenerating, setBatchGenerating] = useState(false);
  const rightColRef = useRef<HTMLDivElement>(null);
  const [rightHeight, setRightHeight] = useState(0);

  // 隐藏 Modal body 滚动条 (webkit 浏览器)
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .ant-modal-body::-webkit-scrollbar {
        display: none !important;
      }
      .ant-modal-body {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // 监测右列高度
  useEffect(() => {
    if (!rightColRef.current || !selectedRole) return;

    const measure = () => {
      if (rightColRef.current) {
        setRightHeight(rightColRef.current.offsetHeight);
      }
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(rightColRef.current);

    return () => observer.disconnect();
  }, [selectedRole]);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await jobsApi.getRoles(true);
      setRoles(response.data);
    } catch (error) {
      message.error('获取角色列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchGenerate = async () => {
    setBatchGenerating(true);
    try {
      const response = await client.post<{ total: number; succeeded: number; failed: number }>('/job-profiles/generate-all');
      message.success(`批量生成完成，成功生成 ${response.data.succeeded} 个画像`);
      fetchRoles();
    } catch (error) {
      message.error('批量生成失败');
    } finally {
      setBatchGenerating(false);
    }
  };

  const fetchRoleProfile = async (role: RoleWithProfile) => {
    setSelectedRole({ ...role, loading: true });
    setDetailLoading(true);
    try {
      const response = await jobsApi.getRoleProfiles(role.id);
      const roleWithProfile = { ...role, profiles: response.data.profiles, loading: false };
      setSelectedRole(roleWithProfile);
      setRoles((prev) =>
        prev.map((r) => (r.id === role.id ? roleWithProfile : r))
      );
    } catch (error) {
      message.error('获取画像详情失败');
      setSelectedRole({ ...role, loading: false });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCardClick = (role: RoleWithProfile) => {
    if (selectedRole?.id === role.id) {
      setSelectedRole(null);
    } else {
      fetchRoleProfile(role);
    }
  };

  const handleEdit = (profile: JobProfileResponse) => {
    setEditingProfile(profile);
    const profileData = profile.profile_json as ProfileData;
    editForm.setFieldsValue({
      skills: profileData.skills?.map((s) => s.name).join(', '),
      competencies: profileData.competencies?.join(', '),
      certificates: profileData.certificates?.join(', '),
      tools: profileData.tools?.join(', '),
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingProfile) return;

    try {
      const values = await editForm.validateFields();
      const profileData = editingProfile.profile_json as ProfileData;

      const updatedProfileJson: ProfileData = {
        ...profileData,
        skills: values.skills
          ? values.skills.split(',').map((s: string) => s.trim()).filter(Boolean).map((name: string) => ({
              name,
              weight: profileData.skills?.find((s) => s.name === name)?.weight || 80,
            }))
          : profileData.skills,
        competencies: values.competencies
          ? values.competencies.split(',').map((s: string) => s.trim()).filter(Boolean)
          : profileData.competencies,
        certificates: values.certificates
          ? values.certificates.split(',').map((s: string) => s.trim()).filter(Boolean)
          : profileData.certificates,
        tools: values.tools
          ? values.tools.split(',').map((s: string) => s.trim()).filter(Boolean)
          : profileData.tools,
      };

      await jobsApi.updateJobProfile(editingProfile.id, {
        profile_json: updatedProfileJson as unknown as Record<string, unknown>,
      });

      message.success('画像更新成功');
      setEditModalVisible(false);
      if (selectedRole) {
        fetchRoleProfile(selectedRole);
      }
    } catch (error) {
      message.error('保存失败');
    }
  };

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(searchText.toLowerCase()) ||
    role.category.toLowerCase().includes(searchText.toLowerCase())
  );

  // 获取当前选中角色的最新画像
  const currentProfile = selectedRole?.profiles?.[0];
  const profileData = currentProfile?.profile_json as ProfileData | undefined;

  // ========== V2数据结构提取 ==========
  // 从profileData中提取V2格式数据
  const profileV2 = profileData as any;
  const techSkillsFull = profileV2?.technical_skills;
  const softSkills = profileV2?.soft_skills || [];
  const certifications = profileV2?.certificates || [];
  const jobResponsibilities = profileV2?.job_responsibilities || [];
  const benefits = profileV2?.benefits || [];
  const basicRequirements = profileV2?.basic_requirements;
  const totalJdsAnalyzed = profileV2?.total_jds_analyzed || 0;

  // 扁平化技术技能
  interface FlatSkill {
    name: string;
    weight: number;
    frequency: number;
    isRequired: boolean;
    category: string;
    categoryLabel: string;
  }

  const CATEGORY_LABELS: Record<string, string> = {
    programming_languages: '编程语言',
    frameworks_and_libraries: '框架与库',
    tools_and_platforms: '工具与平台',
    domain_skills: '领域技能',
    databases: '数据库',
    methodologies: '方法论',
  };

  const flattenTechnicalSkills = (): { allSkills: FlatSkill[]; nonEmptyCategories: Array<{ key: string; label: string; count: number }> } => {
    const allSkills: FlatSkill[] = [];
    const nonEmptyCategories: Array<{ key: string; label: string; count: number }> = [];

    for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
      const items = techSkillsFull?.[key] || [];
      if (items.length === 0) continue;

      nonEmptyCategories.push({ key, label, count: items.length });

      for (const item of items) {
        allSkills.push({
          name: item.name,
          weight: item.weight || 0,
          frequency: item.frequency || 0,
          isRequired: item.is_required || false,
          category: key,
          categoryLabel: label,
        });
      }
    }

    allSkills.sort((a, b) => b.weight - a.weight);
    return { allSkills, nonEmptyCategories };
  };

  const { allSkills, nonEmptyCategories } = flattenTechnicalSkills();

  // ========== 新布局组件 ==========

  // 紧凑指标条
  const InfoBar = () => {
    const eduItems = Object.entries(basicRequirements?.education || {})
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]: [string, any]) => `${k}${Math.round(v * 100)}%`);

    const expItems = Object.entries(basicRequirements?.experience || {})
      .filter((entry: [string, any]) => {
        const trimmed = entry[0].trim();
        if (/^20\d{2}/.test(trimmed)) return false;
        const numMatch = trimmed.match(/^(\d+)/);
        if (numMatch && parseInt(numMatch[1]) > 20) return false;
        return true;
      })
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]: [string, any]) => `${k}${Math.round(v * 100)}%`);

    const cityItems = (basicRequirements?.cities || [])
      .slice(0, 4)
      .map((c: any) => c.name);

    const segments = [
      { icon: '📄', text: `${totalJdsAnalyzed} 条JD` },
      { icon: '🎓', text: eduItems.join('  ') || '-' },
      { icon: '⏱️', text: expItems.join('  ') || '-' },
      { icon: '📍', text: cityItems.join(' · ') || '-' },
    ];

    return (
      <div style={{
        display: 'flex', alignItems: 'center',
        background: '#fff', borderRadius: 10, padding: '10px 16px',
        gap: 6, marginBottom: 14,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        flexWrap: 'wrap',
      }}>
        {segments.map((seg, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: '#E2E8F0', margin: '0 4px' }}>│</span>}
            <span style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>
              <span style={{ marginRight: 4 }}>{seg.icon}</span>
              {seg.text}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  // 技能矩阵 - 双列排列，可自适应高度
  const SkillMatrix = ({ matchHeight = 0 }: { matchHeight?: number }) => {
    const [manualExpanded, setManualExpanded] = useState(false);

    // 根据右列高度计算默认显示项数
    const HEADER_HEIGHT = 70;   // 标题 + 类别标签区域
    const ROW_HEIGHT = 28;      // 每行高度（含gap）
    const FOOTER_HEIGHT = 36;   // 展开按钮区域

    const autoShowCount = useMemo(() => {
      if (matchHeight <= 0) return 12; // 初始 fallback
      const availableHeight = matchHeight - HEADER_HEIGHT - FOOTER_HEIGHT;
      const rows = Math.max(3, Math.floor(availableHeight / ROW_HEIGHT)); // 最少3行
      return rows * 2; // 双列，每行2项
    }, [matchHeight]);

    // 如果自动计算的数量已经能显示全部技能，就不需要折叠
    const needFold = allSkills.length > autoShowCount;
    const displayCount = manualExpanded ? allSkills.length : Math.min(autoShowCount, allSkills.length);
    const displaySkills = allSkills.slice(0, displayCount);

    const COLORS: Record<string, string> = {
      programming_languages: '#6366F1',
      frameworks_and_libraries: '#8B5CF6',
      tools_and_platforms: '#0EA5E9',
      domain_skills: '#4361EE',
      databases: '#2EC4B6',
      methodologies: '#F59E0B',
    };

    if (allSkills.length === 0) {
      return (
        <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8' }}>
          暂无技术技能数据
        </div>
      );
    }

    return (
      <div style={{
        background: '#fff', borderRadius: 10, padding: '14px 16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10, paddingBottom: 8,
          borderBottom: '2px solid #EEF1FF',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>
            🔬 技术技能
          </span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>
            共 {allSkills.length} 项
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {nonEmptyCategories.map(cat => (
            <span key={cat.key} style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10,
              background: `${COLORS[cat.key]}10`,
              color: COLORS[cat.key],
              border: `1px solid ${COLORS[cat.key]}25`,
            }}>
              {cat.label} {cat.count}
            </span>
          ))}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '3px 16px',
        }}>
          {displaySkills.map((skill, i) => {
            const barColor = COLORS[skill.category] || '#4361EE';
            return (
              <div key={`${skill.name}-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 0',
              }}>
                <span style={{
                  width: 75, fontSize: 11, color: '#1E293B',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flexShrink: 0,
                }} title={skill.name}>
                  {skill.name}
                </span>
                <div style={{
                  flex: 1, height: 5, borderRadius: 3,
                  background: '#F1F5F9', overflow: 'hidden', minWidth: 40,
                }}>
                  <div style={{
                    width: `${Math.round(skill.weight * 100)}%`,
                    height: '100%', borderRadius: 3,
                    background: barColor,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <span style={{ fontSize: 10, color: '#94A3B8', width: 22, textAlign: 'right', flexShrink: 0 }}>
                  {skill.weight.toFixed(1)}
                </span>
                {skill.isRequired && skill.weight >= 0.6 ? (
                  <span style={{
                    fontSize: 9, padding: '0 4px', borderRadius: 3,
                    background: '#FEE2E2', color: '#DC2626', flexShrink: 0,
                    lineHeight: '16px',
                  }}>必备</span>
                ) : (
                  <span style={{ width: 22, flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>

        {needFold && (
          <div
            onClick={() => setManualExpanded(!manualExpanded)}
            style={{
              textAlign: 'center', padding: '8px 0', marginTop: 4,
              fontSize: 12, color: '#4361EE', cursor: 'pointer',
              borderTop: '1px dashed #E2E8F0',
            }}
          >
            {manualExpanded
              ? '收起 ▲'
              : `展开剩余 ${allSkills.length - displayCount} 项 ▼`
            }
          </div>
        )}
      </div>
    );
  };

  // 能力面板 - 软素养雷达图 + 证书 + 专业方向
  const AbilityPanel = () => {
    const useRadar = softSkills.length >= 3;
    const majors = basicRequirements?.majors || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 软素养 */}
        <div style={{
          background: '#fff', borderRadius: 10, padding: '12px 14px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#1E293B',
            marginBottom: 8, paddingBottom: 6,
            borderBottom: '2px solid #EEF1FF',
          }}>
            💡 软素养
          </div>
          {useRadar ? (
            <ResponsiveContainer width="100%" height={170}>
              <RadarChart data={softSkills.map((s: any) => ({
                subject: s.name, value: Math.round((s.weight || 0) * 100)
              }))}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748B' }} />
                <Radar dataKey="value" stroke="#4361EE" fill="#4361EE" fillOpacity={0.12} strokeWidth={2} dot={{ r: 2, fill: '#4361EE' }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {softSkills.map((s: any) => (
                <span key={s.name} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#EEF1FF', color: '#4361EE' }}>
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 证书 */}
        {certifications.length > 0 && (
          <div style={{
            background: '#fff', borderRadius: 10, padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: '#1E293B',
              marginBottom: 8, paddingBottom: 6,
              borderBottom: '2px solid #EEF1FF',
            }}>
              📜 证书资质
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {certifications.map((c: any) => (
                <span key={c.name} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 12,
                  background: c.importance === 'required' ? '#4361EE' : '#E8FAF8',
                  color: c.importance === 'required' ? '#fff' : '#0D9488',
                  fontWeight: c.importance === 'required' ? 600 : 400,
                }}>
                  {c.name}
                  <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.7 }}>
                    {c.importance === 'required' ? '必备' : '加分'}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 专业方向 */}
        {majors.length > 0 && (
          <div style={{
            background: '#fff', borderRadius: 10, padding: '12px 14px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 8, paddingBottom: 6, borderBottom: '2px solid #EEF1FF' }}>
              🎓 专业方向
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {majors.map((m: string) => (
                <span key={m} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#F1F5F9', color: '#475569' }}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 紧凑工作职责
  const CompactResponsibilities = () => {
    const [expanded, setExpanded] = React.useState(false);
    const SHOW = 3;
    const display = expanded ? jobResponsibilities : jobResponsibilities.slice(0, SHOW);

    return (
      <div style={{
        background: '#fff', borderRadius: 10, padding: '12px 14px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 8, paddingBottom: 6, borderBottom: '2px solid #EEF1FF' }}>
          📋 工作职责
        </div>
        {display.map((item: string, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
            <span style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 1,
              background: 'linear-gradient(135deg, #4361EE, #2EC4B6)',
              color: '#fff', fontSize: 9, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{i + 1}</span>
            <span style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.5 }}>{item}</span>
          </div>
        ))}
        {jobResponsibilities.length > SHOW && (
          <div onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 11, color: '#4361EE', cursor: 'pointer', textAlign: 'center', paddingTop: 4 }}>
            {expanded ? '收起 ▲' : `展开更多 (${jobResponsibilities.length - SHOW}条) ▼`}
          </div>
        )}
      </div>
    );
  };

  // 紧凑福利
  const CompactBenefits = () => {
    const sortedBenefits = [...benefits].sort((a, b) => b.frequency - a.frequency);

    return (
      <div style={{
        background: '#fff', borderRadius: 10, padding: '12px 14px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 8, paddingBottom: 6, borderBottom: '2px solid #EEF1FF' }}>
          🎁 福利待遇
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {sortedBenefits.map((item, i) => {
            const isTop = i < 3;
            return (
              <span key={item.name} style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 14,
                background: isTop ? '#E8FAF8' : '#F1F5F9',
                color: isTop ? '#0D9488' : '#64748B',
                fontWeight: isTop ? 500 : 400,
                border: isTop ? '1px solid #B2DFDB' : 'none',
              }}>
                {item.name}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  // 渲染画像维度详情 - 1屏布局
  const renderProfileDetails = () => {
    if (!profileData) {
      return <Empty description="暂无画像数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <div style={{ fontFamily: "-apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" }}>
        {/* ① 紧凑指标条 */}
        <InfoBar />

        {/* ② 主体：左右分栏 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: 14,
          marginBottom: 14,
          alignItems: 'start',
        }}>
          {/* 左列：技能矩阵 — 传入右列高度 */}
          <SkillMatrix matchHeight={rightHeight} />

          {/* 右列：能力画像 — 绑定 ref 测量高度 */}
          <div ref={rightColRef} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AbilityPanel />
          </div>
        </div>

        {/* ③ 底栏：工作职责 + 福利 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: 14,
          marginBottom: 14,
        }}>
          <CompactResponsibilities />
          <CompactBenefits />
        </div>

        {/* ④ 折叠区 */}
        <Collapse ghost defaultActiveKey={[]} style={{ background: '#fff', borderRadius: 10 }}>
          <Collapse.Panel header={<span style={{ fontSize: 12, color: '#94A3B8' }}>原始统计数据</span>} key="raw">
            <pre style={{
              fontSize: 11, lineHeight: 1.4, background: '#F8FAFC',
              borderRadius: 6, padding: 12, maxHeight: 200, overflow: 'auto',
              color: '#475569', border: '1px solid #E2E8F0',
            }}>
              {JSON.stringify(currentProfile?.evidence_json, null, 2)}
            </pre>
          </Collapse.Panel>
        </Collapse>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">岗位画像库</h1>
        <Space>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={handleBatchGenerate}
            loading={batchGenerating}
          >
            批量生成画像
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchRoles}>
            刷新
          </Button>
        </Space>
      </div>

      <div className="flex gap-4 mb-6">
        <Input
          placeholder="搜索角色名称或类别"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredRoles.length === 0 ? (
            <Col span={24}>
              <Empty description="暂无角色数据" />
            </Col>
          ) : (
            filteredRoles.map((role) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={role.id}>
                <Card
                  hoverable
                  className={`h-full transition-all ${
                    selectedRole?.id === role.id
                      ? 'border-2 border-blue-500 shadow-lg'
                      : ''
                  }`}
                  onClick={() => handleCardClick(role)}
                  title={
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{role.name}</span>
                      <Tag color={categoryColors[role.category] || 'default'}>
                        {role.category}
                      </Tag>
                    </div>
                  }
                  extra={
                    <div className="text-xs text-gray-400">
                      {role.job_count} 个 JD
                    </div>
                  }
                >
                  {role.description && (
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                      {role.description}
                    </p>
                  )}
                  {selectedRole?.id === role.id && detailLoading && (
                    <div className="flex justify-center py-4">
                      <Spin />
                    </div>
                  )}
                </Card>
              </Col>
            ))
          )}
        </Row>
      )}

      {/* 详情面板 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 48 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>
              {selectedRole?.name} · 岗位画像
            </span>
            {currentProfile && (
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 4,
                background: '#EEF1FF', color: '#4361EE',
              }}>v{currentProfile.version}</span>
            )}
            {currentProfile && (
              <Button
                size="small"
                icon={<EditOutlined />}
                style={{ marginLeft: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(currentProfile);
                }}
              >编辑</Button>
            )}
          </div>
        }
        open={!!selectedRole && !detailLoading}
        onCancel={() => setSelectedRole(null)}
        width={1200}
        footer={null}
        bodyStyle={{
          maxHeight: '82vh',
          overflow: 'auto',
          padding: '16px 20px',
          background: '#F7F9FC',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        className="profile-modal"
      >
        {detailLoading ? (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        ) : (
          renderProfileDetails()
        )}
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑画像"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="skills"
            label="关键技能 (逗号分隔)"
            rules={[{ message: '请输入技能' }]}
          >
            <Input.TextArea rows={2} placeholder="如: Python, React, MySQL" />
          </Form.Item>
          <Form.Item name="competencies" label="核心素养 (逗号分隔)">
            <Input.TextArea rows={2} placeholder="如: 沟通能力, 团队协作, 逻辑思维" />
          </Form.Item>
          <Form.Item name="certificates" label="证书资质 (逗号分隔)">
            <Input.TextArea rows={2} placeholder="如: PMP, AWS认证" />
          </Form.Item>
          <Form.Item name="tools" label="工具掌握 (逗号分隔)">
            <Input.TextArea rows={2} placeholder="如: Git, Docker, Linux" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
