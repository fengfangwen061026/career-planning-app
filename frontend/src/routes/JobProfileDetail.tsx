import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Tabs, Table, Tag, Button, Spin, Empty,
  Space, message, Drawer, Modal, Tooltip
} from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell
} from 'recharts';
import {
  ArrowLeftOutlined, BankOutlined, DollarOutlined,
  EnvironmentOutlined, GiftOutlined, CloseOutlined, ClearOutlined
} from '@ant-design/icons';
import {
  MessageCircle, Users, BookOpen, Shield, Lightbulb,
  CheckCircle, Eye, Zap, Sparkles, LayoutGrid
} from 'lucide-react';
import { jobsApi } from '../api/jobs';
import type {
  RoleResponse, JobProfileResponse,
  JobWithCompany, FilterState
} from '../types/job';
import LoadingState from '../components/LoadingState';

// ========== Apple/Silicon Valley 风格样式系统 ==========

const FONTS = {
  primary: "-apple-system, 'PingFang SC', 'SF Pro Display', 'Helvetica Neue', sans-serif",
  mono: "'SF Mono', 'Fira Code', 'Consolas', monospace",
};

// 进度条颜色映射（按权重区分深浅）
const getBarStyle = (pct: number) => {
  if (pct >= 80) return { fill: 'var(--primary-dark)', label: { fontWeight: 600, color: 'var(--gray-900)' } };
  if (pct >= 60) return { fill: 'var(--blue-mid)', label: { fontWeight: 500, color: 'var(--gray-700)' } };
  if (pct >= 40) return { fill: 'var(--blue-light)', label: { fontWeight: 500, color: 'var(--gray-500)' } };
  return { fill: 'var(--blue-light)', label: { fontWeight: 400, color: 'var(--gray-400)', opacity: 0.6 } };
};

// 软素养图标映射
const softSkillIcons: Record<string, React.ReactNode> = {
  '沟通能力': <MessageCircle size={13} />,
  '沟通': <MessageCircle size={13} />,
  '团队协作': <Users size={13} />,
  '团队': <Users size={13} />,
  '协作': <Users size={13} />,
  '学习能力': <BookOpen size={13} />,
  '学习': <BookOpen size={13} />,
  '抗压能力': <Shield size={13} />,
  '抗压': <Shield size={13} />,
  '逻辑思维': <Lightbulb size={13} />,
  '逻辑': <Lightbulb size={13} />,
  '思维': <Lightbulb size={13} />,
  '组织能力': <LayoutGrid size={13} />,
  '组织': <LayoutGrid size={13} />,
  '责任心': <CheckCircle size={13} />,
  '责任': <CheckCircle size={13} />,
  '细心认真': <Eye size={13} />,
  '细心': <Eye size={13} />,
  '认真': <Eye size={13} />,
  '问题解决': <Zap size={13} />,
  '解决问题': <Zap size={13} />,
};

const getSoftSkillIcon = (name: string) => {
  const key = Object.keys(softSkillIcons).find(k => name.includes(k));
  return key ? softSkillIcons[key] : <Sparkles size={13} />;
};

// 薪资区间定义
const SALARY_RANGES = [
  { label: '3K以下', min: 0, max: 3000 },
  { label: '3-5K', min: 3000, max: 5000 },
  { label: '5-8K', min: 5000, max: 8000 },
  { label: '8-12K', min: 8000, max: 12000 },
  { label: '12-20K', min: 12000, max: 20000 },
  { label: '20K以上', min: 20000, max: Infinity },
];

