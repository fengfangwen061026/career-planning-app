import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Popconfirm, Select, Tag, Pagination } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
import { Briefcase } from 'lucide-react';
import { jobsApi } from '../api/jobs';
import type { JobResponse, JobCreate, JobUpdate, RoleResponse, PaginatedJobResponse } from '../types/job';
import LoadingState from '../components/LoadingState';

// 模块专属色 - 鼠尾草绿色系
const MODULE_COLOR = '#5E8F6E';
const MODULE_BG = '#EEF6F2';

// 统计摘要数据 - 基于当前页数据计算
const getStats = (total: number, currentPageData: JobResponse[]) => {
  // 基于技能是否填写来估算已完善信息的岗位
  const withSkills = currentPageData.filter(j => j.skills && j.skills.length > 0).length;
  const pending = currentPageData.length - withSkills;
  return { total, withSkills, pending };
};

export default function JobManagement() {
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState<JobResponse | null>(null);
  const [viewingJob, setViewingJob] = useState<JobResponse | null>(null);
  const [form] = Form.useForm<JobCreate>();

  // 筛选状态
  const [keyword, setKeyword] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | undefined>(undefined);
  const [roles, setRoles] = useState<RoleResponse[]>([]);

  // 分页状态
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 10,
    total: 0,
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [pagination.page, pagination.page_size, selectedRole, keyword]);

  const fetchRoles = async () => {
    try {
      const response = await jobsApi.getRoles();
      setRoles(response.data);
    } catch {
      message.error('获取角色列表失败');
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await jobsApi.getJobs({
        page: pagination.page,
        page_size: pagination.page_size,
        role: selectedRole,
        keyword: keyword || undefined,
      });
      const data = response.data as PaginatedJobResponse;
      setJobs(data.items);
      setPagination(prev => ({ ...prev, total: data.total }));
    } catch {
      message.error('获取岗位列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setKeyword(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleRoleChange = (value: string | undefined) => {
    setSelectedRole(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, page, page_size: pageSize }));
  };

  const handleView = (record: JobResponse) => {
    setViewingJob(record);
    setDetailModalVisible(true);
  };

  const handleAdd = () => {
    setEditingJob(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: JobResponse) => {
    setEditingJob(record);
    const { id, created_at, updated_at, ...formValues } = record;
    form.setFieldsValue(formValues as JobCreate);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await jobsApi.deleteJob(id);
      message.success('删除成功');
      fetchJobs();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingJob) {
        const updateValues: JobUpdate = {
          title: values.title,
          role: values.role,
          city: values.city,
          description: values.description,
          salary_min: values.salary_min,
          salary_max: values.salary_max,
        };
        await jobsApi.updateJob(editingJob.id, updateValues);
        message.success('更新成功');
      } else {
        await jobsApi.createJob(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchJobs();
    } catch {
      message.error('操作失败');
    }
  };

  // 表头样式
  const headerCellStyle: React.CSSProperties = {
    fontSize: '11px',
    textTransform: 'uppercase',
    color: '#9CA3AF',
    background: 'rgba(249,250,251,0.8)',
    fontWeight: 600,
  };

  const columns = [
    {
      title: '岗位名称',
      dataIndex: 'title',
      key: 'title',
      width: 180,
      titleRender: () => <span style={headerCellStyle}>岗位名称</span>,
      render: (title: string) => (
        <span style={{ fontWeight: 600, color: '#0A0A0A' }}>{title}</span>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      titleRender: () => <span style={headerCellStyle}>Role</span>,
      render: (role: string) => role ? (
        <span style={{
          background: 'rgba(94,143,110,0.10)',
          color: '#3A6B4D',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 500,
          padding: '3px 10px',
          display: 'inline-block',
          border: '1px solid rgba(94,143,110,0.20)',
        }}>
          {role}
        </span>
      ) : '-',
    },
    {
      title: '公司',
      dataIndex: 'company_name',
      key: 'company_name',
      width: 150,
      titleRender: () => <span style={headerCellStyle}>公司</span>,
    },
    {
      title: '城市',
      dataIndex: 'city',
      key: 'city',
      width: 100,
      titleRender: () => <span style={headerCellStyle}>城市</span>,
    },
    {
      title: '薪资范围',
      key: 'salary',
      width: 120,
      titleRender: () => <span style={headerCellStyle}>薪资范围</span>,
      render: (_: unknown, record: JobResponse) => {
        if (record.salary_min && record.salary_max) {
          return `${record.salary_min / 1000}k-${record.salary_max / 1000}k`;
        }
        return '-';
      },
    },
    {
      title: '技能',
      key: 'skills',
      width: 150,
      titleRender: () => <span style={headerCellStyle}>技能</span>,
      render: (_: unknown, record: JobResponse) => {
        if (record.skills && record.skills.length > 0) {
          const displaySkills = record.skills.slice(0, 3);
          return (
            <>
              {displaySkills.map((skill, index) => (
                <Tag key={index} style={{
                  background: 'rgba(94,143,110,0.10)',
                  color: '#3A6B4D',
                  border: '1px solid rgba(94,143,110,0.20)',
                  borderRadius: '6px',
                }}>{skill}</Tag>
              ))}
              {record.skills.length > 3 && <Tag style={{
                background: 'rgba(94,143,110,0.08)',
                color: '#5A7A60',
                border: '1px solid rgba(94,143,110,0.15)',
                borderRadius: '6px',
              }}>+{record.skills.length - 3}</Tag>}
            </>
          );
        }
        return '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      titleRender: () => <span style={headerCellStyle}>操作</span>,
      render: (_: unknown, record: JobResponse) => (
        <Space size={4}>
          <Button
            type="text"
            icon={<EyeOutlined style={{ color: '#6B7280' }} />}
            onClick={() => handleView(record)}
            style={{ color: '#6B7280' }}
          />
          <Button
            type="text"
            icon={<EditOutlined style={{ color: '#5E8F6E' }} />}
            onClick={() => handleEdit(record)}
            style={{ color: '#5E8F6E' }}
          />
          <Popconfirm
            title="确定删除这个岗位吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button
              type="text"
              icon={<DeleteOutlined style={{ color: '#E07B6A' }} />}
              danger
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const stats = getStats(pagination.total, jobs);

  return (
    <div data-module="jobs" className="ds-page">
      {/* 页面标题区 */}
      <div className="page-header-anim" style={{ marginBottom: 28 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(94,143,110,0.10)',
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            color: MODULE_COLOR,
            marginBottom: 10,
          }}
        >
          <Briefcase size={12} /> 岗位管理
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
          岗位管理
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '6px 0 0 0' }}>
          管理系统中的所有岗位数据
        </p>
      </div>

      {/* 顶部操作栏 */}
      <div className="toolbar-anim" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Space>
          <span style={{
            background: 'rgba(94,143,110,0.08)',
            borderRadius: '8px',
            padding: '6px 14px',
            fontSize: '13px',
            color: '#3A6B4D',
          }}>
            总数：<strong style={{ color: '#0A0A0A' }}>{pagination.total}</strong>
          </span>
          <span style={{
            background: 'rgba(94,143,110,0.08)',
            borderRadius: '8px',
            padding: '6px 14px',
            fontSize: '13px',
            color: '#3A6B4D',
          }}>
            已完善：<strong style={{ color: '#0A0A0A' }}>{stats.withSkills}</strong>
          </span>
          <span style={{
            background: 'rgba(224,123,106,0.08)',
            borderRadius: '8px',
            padding: '6px 14px',
            fontSize: '13px',
            color: '#8A4A3A',
          }}>
            待处理：<strong style={{ color: '#0A0A0A' }}>{stats.pending}</strong>
          </span>
        </Space>
        <Space>
          <Button icon={<UploadOutlined />} style={{ borderRadius: '10px' }}>批量导入</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            style={{
              background: '#5E8F6E',
              color: 'white',
              borderRadius: '10px',
              padding: '8px 20px',
              fontWeight: 600,
              border: 'none'
            }}
          >
            新建
          </Button>
        </Space>
      </div>

      {/* 搜索和筛选区域 */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <Input
          placeholder="搜索岗位名称或公司"
          prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
          allowClear
          value={keyword}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ width: 280, borderRadius: '10px', border: '1px solid var(--gray-200)' }}
        />
        <Select
          placeholder="选择 Role"
          allowClear
          style={{ width: 180 }}
          value={selectedRole}
          onChange={handleRoleChange}
        >
          {roles.map((role) => (
            <Select.Option key={role.id} value={role.name}>
              {role.name}
            </Select.Option>
          ))}
        </Select>
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <>
          <Table
            columns={columns}
            dataSource={jobs}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1000 }}
            style={{
              '--hover-bg': 'rgba(94,143,110,0.03)'
            } as React.CSSProperties}
            onRow={() => ({
              style: { background: 'transparent' },
              onMouseEnter: (e: React.MouseEvent) => {
                const row = e.currentTarget as HTMLElement;
                row.style.background = 'rgba(94,143,110,0.03)';
              },
              onMouseLeave: (e: React.MouseEvent) => {
                const row = e.currentTarget as HTMLElement;
                row.style.background = 'transparent';
              }
            })}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <Pagination
              current={pagination.page}
              pageSize={pagination.page_size}
              total={pagination.total}
              onChange={handlePageChange}
              showSizeChanger
              showQuickJumper
              showTotal={(total: number) => `共 ${total} 条`}
            />
          </div>
        </>
      )}

      {/* 编辑/添加 Modal */}
      <Modal
        title={<span style={{ fontSize: '16px', fontWeight: 700 }}>{editingJob ? '编辑岗位' : '添加岗位'}</span>}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        transitionName=""
        maskTransitionName=""
        width={600}
        styles={{ content: { borderRadius: '16px', animation: 'modalFlipIn 0.45s var(--spring-smooth) both', opacity: 0 }, header: { borderRadius: '16px 16px 0 0' } }}
        style={{ borderRadius: '16px' }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="岗位名称"
            rules={[{ required: true, message: '请输入岗位名称' }]}
          >
            <Input style={{ borderRadius: '8px' }} />
          </Form.Item>
          <Form.Item name="role" label="Role">
            <Input style={{ borderRadius: '8px' }} />
          </Form.Item>
          <Form.Item name="company_name" label="公司">
            <Input style={{ borderRadius: '8px' }} />
          </Form.Item>
          <Form.Item name="city" label="城市">
            <Input style={{ borderRadius: '8px' }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} style={{ borderRadius: '8px' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Modal */}
      <Modal
        title={<span style={{ fontSize: '16px', fontWeight: 700 }}>岗位详情</span>}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        transitionName=""
        maskTransitionName=""
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)} style={{ borderRadius: '8px' }}>
            关闭
          </Button>,
        ]}
        width={700}
        styles={{ content: { borderRadius: '16px', animation: 'modalFlipIn 0.45s var(--spring-smooth) both', opacity: 0 }, header: { borderRadius: '16px 16px 0 0' } }}
      >
        {viewingJob && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-500">岗位名称：</span>
                <span className="font-medium">{viewingJob.title}</span>
              </div>
              <div>
                <span className="text-gray-500">Role：</span>
                <Tag style={{
                  background: 'rgba(94,143,110,0.10)',
                  color: '#3A6B4D',
                  border: '1px solid rgba(94,143,110,0.20)',
                  borderRadius: '6px',
                }}>{viewingJob.role || '-'}</Tag>
              </div>
              <div>
                <span className="text-gray-500">公司：</span>
                <span className="font-medium">{viewingJob.company_name}</span>
              </div>
              <div>
                <span className="text-gray-500">城市：</span>
                <span>{viewingJob.city}</span>
              </div>
              <div>
                <span className="text-gray-500">薪资范围：</span>
                <span>
                  {viewingJob.salary_min && viewingJob.salary_max
                    ? `${viewingJob.salary_min / 1000}k - ${viewingJob.salary_max / 1000}k`
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">薪资月份：</span>
                <span>{viewingJob.salary_months} 个月</span>
              </div>
              <div>
                <span className="text-gray-500">学历要求：</span>
                <span>{viewingJob.education_req || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">经验要求：</span>
                <span>{viewingJob.experience_req || '-'}</span>
              </div>
            </div>

            {viewingJob.industries && viewingJob.industries.length > 0 && (
              <div>
                <span className="text-gray-500">行业：</span>
                {viewingJob.industries.map((industry, index) => (
                  <Tag key={index} style={{
                    background: 'rgba(203,138,74,0.10)',
                    color: '#7D4F1E',
                    border: '1px solid rgba(203,138,74,0.20)',
                    borderRadius: '6px',
                  }}>{industry}</Tag>
                ))}
              </div>
            )}

            {viewingJob.company_size && (
              <div>
                <span className="text-gray-500">公司规模：</span>
                <span>{viewingJob.company_size}</span>
              </div>
            )}

            {viewingJob.company_stage && (
              <div>
                <span className="text-gray-500">公司阶段：</span>
                <span>{viewingJob.company_stage}</span>
              </div>
            )}

            {viewingJob.description && (
              <div>
                <div className="text-gray-500 mb-1">职位描述：</div>
                <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                  {viewingJob.description}
                </div>
              </div>
            )}

            {viewingJob.skills && viewingJob.skills.length > 0 && (
              <div>
                <div className="text-gray-500 mb-1">技能要求：</div>
                <div className="flex flex-wrap gap-1">
                  {viewingJob.skills.map((skill, index) => (
                    <Tag key={index} style={{
                      background: 'rgba(94,143,110,0.10)',
                      color: '#3A6B4D',
                      border: '1px solid rgba(94,143,110,0.20)',
                      borderRadius: '6px',
                    }}>{skill}</Tag>
                  ))}
                </div>
              </div>
            )}

            {viewingJob.company_intro && (
              <div>
                <div className="text-gray-500 mb-1">公司介绍：</div>
                <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap">
                  {viewingJob.company_intro}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
