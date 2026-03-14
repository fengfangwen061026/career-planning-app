import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Tabs, Table, Tag, Button, Spin, Empty,
  Select, Space, message, Pagination, Drawer, Modal
} from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  ArrowLeftOutlined, BankOutlined, DollarOutlined,
  EnvironmentOutlined, GiftOutlined, CloseOutlined, ClearOutlined
} from '@ant-design/icons';
import { jobsApi } from '../api/jobs';
import type {
  RoleResponse, JobProfileResponse,
  JobWithCompany, FilterState
} from '../types/job';
import LoadingState from '../components/LoadingState';

const COLORS = ['#4361EE', '#2EC4B6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// 薪资区间定义
const SALARY_RANGES = [
  { label: '3K以下', min: 0, max: 3000 },
  { label: '3-5K', min: 3000, max: 5000 },
  { label: '5-8K', min: 5000, max: 8000 },
  { label: '8-12K', min: 8000, max: 12000 },
  { label: '12-20K', min: 12000, max: 20000 },
  { label: '20K以上', min: 20000, max: Infinity },
];

// 获取分类颜色
const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    '技术类': 'blue',
    '产品类': 'purple',
    '设计类': 'orange',
    '运营类': 'green',
    '市场类': 'red',
    '销售类': 'cyan',
    '职能类': 'gold',
    '管理类': 'geekblue',
    '其他': 'default',
  };
  return colors[category] || 'default';
};

// 格式化薪资
const formatSalary = (min?: number, max?: number) => {
  if (!min && !max) return '-';
  const minK = min ? `${Math.round(min / 1000)}K` : '';
  const maxK = max ? `${Math.round(max / 1000)}K` : '';
  return minK && maxK ? `${minK}-${maxK}` : max ? `最高${maxK}` : `最低${minK}`;
};

