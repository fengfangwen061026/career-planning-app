import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Popconfirm, Select, Tag, Pagination } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, EyeOutlined } from '@ant-design/icons';
import { jobsApi } from '../api/jobs';
import type { JobResponse, JobCreate, JobUpdate, RoleResponse, PaginatedJobResponse } from '../types/job';
import LoadingState from '../components/LoadingState';

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

  const columns = [
    {
      title: '岗位名称',
      dataIndex: 'title',
      key: 'title',
      width: 180,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => role ? <Tag color="blue">{role}</Tag> : '-',
    },
    {
      title: '公司',
      dataIndex: 'company_name',
      key: 'company_name',
      width: 150,
    },
    {
      title: '城市',
      dataIndex: 'city',
      key: 'city',
      width: 100,
    },
    {
      title: '薪资范围',
      key: 'salary',
      width: 120,
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
      render: (_: unknown, record: JobResponse) => {
        if (record.skills && record.skills.length > 0) {
          const displaySkills = record.skills.slice(0, 3);
          return (
            <>
              {displaySkills.map((skill, index) => (
                <Tag key={index} color="green">{skill}</Tag>
              ))}
              {record.skills.length > 3 && <Tag>+{record.skills.length - 3}</Tag>}
            </>
          );
        }
        return '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: JobResponse) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个岗位吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">岗位管理</h1>
        <Space>
          <Button icon={<UploadOutlined />}>批量导入</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加岗位
          </Button>
        </Space>
      </div>

      {/* 搜索和筛选区域 */}
      <div className="flex gap-4 mb-4">
        <Input.Search
          placeholder="搜索岗位名称或公司"
          allowClear
          onSearch={handleSearch}
          style={{ width: 300 }}
        />
        <Select
          placeholder="选择 Role"
          allowClear
          style={{ width: 200 }}
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
          />
          <div className="flex justify-end mt-4">
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
        title={editingJob ? '编辑岗位' : '添加岗位'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="岗位名称"
            rules={[{ required: true, message: '请输入岗位名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Role">
            <Input />
          </Form.Item>
          <Form.Item name="company_name" label="公司">
            <Input />
          </Form.Item>
          <Form.Item name="city" label="城市">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Modal */}
      <Modal
        title="岗位详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
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
                <Tag color="blue">{viewingJob.role || '-'}</Tag>
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
                  <Tag key={index} color="orange">{industry}</Tag>
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
                    <Tag key={index} color="green">{skill}</Tag>
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
