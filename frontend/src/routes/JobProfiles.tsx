import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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

const { Panel } = Collapse;
import { ChevronDown, BookOpen } from 'lucide-react';
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

// 模块专属色 - 柔暗紫色系
const MODULE_COLOR = '#7C6DC8';
const MODULE_BG = '#F0EEFB';

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
  技术: '#7C6DC8',
  产品: '#C4758A',
  设计: '#CB8A4A',
  运营: '#5E8F6E',
  市场: '#E07B6A',
  销售: '#4B9AB3',
  职能: '#9CA3AF',
  其他: '#9CA3AF',
};

// ========== New Components ==========

// Profile Mini Card
const ProfileCard = ({ profile, onClick }: { profile: JobProfileResponse; onClick: () => void }) => {
  const createdAt = profile.created_at ? new Date(profile.created_at).toLocaleDateString('zh-CN') : '-';

  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(249,250,251,0.8)',
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(249,250,251,0.8)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Top: Version + Date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#6B7280' }}>v{profile.version}</span>
        <span style={{ fontSize: 12, color: '#6B7280' }}>{createdAt}</span>
      </div>

      {/* Bottom: Click to view details */}
      <div style={{ color: '#7C6DC8', fontSize: 13, fontWeight: 500 }}>
        查看详情 →
      </div>
    </div>
  );
};