const COLORS = ['#4361EE', '#2EC4B6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// 解析行业字段
const parseIndustry = (industry: string | string[] | null | undefined): { first: string; all: string } => {
  if (!industry) return { first: '—', all: '' };
  let items: string[] = [];
  if (Array.isArray(industry)) {
    items = industry;
  } else if (typeof industry === 'string') {
    if (industry.startsWith('{') && industry.endsWith('}')) {
      items = industry.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    } else {
      items = [industry];
    }
  }
  if (items.length === 0) return { first: '—', all: '' };
  return { first: items[0], all: items.join('、') };
};

// 格式化薪资
const formatSalary = (min?: number, max?: number) => {
  if (!min && !max) return '-';
  const minK = min ? `${Math.round(min / 1000)}K` : '';
  const maxK = max ? `${Math.round(max / 1000)}K` : '';
  return minK && maxK ? `${minK}-${maxK}` : max ? `最高${maxK}` : `最低${minK}`;
};

// 卡片样式
const cardStyle = {
  background: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.9)',
  borderRadius: 16,
  padding: 24,
  boxShadow: 'var(--card-shadow)',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
} as const;

// 卡片标题样式生成器
const createCardTitleStyle = (accentColor: string) => ({
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--gray-400)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  marginBottom: 20,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  '&::before': {
    content: '""',
    width: 4,
    height: 14,
    borderRadius: 2,
    background: accentColor,
  },
});