export default function JobProfileDetail() {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<RoleResponse | null>(null);
  const [profile, setProfile] = useState<JobProfileResponse | null>(null);

  // 全量 JD 数据（用于筛选）
  const [allJobs, setAllJobs] = useState<JobWithCompany[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

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

  useEffect(() => {
    if (roleId) {
      fetchRoleData();
    }
  }, [roleId]);

  // 加载全量 JD 数据
  const fetchAllJobs = async () => {
    if (!roleId) return;
    setJobsLoading(true);
    try {
      const res = await jobsApi.getJobsByRole(roleId);
      setAllJobs(res.data);
    } catch (error) {
      console.error('获取JD列表失败', error);
      message.error('获取岗位数据失败');
    } finally {
      setJobsLoading(false);
    }
  };

  // 切换 Tab 时加载数据
  const handleTabChange = (key: string) => {
    if (key === 'companies' && allJobs.length === 0) {
      fetchAllJobs();
    }
  };

  const fetchRoleData = async () => {
    if (!roleId) return;
    setLoading(true);
    try {
      const [rolesRes, profileRes] = await Promise.all([
        jobsApi.getRoles(true),
        jobsApi.getRoleProfiles(roleId),
      ]);

      const foundRole = rolesRes.data.find((r) => r.id === roleId);
      if (foundRole) {
        setRole(foundRole);
        const profiles = profileRes.data.profiles;
        if (profiles && profiles.length > 0) {
          setProfile(profiles[0]);
        }
      }
    } catch (error) {
      message.error('获取岗位数据失败');
    } finally {
      setLoading(false);
    }
  };

  // ========== 筛选逻辑 ==========
  // 筛选后的 JD 列表
  const filteredJobs = useMemo(() => {
    return allJobs.filter(job => {
      // 薪资筛选
      if (filters.salaryRange) {
        const range = SALARY_RANGES.find(r => r.label === filters.salaryRange);
        if (range) {
          const salaryMin = job.salary_min || 0;
          if (salaryMin < range.min || salaryMin >= range.max) {
            return false;
          }
        }
      }
      // 城市筛选
      if (filters.city && job.city !== filters.city) {
        return false;
      }
      // 福利筛选（AND 关系）
      if (filters.benefits.length > 0) {
        const jobBenefits = job.benefits || [];
        if (!filters.benefits.every(b => jobBenefits.includes(b))) {
          return false;
        }
      }
      return true;
    });
  }, [allJobs, filters]);

  // 计算筛选后的统计数据
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

    return SALARY_RANGES.map(r => ({
      range: r.label,
      count: counts[r.label],
    }));
  }, [filteredJobs]);

  const cityDist = useMemo(() => {
    const counts: Record<string, { count: number; salaries: number[] }> = {};
    filteredJobs.forEach(job => {
      if (!counts[job.city]) {
        counts[job.city] = { count: 0, salaries: [] };
      }
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

  // 计算筛选后的公司列表
  const companyList = useMemo(() => {
    const companyMap = new Map<string, { name: string; jobCount: number; industries: string; company_size: string; cities: string[]; salaryRange: string }>();

    filteredJobs.forEach(job => {
      const companyName = job.company?.name || job.company_name || '未知公司';
      if (!companyMap.has(companyName)) {
        companyMap.set(companyName, {
          name: companyName,
          jobCount: 0,
          industries: job.company?.industries || '',  // 已经是字符串
          company_size: job.company?.company_size || '',
          cities: [],
          salaryRange: '',
        });
      }
      const c = companyMap.get(companyName)!;
      c.jobCount++;
      if (job.city && !c.cities.includes(job.city)) {
        c.cities.push(job.city);
      }
      if (job.salary_min && job.salary_max) {
        const range = `${Math.round(job.salary_min / 1000)}K-${Math.round(job.salary_max / 1000)}K`;
        if (!c.salaryRange) c.salaryRange = range;
      }
    });

    return Array.from(companyMap.values())
      .sort((a, b) => b.jobCount - a.jobCount);
  }, [filteredJobs]);

  // ========== 筛选交互 ==========
  const handleSalaryClick = (range: string) => {
    setFilters(prev => ({
      ...prev,
      salaryRange: prev.salaryRange === range ? null : range,
    }));
  };

  const handleCityClick = (city: string) => {
    setFilters(prev => ({
      ...prev,
      city: prev.city === city ? null : city,
    }));
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
      if (type === 'benefits' && value) {
        return { ...prev, benefits: prev.benefits.filter(b => b !== value) };
      }
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

  // 公司表格列
  const companyColumns = [
    {
      title: '公司名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <a onClick={() => handleCompanyClick(name)}>{name}</a>,
    },
    {
      title: '行业',
      dataIndex: 'industries',
      key: 'industries',
      width: 150,
      render: (ind: string) => ind ? <Tag>{ind.split(',')[0]}</Tag> : '-',
    },
    {
      title: '规模',
      dataIndex: 'company_size',
      key: 'company_size',
      width: 100,
    },
    {
      title: '岗位数',
      dataIndex: 'jobCount',
      key: 'jobCount',
      width: 80,
    },
    {
      title: '薪资范围',
      dataIndex: 'salaryRange',
      key: 'salaryRange',
      width: 100,
    },
    {
      title: '城市',
      dataIndex: 'cities',
      key: 'cities',
      render: (cities: string[]) => cities?.slice(0, 2).map(c => <Tag key={c} color="blue">{c}</Tag>),
    },
  ];

  // ========== Tab1: 画像分析 ==========
  const renderTab1 = () => {
    if (!profile) {
      return <Empty description="暂无画像数据" />;
    }

    const profileData = profile.profile_json as any;
    const basicRequirements = profileData?.basic_requirements || {};
    const techSkillsRaw = profileData?.technical_skills;
    const softSkills = Array.isArray(profileData?.soft_skills) ? profileData.soft_skills : [];
    const profileBenefits = Array.isArray(profileData?.benefits) ? profileData.benefits : [];
    const totalJds = profileData?.total_jds_analyzed || 0;

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
        allSkills.push({
          name: item.name,
          weight: (item.frequency_pct || 0) / 100,
          category: item.category || '其他',
        });
      });
    } else if (techSkillsRaw && typeof techSkillsRaw === 'object') {
      Object.entries(techSkillsRaw).forEach(([cat, items]: [string, any]) => {
        (Array.isArray(items) ? items : []).forEach((item: any) => {
          allSkills.push({
            name: item.name,
            weight: item.weight || 0,
            category: categoryLabels[cat] || cat,
          });
        });
      });
    }
    allSkills.sort((a, b) => b.weight - a.weight);

    return (
      <div style={{ padding: '0 8px' }}>
        <div style={{
          display: 'flex', gap: 16, padding: 12, background: '#fff', borderRadius: 8,
          marginBottom: 16, flexWrap: 'wrap'
        }}>
          <div><strong>{totalJds}</strong> 条 JD</div>
          <div>城市: {(basicRequirements.cities || []).slice(0, 3).map((c: any) => c.name).join(', ')}</div>
        </div>

        <Row gutter={16}>
          <Col span={12}>
            <Card title="技术技能" size="small" style={{ marginBottom: 16 }}>
              {allSkills.slice(0, 15).map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ width: 80, fontSize: 12 }}>{s.name}</span>
                  <div style={{ flex: 1, height: 6, background: '#f0f0f0', borderRadius: 3 }}>
                    <div style={{ width: `${s.weight * 100}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 3 }} />
                  </div>
                  <span style={{ width: 40, fontSize: 10, textAlign: 'right' }}>{(s.weight * 100).toFixed(0)}%</span>
                </div>
              ))}
            </Card>
          </Col>

          <Col span={12}>
            <Card title="软素养" size="small" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {softSkills.map((s: any, i: number) => (
                  <Tag key={i} color="blue">{s.name}</Tag>
                ))}
              </div>
            </Card>

            <Card title="福利待遇" size="small">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {profileBenefits.slice(0, 10).map((b: any, i: number) => (
                  <Tag key={i} color="green">{b.name} ({b.frequency})</Tag>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  // ========== Tab2: 关联岗位与公司（带筛选） ==========
  const renderTab2 = () => {
    if (jobsLoading) {
      return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;
    }

    const hasFilters = filters.salaryRange || filters.city || filters.benefits.length > 0;

    return (
      <div style={{ padding: '0 8px' }}>
        {/* 筛选条件展示区 */}
        {hasFilters && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f6f8fa', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#666' }}>已筛选:</span>
              {filters.salaryRange && (
                <Tag
                  color="blue"
                  closable
                  onClose={() => removeFilter('salaryRange')}
                  style={{ cursor: 'pointer' }}
                >
                  薪资: {filters.salaryRange}
                </Tag>
              )}
              {filters.city && (
                <Tag
                  color="green"
                  closable
                  onClose={() => removeFilter('city')}
                  style={{ cursor: 'pointer' }}
                >
                  城市: {filters.city}
                </Tag>
              )}
              {filters.benefits.map(b => (
                <Tag
                  key={b}
                  color="orange"
                  closable
                  onClose={() => removeFilter('benefits', b)}
                  style={{ cursor: 'pointer' }}
                >
                  福利: {b}
                </Tag>
              ))}
              <Button
                type="link"
                size="small"
                icon={<ClearOutlined />}
                onClick={clearAllFilters}
              >
                清除全部
              </Button>
              <span style={{ marginLeft: 'auto', color: '#666' }}>
                已筛选 <strong>{filteredJobs.length}</strong> 个JD / 共 <strong>{allJobs.length}</strong> 个JD
              </span>
            </div>
          </div>
        )}

        <Row gutter={16}>
          {/* 薪资分布（可点击） */}
          <Col span={12}>
            <Card
              title={<><DollarOutlined /> 薪资分布</>}
              size="small"
              style={{ marginBottom: 16 }}
            >
              {salaryDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={salaryDist}
                    layout="vertical"
                    onClick={(e) => {
                      if (e && e.activePayload && e.activePayload[0]) {
                        handleSalaryClick(e.activePayload[0].payload.range);
                      }
                    }}
                  >
                    <XAxis type="number" />
                    <YAxis dataKey="range" type="category" width={60} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      radius={[0, 4, 4, 0]}
                    >
                      {salaryDist.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={filters.salaryRange === entry.range ? COLORS[1] : COLORS[0]}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
              <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
                点击柱子筛选
              </div>
            </Card>
          </Col>

          {/* 城市分布（可点击） */}
          <Col span={12}>
            <Card
              title={<><EnvironmentOutlined /> 城市分布</>}
              size="small"
              style={{ marginBottom: 16 }}
            >
              {cityDist.length > 0 ? (
                <div style={{ maxHeight: 220, overflow: 'auto' }}>
                  {cityDist.slice(0, 10).map((c, i) => (
                    <div
                      key={i}
                      onClick={() => handleCityClick(c.city)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        borderBottom: '1px dashed #f0f0f0',
                        cursor: 'pointer',
                        background: filters.city === c.city ? '#e6f7ff' : 'transparent',
                        borderRadius: 4,
                      }}
                    >
                      <span>{c.city}</span>
                      <span>
                        <Tag color={filters.city === c.city ? 'blue' : ''}>{c.count} 个岗位</Tag>
                        {c.avg_salary_min && c.avg_salary_max && (
                          <span style={{ fontSize: 11, color: '#666' }}>
                            {Math.round(c.avg_salary_min / 1000)}K-{Math.round(c.avg_salary_max / 1000)}K
                          </span>
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

        {/* 福利统计（可点击） */}
        <Card
          title={<><GiftOutlined /> 福利统计</>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          {benefitStats.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {benefitStats.map((b, i) => {
                const isActive = filters.benefits.includes(b.name);
                return (
                  <Tag
                    key={i}
                    color={isActive ? 'orange' : (i < 5 ? 'green' : 'default')}
                    onClick={() => handleBenefitClick(b.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    {b.name} ({b.frequency})
                  </Tag>
                );
              })}
            </div>
          ) : (
            <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        {/* 公司列表 */}
        <Card
          title={<><BankOutlined /> 招聘公司 ({companyList.length})</>}
          size="small"
        >
          {companyList.length > 0 ? (
            <Table
              dataSource={companyList}
              columns={companyColumns}
              rowKey="name"
              size="small"
              pagination={false}
            />
          ) : (
            <Empty description="当前筛选条件下无匹配公司，请调整筛选" />
          )}
        </Card>

        {/* 公司详情 Drawer */}
        <Drawer
          title={selectedCompany?.name}
          placement="right"
          width={600}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          {selectedCompany && selectedCompany.jobs.length > 0 ? (
            <div>
              <div style={{ marginBottom: 16, color: '#666' }}>
                共 {selectedCompany.jobs.length} 个在招岗位
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {selectedCompany.jobs.map(job => (
                  <Card
                    key={job.id}
                    size="small"
                    hoverable
                    onClick={() => handleJobClick(job)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{job.title}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <Tag color="blue">{job.city}</Tag>
                      <Tag color="green">{formatSalary(job.salary_min, job.salary_max)}</Tag>
                      {job.published_at && <Tag>{job.published_at}</Tag>}
                    </div>
                    {job.benefits && job.benefits.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {job.benefits.slice(0, 5).map((b, i) => (
                          <Tag key={i} color="orange" style={{ fontSize: 11 }}>{b}</Tag>
                        ))}
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

        {/* JD 详情 Modal */}
        <Modal
          title={selectedJob?.title}
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          footer={[
            selectedJob?.source_url ? (
              <Button
                key="source"
                type="primary"
                onClick={() => window.open(selectedJob.source_url, '_blank')}
              >
                查看来源
              </Button>
            ) : null,
            <Button key="close" onClick={() => setModalOpen(false)}>
              关闭
            </Button>,
          ]}
          width={800}
        >
          {selectedJob && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Tag color="blue">{selectedJob.city}</Tag>
                  <Tag color="green">
                    {formatSalary(selectedJob.salary_min, selectedJob.salary_max)}
                    {selectedJob.salary_months && selectedJob.salary_months !== 12 ? `·${selectedJob.salary_months}薪` : ''}
                  </Tag>
                  <Tag>{selectedJob.company?.name || selectedJob.company_name}</Tag>
                </Space>
              </div>
              {selectedJob.description && (
                <div style={{
                  whiteSpace: 'pre-wrap',
                  maxHeight: 400,
                  overflow: 'auto',
                  padding: 12,
                  background: '#f6f8fa',
                  borderRadius: 8,
                  lineHeight: 1.8
                }}>
                  {selectedJob.description}
                </div>
              )}
              {selectedJob.benefits && selectedJob.benefits.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <strong>福利待遇：</strong>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                    {selectedJob.benefits.map((b, i) => (
                      <Tag key={i} color="green">{b}</Tag>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    );
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!role) {
    return <Empty description="角色不存在" />;
  }

  const items = [
    {
      key: 'profile',
      label: '画像分析',
      children: renderTab1(),
    },
    {
      key: 'companies',
      label: '关联公司',
      children: renderTab2(),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/jobs/profiles')}
        >
          返回画像库
        </Button>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{role.name}</h2>
          <Tag color={getCategoryColor(role.category)}>{role.category}</Tag>
          {profile && <Tag>v{profile.version}</Tag>}
          <span style={{ marginLeft: 'auto', color: '#666' }}>
            {role.job_count} 个 JD
          </span>
        </div>

        <Tabs
          items={items}
          onChange={handleTabChange}
        />
      </Card>
    </div>
  );
}