// Role Glass Card with Expandable Profiles
const RoleCard = ({
  role,
  isExpanded,
  detailLoading,
  onToggle,
  onCardClick,
  profiles,
}: {
  role: RoleWithProfile;
  isExpanded: boolean;
  detailLoading: boolean;
  onToggle: () => void;
  onCardClick: () => void;
  profiles?: JobProfileResponse[];
}) => {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.7)',
      backdropFilter: 'blur(10px)',
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.5)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
      overflow: 'hidden',
    }}>
      {/* Card Header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1F2937' }}>
            {role.name}
          </span>
          <Tag style={{
            background: 'rgba(124,109,200,0.10)',
            color: '#5A4FA8',
            border: '1px solid rgba(124,109,200,0.20)',
            borderRadius: '6px',
          }}>
            {role.category}
          </Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            background: 'rgba(124,109,200,0.10)',
            color: '#5A4FA8',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 700,
            border: '1px solid rgba(124,109,200,0.20)',
          }}>
            {role.job_count} 个岗位
          </span>
          <ChevronDown
            size={20}
            style={{
              color: '#7C6DC8',
              transition: 'transform 0.2s',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </div>

      {/* Expandable Content: Profile Grid */}
      {isExpanded && (
        <div style={{
          padding: '0 20px 20px 20px',
          borderTop: '1px solid #F3F4F6',
        }}>
          {detailLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : profiles && profiles.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
              marginTop: 16,
            }}>
              {profiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  onClick={onCardClick}
                />
              ))}
            </div>
          ) : (
            <div style={{
              padding: 20,
              textAlign: 'center',
              color: '#9CA3AF',
              fontSize: 14,
            }}>
              暂无画像数据
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function JobProfiles() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
    // 跳转到详情页
    navigate(`/jobs/profiles/${role.id}`);
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
      programming_languages: '#7C6DC8',
      frameworks_and_libraries: '#9D91D8',
      tools_and_platforms: '#4B9AB3',
      domain_skills: '#5A4FA8',
      databases: '#4B9AB3',
      methodologies: '#CB8A4A',
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
          borderBottom: '2px solid #F0EEFB',
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
              background: `${COLORS[cat.key]}15`,
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
            const barColor = COLORS[skill.category] || '#7C6DC8';
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
                    background: '#7C6DC8', color: '#fff', flexShrink: 0,
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
              fontSize: 12, color: '#7C6DC8', cursor: 'pointer',
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
            borderBottom: '2px solid #F0EEFB',
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
                <Radar dataKey="value" stroke="#7C6DC8" fill="#7C6DC8" fillOpacity={0.12} strokeWidth={2} dot={{ r: 2, fill: '#7C6DC8' }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {softSkills.map((s: any) => (
                <span key={s.name} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(124,109,200,0.10)', color: '#5A4FA8' }}>
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
              borderBottom: '2px solid #F0EEFB',
            }}>
              📜 证书资质
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {certifications.map((c: any) => (
                <span key={c.name} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 12,
                  background: c.importance === 'required' ? '#7C6DC8' : '#EDF5F2',
                  color: c.importance === 'required' ? '#fff' : '#3A6B60',
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
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 8, paddingBottom: 6, borderBottom: '2px solid #F0EEFB' }}>
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
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 8, paddingBottom: 6, borderBottom: '2px solid #F0EEFB' }}>
          📋 工作职责
        </div>
        {display.map((item: string, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
            <span style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 1,
              background: 'linear-gradient(135deg, #7C6DC8, #9D91D8)',
              color: '#fff', fontSize: 9, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{i + 1}</span>
            <span style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.5 }}>{item}</span>
          </div>
        ))}
        {jobResponsibilities.length > SHOW && (
          <div onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 11, color: '#7C6DC8', cursor: 'pointer', textAlign: 'center', paddingTop: 4 }}>
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
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 8, paddingBottom: 6, borderBottom: '2px solid #EDF5F2' }}>
          🎁 福利待遇
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {sortedBenefits.map((item, i) => {
            const isTop = i < 3;
            return (
              <span key={item.name} style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 14,
                background: isTop ? '#EDF5F2' : '#F1F5F9',
                color: isTop ? '#3A6B60' : '#64748B',
                fontWeight: isTop ? 500 : 400,
                border: isTop ? '1px solid rgba(94,138,124,0.18)' : 'none',
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
      {/* Page Title Area */}
      <div className="mb-8">
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(124,109,200,0.10)',
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            color: MODULE_COLOR,
            marginBottom: 10,
          }}
        >
          <BookOpen size={12} /> 岗位画像库
        </div>
        <h1 style={{
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: '-0.8px',
          color: '#0A0A0A',
          marginBottom: 4,
        }}>
          岗位画像库
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280' }}>
          基于智联招聘 JD 数据生成的岗位画像
        </p>
      </div>

      {/* Search and Filter Area */}
      <div className="flex items-center gap-4 mb-6">
        {/* Custom Search Box */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: '#fff',
          borderRadius: 8,
          border: '1px solid #E5E7EB',
          width: 280,
        }}>
          <SearchOutlined style={{ color: '#9CA3AF', fontSize: 14 }} />
          <input
            type="text"
            placeholder="搜索角色名称..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 14,
              width: '100%',
              color: '#374151',
            }}
          />
        </div>

        {/* Role Filter Select */}
        <Select
          placeholder="筛选角色"
          style={{ width: 160 }}
          allowClear
          onChange={(value) => {
            if (value) {
              const role = roles.find(r => r.id === value);
              if (role) fetchRoleProfile(role);
            }
          }}
          options={roles.map(r => ({ label: r.name, value: r.id }))}
        />

        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleBatchGenerate}
          loading={batchGenerating}
          style={{ background: '#7C6DC8', borderColor: '#7C6DC8' }}
        >
          生成画像
        </Button>

        <Button icon={<ReloadOutlined />} onClick={fetchRoles}>
          刷新
        </Button>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredRoles.length === 0 ? (
            <Empty description="暂无角色数据" />
          ) : (
            filteredRoles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                isExpanded={selectedRole?.id === role.id}
                detailLoading={selectedRole?.id === role.id && detailLoading}
                onToggle={() => fetchRoleProfile(role)}
                onCardClick={() => handleCardClick(role)}
                profiles={selectedRole?.id === role.id ? selectedRole.profiles : []}
              />
            ))
          )}
        </div>
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
                background: 'rgba(124,109,200,0.10)', color: '#5A4FA8',
              }}>v{currentProfile.version}</span>
            )}
            {currentProfile && (
              <Button
                size="small"
                icon={<EditOutlined />}
                style={{ marginLeft: 'auto', color: '#7C6DC8', borderColor: '#7C6DC8' }}
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
        okButtonProps={{ style: { background: '#7C6DC8', borderColor: '#7C6DC8' } }}
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