export default function JobProfileDetail() {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<RoleResponse | null>(null);
  const [profile, setProfile] = useState<JobProfileResponse | null>(null);
  const [allJobs, setAllJobs] = useState<JobWithCompany[]>([]);

  // 筛选状态
  const [filters, setFilters] = useState<FilterState>({
    salaryRange: null,
    city: null,
    benefits: [],
  });

  // Drawer 和 Modal 状态
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<{ name: string; jobs: JobWithCompany[] } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithCompany | null>(null);

  // 动画状态
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (roleId) {
      fetchRoleData();
    }
  }, [roleId]);

  // Tab 切换时触发动画
  const handleTabChange = (key: string) => {
    if (key === 'profile') {
      setAnimated(false);
      setTimeout(() => setAnimated(true), 100);
    }
  };

  const fetchRoleData = async () => {
    if (!roleId) return;
    setLoading(true);
    try {
      const [rolesRes, profileRes, jobsRes] = await Promise.all([
        jobsApi.getRoles(true),
        jobsApi.getRoleProfiles(roleId),
        jobsApi.getJobsByRole(roleId),
      ]);

      const foundRole = rolesRes.data.find((r) => r.id === roleId);
      if (foundRole) {
        setRole(foundRole);
        setAllJobs(jobsRes.data);
        const profiles = profileRes.data.profiles;
        if (profiles && profiles.length > 0) {
          setProfile(profiles[0]);
          // 数据加载后触发动画
          setTimeout(() => setAnimated(true), 300);
        }
      }
    } catch (error) {
      message.error('获取岗位数据失败');
    } finally {
      setLoading(false);
    }
  };

  // ========== 筛选逻辑 ==========
  const filteredJobs = useMemo(() => {
    return allJobs.filter(job => {
      if (filters.salaryRange) {
        const range = SALARY_RANGES.find(r => r.label === filters.salaryRange);
        if (range) {
          const salaryMin = job.salary_min || 0;
          if (salaryMin < range.min || salaryMin >= range.max) return false;
        }
      }
      if (filters.city && job.city !== filters.city) return false;
      if (filters.benefits.length > 0) {
        const jobBenefits = job.benefits || [];
        if (!filters.benefits.every(b => jobBenefits.includes(b))) return false;
      }
      return true;
    });
  }, [allJobs, filters]);

  const salaryDist = useMemo(() => {
    const counts: Record<string, number> = {};
    SALARY_RANGES.forEach(r => { counts[r.label] = 0; });
    filteredJobs.forEach(job => {
      const salary = job.salary_min || 0;
      for (const range of SALARY_RANGES) {
        if (salary >= range.min && salary < range.max) {
          counts[range.label]++;
          break;
        }
      }
    });
    return SALARY_RANGES.map(r => ({ range: r.label, count: counts[r.label] }));
  }, [filteredJobs]);

  const cityDist = useMemo(() => {
    const counts: Record<string, { count: number; salaries: number[] }> = {};
    filteredJobs.forEach(job => {
      if (!counts[job.city]) counts[job.city] = { count: 0, salaries: [] };
      counts[job.city].count++;
      if (job.salary_min) counts[job.city].salaries.push(job.salary_min);
    });
    return Object.entries(counts)
      .map(([city, data]) => ({
        city,
        count: data.count,
        avg_salary_min: data.salaries.length ? Math.min(...data.salaries) : undefined,
        avg_salary_max: data.salaries.length ? Math.max(...data.salaries) : undefined,
        top_companies: [],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [filteredJobs]);

  const benefitStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredJobs.forEach(job => {
      (job.benefits || []).forEach(b => {
        counts[b] = (counts[b] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, frequency]) => ({ name, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 15);
  }, [filteredJobs]);

  // 画像分析 Tab 专用：基于全量 JD 的福利统计
  const allJobsBenefitStats = useMemo(() => {
    const counts: Record<string, number> = {};
    allJobs.forEach(job => {
      (job.benefits || []).forEach(b => {
        counts[b] = (counts[b] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, frequency]) => ({ name, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 15);
  }, [allJobs]);

  const companyList = useMemo(() => {
    const companyMap = new Map<string, { name: string; jobCount: number; industries: string; company_size: string; cities: string[]; salaryRange: string; benefits: string[] }>();
    filteredJobs.forEach(job => {
      const companyName = job.company?.name || job.company_name || '未知公司';
      if (!companyMap.has(companyName)) {
        companyMap.set(companyName, {
          name: companyName,
          jobCount: 0,
          industries: job.company?.industries || '',
          company_size: job.company?.company_size || '',
          cities: [],
          salaryRange: '',
          benefits: [],
        });
      }
      const c = companyMap.get(companyName)!;
      c.jobCount++;
      if (job.city && !c.cities.includes(job.city)) c.cities.push(job.city);
      if (job.salary_min && job.salary_max) {
        const range = `${Math.round(job.salary_min / 1000)}K-${Math.round(job.salary_max / 1000)}K`;
        if (!c.salaryRange) c.salaryRange = range;
      }
      if (job.benefits && job.benefits.length > 0) {
        job.benefits.forEach(b => {
          if (!c.benefits.includes(b)) c.benefits.push(b);
        });
      }
    });
    return Array.from(companyMap.values()).sort((a, b) => b.jobCount - a.jobCount);
  }, [filteredJobs]);

  // 福利标签组件
  const BenefitTags = ({ benefits }: { benefits: string[] }) => {
    if (!benefits || benefits.length === 0) {
      return <span style={{ color: 'var(--gray-400)' }}>—</span>;
    }
    return (
      <Space size={4} wrap>
        {benefits.map(b => (
          <Tag key={b} color="green" style={{ margin: 0, padding: '0 6px', fontSize: 12, lineHeight: '20px' }}>
            {b}
          </Tag>
        ))}
      </Space>
    );
  };

  // ========== 筛选交互 ==========
  const handleSalaryClick = (range: string) => {
    setFilters(prev => ({ ...prev, salaryRange: prev.salaryRange === range ? null : range }));
  };
  const handleCityClick = (city: string) => {
    setFilters(prev => ({ ...prev, city: prev.city === city ? null : city }));
  };
  const handleBenefitClick = (benefit: string) => {
    setFilters(prev => ({
      ...prev,
      benefits: prev.benefits.includes(benefit)
        ? prev.benefits.filter(b => b !== benefit)
        : [...prev.benefits, benefit],
    }));
  };
  const clearAllFilters = () => {
    setFilters({ salaryRange: null, city: null, benefits: [] });
  };
  const removeFilter = (type: keyof FilterState, value?: string) => {
    setFilters(prev => {
      if (type === 'benefits' && value) return { ...prev, benefits: prev.benefits.filter(b => b !== value) };
      return { ...prev, [type]: null };
    });
  };

  // ========== 公司钻取 ==========
  const handleCompanyClick = (companyName: string) => {
    const jobs = filteredJobs.filter(j => (j.company?.name || j.company_name) === companyName);
    setSelectedCompany({ name: companyName, jobs });
    setDrawerOpen(true);
  };
  const handleJobClick = (job: JobWithCompany) => {
    setSelectedJob(job);
    setModalOpen(true);
  };

  const companyColumns = [
    {
      title: '公司名称',
      dataIndex: 'name',
      key: 'name',
      minWidth: 150,
      ellipsis: { showTitle: false },
      render: (name: string) => (
        <Tooltip title={name} placement="topLeft">
          <span onClick={() => handleCompanyClick(name)} style={{ cursor: 'pointer', color: '#1890ff' }}>{name}</span>
        </Tooltip>
      ),
    },
    {
      title: '行业',
      dataIndex: 'industries',
      key: 'industries',
      width: 110,
      render: (ind: string | string[] | null | undefined) => {
        const { first, all } = parseIndustry(ind);
        const display = all || first;
        const needTooltip = display.length > 8;
        const content = (
          <span style={{ display: 'inline-block', maxWidth: 95, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
            {first}
          </span>
        );
        return needTooltip ? <Tooltip title={display} placement="topLeft">{content}</Tooltip> : content;
      },
    },
    {
      title: '规模',
      dataIndex: 'company_size',
      key: 'company_size',
      width: 105,
      onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
      render: (size: string) => <span style={{ whiteSpace: 'nowrap' }}>{size || '—'}</span>,
    },
    { title: '岗位数', dataIndex: 'jobCount', key: 'jobCount', width: 70 },
    {
      title: '薪资范围',
      dataIndex: 'salaryRange',
      key: 'salaryRange',
      width: 105,
      onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
      render: (range: string) => <span style={{ whiteSpace: 'nowrap' }}>{range || '—'}</span>,
    },
    {
      title: '城市',
      dataIndex: 'cities',
      key: 'cities',
      width: 80,
      render: (cities: string[]) => cities?.slice(0, 2).map(c => <Tag key={c} color="blue">{c}</Tag>),
    },
    {
      title: '福利',
      dataIndex: 'benefits',
      key: 'benefits',
      minWidth: 200,
      render: (benefits: string[]) => <BenefitTags benefits={benefits} />,
    },
  ];

  // ========== Tab1: 画像分析 ==========
  const renderTab1 = () => {
    if (!profile) return <Empty description="暂无画像数据" />;

    const profileData = profile.profile_json as any;
    const techSkillsRaw = profileData?.technical_skills;
    const softSkills = Array.isArray(profileData?.soft_skills) ? profileData.soft_skills : [];

    const allSkills: Array<{ name: string; weight: number; category: string }> = [];
    const categoryLabels: Record<string, string> = {
      programming_languages: '编程语言',
      frameworks_and_libraries: '框架/库',
      tools_and_platforms: '工具平台',
      domain_skills: '领域技能',
      databases: '数据库',
      methodologies: '方法论',
    };

    if (Array.isArray(techSkillsRaw)) {
      techSkillsRaw.forEach((item: any) => {
        allSkills.push({ name: item.name, weight: (item.frequency_pct || 0) / 100, category: item.category || '其他' });
      });
    } else if (techSkillsRaw && typeof techSkillsRaw === 'object') {
      Object.entries(techSkillsRaw).forEach(([cat, items]: [string, any]) => {
        (Array.isArray(items) ? items : []).forEach((item: any) => {
          allSkills.push({ name: item.name, weight: item.weight || 0, category: categoryLabels[cat] || cat });
        });
      });
    }
    allSkills.sort((a, b) => b.weight - a.weight);

    const jdCount = role?.job_count || allJobs.length;
    const topBenefits = allJobsBenefitStats.slice(0, 3);
    const restBenefits = allJobsBenefitStats.slice(3, 10);

    return (
      <div style={{ padding: '0 8px' }}>
        <Row gutter={[16, 16]}>
          {/* 技术技能 - 占满左侧两行高度 (58%) */}
          <Col span={24} lg={14}>
            <div
              style={{ ...cardStyle, minHeight: 400 }}
              className="profile-card"
            >
              {/* 卡片标题 */}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 4, height: 14, borderRadius: 2, background: 'var(--blue-mid)' }} />
                技术技能
              </div>

              {/* 技能列表 */}
              {allSkills.slice(0, 15).map((s, i) => {
                const percentage = Math.round(s.weight * 100);
                const barStyle = getBarStyle(percentage);
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 44px', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <span style={{ fontSize: 13, ...barStyle.label, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                    </span>
                    <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          borderRadius: 4,
                          width: animated ? `${percentage}%` : '0%',
                          background: barStyle.fill,
                          transition: animated ? `width 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)` : 'none',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {percentage}%
                    </span>
                  </div>
                );
              })}
            </div>
          </Col>

          {/* 右侧：软素养 + 福利待遇 (42%) */}
          <Col span={24} lg={10}>
            {/* 软素养 */}
            <div style={{ ...cardStyle, marginBottom: 16 }} className="profile-card">
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 4, height: 14, borderRadius: 2, background: '#F59E0B' }} />
                软素养
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {softSkills.length > 0 ? softSkills.map((s: any, i: number) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 14px',
                      background: 'rgba(251, 191, 36, 0.12)',
                      border: '1px solid rgba(251, 191, 36, 0.25)',
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#92400E',
                      cursor: 'default',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(251, 191, 36, 0.22)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(251, 191, 36, 0.12)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {getSoftSkillIcon(s.name)}
                    {s.name}
                  </span>
                )) : <span style={{ color: 'var(--gray-400)' }}>暂无数据</span>}
              </div>
              {/* 底部 tagline */}
              {softSkills.length > 0 && (
                <p style={{
                  marginTop: 20,
                  fontSize: 12,
                  color: 'var(--gray-400)',
                  lineHeight: 1.6,
                  fontStyle: 'italic'
                }}>
                  以上素养来源于 {jdCount} 条真实 JD 的结构化分析
                </p>
              )}
            </div>

            {/* 福利待遇 */}
            <div style={{ ...cardStyle }} className="profile-card">
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 4, height: 14, borderRadius: 2, background: '#10B981' }} />
                福利待遇
              </div>

              {allJobs.length > 0 && allJobsBenefitStats.length > 0 ? (
                <div>
                  {/* 高频前3 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {topBenefits.map((b: any, i: number) => (
                      <span
                        key={i}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 16px',
                          background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.08))',
                          border: '1px solid rgba(16,185,129,0.25)',
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#065F46',
                        }}
                      >
                        {b.name}
                        <span style={{ background: '#10B981', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                          {b.frequency}
                        </span>
                      </span>
                    ))}
                  </div>
                  {/* 其余标签 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {restBenefits.map((b: any, i: number) => (
                      <span
                        key={i}
                        style={{
                          padding: '5px 12px',
                          background: 'rgba(16,185,129,0.07)',
                          border: '1px solid rgba(16,185,129,0.15)',
                          borderRadius: 8,
                          fontSize: 12,
                          color: '#047857',
                        }}
                      >
                        {b.name}
                        <span style={{ color: '#10B981', fontWeight: 600, marginLeft: 3 }}>{b.frequency}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <span style={{ color: 'var(--gray-400)' }}>暂无福利数据</span>
              )}
            </div>
          </Col>
        </Row>

        {/* 注入动画样式 */}
        <style>{`
          .profile-card:hover {
            transform: translateY(-2px);
            box-shadow: var(--card-shadow-hover);
          }
        `}</style>
      </div>
    );
  };

  // ========== Tab2: 关联岗位与公司（保持原样） ==========
  const renderTab2 = () => {
    if (allJobs.length === 0) return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;
    const hasFilters = filters.salaryRange || filters.city || filters.benefits.length > 0;

    return (
      <div style={{ padding: '0 8px' }}>
        {hasFilters && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--gray-100)', borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--gray-500)' }}>已筛选:</span>
              {filters.salaryRange && (
                <Tag color="blue" closable onClose={() => removeFilter('salaryRange')} style={{ cursor: 'pointer' }}>
                  薪资: {filters.salaryRange}
                </Tag>
              )}
              {filters.city && (
                <Tag color="green" closable onClose={() => removeFilter('city')} style={{ cursor: 'pointer' }}>
                  城市: {filters.city}
                </Tag>
              )}
              {filters.benefits.map(b => (
                <Tag key={b} color="orange" closable onClose={() => removeFilter('benefits', b)} style={{ cursor: 'pointer' }}>
                  福利: {b}
                </Tag>
              ))}
              <Button type="link" size="small" icon={<ClearOutlined />} onClick={clearAllFilters}>清除全部</Button>
              <span style={{ marginLeft: 'auto', color: 'var(--gray-500)' }}>
                已筛选 <strong>{filteredJobs.length}</strong> 个JD / 共 <strong>{allJobs.length}</strong> 个JD
              </span>
            </div>
          </div>
        )}

        <Row gutter={16}>
          <Col span={12}>
            <Card title={<><DollarOutlined /> 薪资分布</>} size="small" style={{ marginBottom: 16 }}>
              {salaryDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={salaryDist} layout="vertical" onClick={(e) => { if (e && e.activePayload && e.activePayload[0]) handleSalaryClick(e.activePayload[0].payload.range); }}>
                    <XAxis type="number" />
                    <YAxis dataKey="range" type="category" width={60} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {salaryDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={filters.salaryRange === entry.range ? COLORS[1] : COLORS[0]} style={{ cursor: 'pointer' }} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
              <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 8 }}>点击柱子筛选</div>
            </Card>
          </Col>
          <Col span={12}>
            <Card title={<><EnvironmentOutlined /> 城市分布</>} size="small" style={{ marginBottom: 16 }}>
              {cityDist.length > 0 ? (
                <div style={{ maxHeight: 220, overflow: 'auto' }}>
                  {cityDist.slice(0, 10).map((c, i) => (
                    <div key={i} onClick={() => handleCityClick(c.city)} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px dashed var(--gray-200)', cursor: 'pointer', background: filters.city === c.city ? 'var(--blue-bg)' : 'transparent', borderRadius: 4 }}>
                      <span>{c.city}</span>
                      <span>
                        <Tag color={filters.city === c.city ? 'blue' : ''}>{c.count} 个岗位</Tag>
                        {c.avg_salary_min && c.avg_salary_max && (
                          <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{Math.round(c.avg_salary_min / 1000)}K-{Math.round(c.avg_salary_max / 1000)}K</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
        </Row>

        <Card title={<><GiftOutlined /> 福利统计</>} size="small" style={{ marginBottom: 16 }}>
          {benefitStats.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {benefitStats.map((b, i) => {
                const isActive = filters.benefits.includes(b.name);
                return (
                  <Tag key={i} color={isActive ? 'orange' : (i < 5 ? 'green' : 'default')} onClick={() => handleBenefitClick(b.name)} style={{ cursor: 'pointer' }}>
                    {b.name} ({b.frequency})
                  </Tag>
                );
              })}
            </div>
          ) : (
            <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        <Card title={<><BankOutlined /> 招聘公司 ({companyList.length})</>} size="small">
          {companyList.length > 0 ? (
            <Table dataSource={companyList} columns={companyColumns} rowKey="name" size="small" pagination={false} />
          ) : (
            <Empty description="当前筛选条件下无匹配公司，请调整筛选" />
          )}
        </Card>

        <Drawer title={selectedCompany?.name} placement="right" width={600} open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          {selectedCompany && selectedCompany.jobs.length > 0 ? (
            <div>
              <div style={{ marginBottom: 16, color: 'var(--gray-500)' }}>共 {selectedCompany.jobs.length} 个在招岗位</div>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {selectedCompany.jobs.map(job => (
                  <Card key={job.id} size="small" hoverable onClick={() => handleJobClick(job)} style={{ cursor: 'pointer' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{job.title}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <Tag color="blue">{job.city}</Tag>
                      <Tag color="green">{formatSalary(job.salary_min, job.salary_max)}</Tag>
                      {job.published_at && <Tag>{job.published_at}</Tag>}
                    </div>
                    {job.benefits && job.benefits.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {job.benefits.slice(0, 5).map((b, i) => <Tag key={i} color="orange" style={{ fontSize: 11 }}>{b}</Tag>)}
                      </div>
                    )}
                  </Card>
                ))}
              </Space>
            </div>
          ) : (
            <Empty description="暂无招聘数据" />
          )}
        </Drawer>

        <Modal
          title={selectedJob?.title}
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          footer={[
            selectedJob?.source_url ? (
              <Button key="source" type="primary" onClick={() => window.open(selectedJob.source_url, '_blank')}>查看来源</Button>
            ) : null,
            <Button key="close" onClick={() => setModalOpen(false)}>关闭</Button>,
          ]}
          width={800}
        >
          {selectedJob && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Tag color="blue">{selectedJob.city}</Tag>
                  <Tag color="green">{formatSalary(selectedJob.salary_min, selectedJob.salary_max)}{selectedJob.salary_months && selectedJob.salary_months !== 12 ? `·${selectedJob.salary_months}薪` : ''}</Tag>
                  <Tag>{selectedJob.company?.name || selectedJob.company_name}</Tag>
                </Space>
              </div>
              {selectedJob.description && (
                <div style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto', padding: 12, background: 'var(--gray-100)', borderRadius: 8, lineHeight: 1.8 }}>
                  {selectedJob.description}
                </div>
              )}
              {selectedJob.benefits && selectedJob.benefits.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <strong>福利待遇：</strong>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                    {selectedJob.benefits.map((b, i) => <Tag key={i} color="green">{b}</Tag>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    );
  };

  if (loading) return <LoadingState />;
  if (!role) return <Empty description="角色不存在" />;

  const items = [
    { key: 'profile', label: '画像分析', children: renderTab1() },
    { key: 'companies', label: '关联公司', children: renderTab2() },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      padding: 24,
      fontFamily: FONTS.primary,
    }}>
      {/* 返回按钮 */}
      <div style={{ marginBottom: 16 }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/jobs/profiles')}
          style={{ padding: 0, color: 'var(--gray-500)' }}
        >
          返回画像库
        </Button>
      </div>

      {/* Header 卡片 - 压缩高度 */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 16,
          padding: '16px 40px',
          marginBottom: 16,
          boxShadow: 'var(--card-shadow)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        {/* 左侧 */}
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: -0.5, fontFamily: FONTS.primary }}>
            {role.name}
          </h2>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
                color: 'white',
                borderRadius: 20,
                padding: '3px 12px',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {role.category}
            </span>
            {profile && (
              <span
                style={{
                  background: 'var(--gray-100)',
                  color: 'var(--gray-500)',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 11,
                  fontFamily: FONTS.mono,
                }}
              >
                v{profile.version}
              </span>
            )}
          </div>
        </div>

        {/* 右侧 - 只保留 JD 大数字 */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--primary)', letterSpacing: -1, lineHeight: 1, fontFamily: FONTS.primary }}>
            {role.job_count}
          </div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>个在招岗位</div>
          <div style={{ fontSize: 11, color: '#C4B5FD', marginTop: 2 }}>
            · {role.category} · v{profile?.version || '1'}
          </div>
        </div>
      </div>

      {/* Tab 区域 */}
      <Card style={{ borderRadius: 16, boxShadow: 'var(--card-shadow)', border: 'none' }}>
        <Tabs
          type="line"
          items={items}
          onChange={handleTabChange}
          style={{ marginTop: -8 }}
        />
      </Card>
    </div>
  );
}
