import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Tabs, Table, Tag, Button, Spin, Empty,
  Select, Space, message, Pagination
} from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  ArrowLeftOutlined, BankOutlined, DollarOutlined,
  EnvironmentOutlined, GiftOutlined
} from '@ant-design/icons';
import { jobsApi } from '../api/jobs';
import type {
  RoleResponse, JobProfileResponse,
  SalaryDistributionItem, CityDistributionItem,
  BenefitItem, RoleCompanyItem
} from '../types/job';
import LoadingState from '../components/LoadingState';

const COLORS = ['#4361EE', '#2EC4B6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// 头像色
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

export default function JobProfileDetail() {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<RoleResponse | null>(null);
  const [profile, setProfile] = useState<JobProfileResponse | null>(null);

  // Tab2 数据
  const [companies, setCompanies] = useState<RoleCompanyItem[]>([]);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyTotal, setCompanyTotal] = useState(0);
  const [companyPage, setCompanyPage] = useState(1);
  const [companySize, setCompanySize] = useState('20');
  const [sortBy, setSortBy] = useState('job_count');

  const [salaryDist, setSalaryDist] = useState<SalaryDistributionItem[]>([]);
  const [cityDist, setCityDist] = useState<CityDistributionItem[]>([]);
  const [benefits, setBenefits] = useState<BenefitItem[]>([]);
  const [tab2Loading, setTab2Loading] = useState(false);

  useEffect(() => {
    if (roleId) {
      fetchRoleData();
    }
  }, [roleId]);

  // 切换 Tab 时加载 Tab2 数据
  const handleTabChange = (key: string) => {
    if (key === 'companies' && companies.length === 0) {
      fetchCompanies();
      fetchSalaryDist();
      fetchCityDist();
      fetchBenefits();
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

  const fetchCompanies = async () => {
    if (!roleId) return;
    setCompanyLoading(true);
    try {
      const res = await jobsApi.getRoleCompanies(roleId, {
        page: companyPage,
        page_size: parseInt(companySize),
        sort_by: sortBy,
      });
      setCompanies(res.data.items);
      setCompanyTotal(res.data.total);
    } catch (error) {
      message.error('获取公司列表失败');
    } finally {
      setCompanyLoading(false);
    }
  };

  const fetchSalaryDist = async () => {
    if (!roleId) return;
    try {
      const res = await jobsApi.getSalaryDistribution(roleId);
      setSalaryDist(res.data);
    } catch (error) {
      console.error('获取薪资分布失败', error);
    }
  };

  const fetchCityDist = async () => {
    if (!roleId) return;
    try {
      const res = await jobsApi.getCityDistribution(roleId, 15);
      setCityDist(res.data);
    } catch (error) {
      console.error('获取城市分布失败', error);
    }
  };

  const fetchBenefits = async () => {
    if (!roleId) return;
    try {
      const res = await jobsApi.getBenefitsStats(roleId);
      setBenefits(res.data);
    } catch (error) {
      console.error('获取福利统计失败', error);
    }
  };

  // 监听分页和筛选变化
  useEffect(() => {
    if (companies.length > 0) {
      fetchCompanies();
    }
  }, [companyPage, companySize, sortBy]);

  // 公司表格列
  const companyColumns = [
    {
      title: '公司名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <a>{name}</a>,
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
      dataIndex: 'job_count',
      key: 'job_count',
      width: 80,
      sorter: true,
    },
    {
      title: '薪资范围',
      dataIndex: 'salary_range',
      key: 'salary_range',
      width: 100,
    },
    {
      title: '城市',
      dataIndex: 'cities',
      key: 'cities',
      render: (cities: string[]) => cities?.slice(0, 2).map(c => <Tag key={c} color="blue">{c}</Tag>),
    },
  ];

  // ========== Tab1: 画像分析（复用现有逻辑的简化版）==========
  const renderTab1 = () => {
    if (!profile) {
      return <Empty description="暂无画像数据" />;
    }

    const profileData = profile.profile_json as any;
    const basicRequirements = profileData?.basic_requirements || {};
    // 兼容新旧两种结构：新结构是数组，旧结构是按分类的对象
    const techSkillsRaw = profileData?.technical_skills;
    const softSkills = Array.isArray(profileData?.soft_skills) ? profileData.soft_skills : [];
    const benefits = Array.isArray(profileData?.benefits) ? profileData.benefits : [];
    const totalJds = profileData?.total_jds_analyzed || 0;

    // 扁平化技能 - 兼容数组结构
    const allSkills: Array<{ name: string; weight: number; category: string }> = [];
    const categoryLabels: Record<string, string> = {
      programming_languages: '编程语言',
      frameworks_and_libraries: '框架/库',
      tools_and_platforms: '工具平台',
      domain_skills: '领域技能',
      databases: '数据库',
      methodologies: '方法论',
    };

    // 新结构：数组直接使用
    if (Array.isArray(techSkillsRaw)) {
      techSkillsRaw.forEach((item: any) => {
        allSkills.push({
          name: item.name,
          weight: (item.frequency_pct || 0) / 100,
          category: item.category || '其他',
        });
      });
    } else if (techSkillsRaw && typeof techSkillsRaw === 'object') {
      // 旧结构：按分类的对象
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
        {/* 统计条 */}
        <div style={{
          display: 'flex', gap: 16, padding: 12, background: '#fff', borderRadius: 8,
          marginBottom: 16, flexWrap: 'wrap'
        }}>
          <div><strong>{totalJds}</strong> 条 JD</div>
          <div>城市: {(basicRequirements.cities || []).slice(0, 3).map((c: any) => c.name).join(', ')}</div>
        </div>

        <Row gutter={16}>
          {/* 技能 */}
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

          {/* 软技能 */}
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
                {benefits.slice(0, 10).map((b: any, i: number) => (
                  <Tag key={i} color="green">{b.name} ({b.frequency})</Tag>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  // ========== Tab2: 关联岗位与公司 ==========
  const renderTab2 = () => {
    if (tab2Loading) {
      return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;
    }

    return (
      <div style={{ padding: '0 8px' }}>
        <Row gutter={16}>
          {/* 薪资分布 */}
          <Col span={12}>
            <Card
              title={<><DollarOutlined /> 薪资分布</>}
              size="small"
              style={{ marginBottom: 16 }}
            >
              {salaryDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={salaryDist} layout="vertical">
                    <XAxis type="number" />
                    <YAxis dataKey="range" type="category" width={60} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4361EE" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>

          {/* 城市分布 */}
          <Col span={12}>
            <Card
              title={<><EnvironmentOutlined /> 城市分布</>}
              size="small"
              style={{ marginBottom: 16 }}
            >
              {cityDist.length > 0 ? (
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {cityDist.slice(0, 10).map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #f0f0f0' }}>
                      <span>{c.city}</span>
                      <span>
                        <Tag>{c.count} 个岗位</Tag>
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

        {/* 福利统计 */}
        <Card
          title={<><GiftOutlined /> 福利统计</>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          {benefits.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {benefits.map((b, i) => (
                <Tag key={i} color={i < 5 ? 'green' : 'default'}>
                  {b.name} ({b.frequency})
                </Tag>
              ))}
            </div>
          ) : (
            <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        {/* 公司列表 */}
        <Card
          title={<><BankOutlined /> 招聘公司 ({companyTotal})</>}
          size="small"
          extra={
            <Space>
              <Select
                value={sortBy}
                onChange={setSortBy}
                style={{ width: 100 }}
                options={[
                  { value: 'job_count', label: '按岗位数' },
                  { value: 'salary', label: '按薪资' },
                  { value: 'company_size', label: '按规模' },
                ]}
              />
              <Select
                value={companySize}
                onChange={(v) => { setCompanySize(v); setCompanyPage(1); }}
                style={{ width: 80 }}
                options={[
                  { value: '10', label: '10条' },
                  { value: '20', label: '20条' },
                  { value: '50', label: '50条' },
                ]}
              />
            </Space>
          }
        >
          <Table
            dataSource={companies}
            columns={companyColumns}
            rowKey="id"
            loading={companyLoading}
            size="small"
            pagination={false}
          />
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <Pagination
              current={companyPage}
              pageSize={parseInt(companySize)}
              total={companyTotal}
              onChange={(p) => setCompanyPage(p)}
              showSizeChanger={false}
            />
          </div>
        </Card>
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
      {/* 头部 */}
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
