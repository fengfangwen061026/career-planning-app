import { useState, useEffect } from 'react';
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
  Progress,
  Space,
  Select,
  Divider,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  TagsOutlined,
  TrophyOutlined,
  SafetyOutlined,
  BookOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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
  const [roles, setRoles] = useState<RoleWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleWithProfile | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState<JobProfileResponse | null>(null);
  const [editForm] = Form.useForm();

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

  // 渲染画像维度详情
  const renderProfileDetails = () => {
    if (!profileData) {
      return <Empty description="暂无画像数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    const chartColors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2'];

    return (
      <div className="space-y-6">
        {/* 关键技能 */}
        {profileData.skills && profileData.skills.length > 0 && (
          <div>
            <h4 className="text-base font-medium mb-3 flex items-center gap-2">
              <TagsOutlined className="text-blue-500" />
              关键技能
            </h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {profileData.skills.map((skill, index) => (
                <Tag key={index} color="blue" className="text-sm px-3 py-1">
                  {skill.name}
                </Tag>
              ))}
            </div>
            {profileData.skills.length > 0 && (
              <div className="h-48 bg-gray-50 rounded-lg p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={profileData.skills.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                  >
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={60}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value}`, '权重']}
                      contentStyle={{ borderRadius: 8 }}
                    />
                    <Bar dataKey="weight" radius={[0, 4, 4, 0]}>
                      {profileData.skills.slice(0, 8).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* 核心素养 */}
        {profileData.competencies && profileData.competencies.length > 0 && (
          <div>
            <h4 className="text-base font-medium mb-3 flex items-center gap-2">
              <TrophyOutlined className="text-orange-500" />
              核心素养
            </h4>
            <div className="flex flex-wrap gap-2">
              {profileData.competencies.map((comp, index) => (
                <Tag key={index} color="orange" className="text-sm px-3 py-1">
                  {comp}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {/* 证书资质 */}
        {profileData.certificates && profileData.certificates.length > 0 && (
          <div>
            <h4 className="text-base font-medium mb-3 flex items-center gap-2">
              <SafetyOutlined className="text-green-500" />
              证书资质
            </h4>
            <div className="flex flex-wrap gap-2">
              {profileData.certificates.map((cert, index) => (
                <Tag key={index} color="green" className="text-sm px-3 py-1">
                  {cert}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {/* 工具掌握 */}
        {profileData.tools && profileData.tools.length > 0 && (
          <div>
            <h4 className="text-base font-medium mb-3 flex items-center gap-2">
              <BookOutlined className="text-purple-500" />
              工具掌握
            </h4>
            <div className="flex flex-wrap gap-2">
              {profileData.tools.map((tool, index) => (
                <Tag key={index} color="purple" className="text-sm px-3 py-1">
                  {tool}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {/* 关键词权重 */}
        {profileData.keywords && profileData.keywords.length > 0 && (
          <div>
            <h4 className="text-base font-medium mb-3 flex items-center gap-2">
              <BarChartOutlined className="text-cyan-500" />
              关键词权重
            </h4>
            <div className="space-y-2">
              {profileData.keywords.slice(0, 10).map((kw, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-20 truncate">{kw.word}</span>
                  <Progress
                    percent={kw.weight}
                    size="small"
                    showInfo={false}
                    strokeColor="#1890ff"
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-400 w-10 text-right">{kw.weight}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 证据来源 */}
        {currentProfile?.evidence_json && (
          <Collapse ghost>
            <Panel header="证据来源" key="evidence">
              <pre className="text-xs text-gray-500 overflow-auto max-h-64 bg-gray-50 p-3 rounded">
                {JSON.stringify(currentProfile.evidence_json, null, 2)}
              </pre>
            </Panel>
          </Collapse>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">岗位画像库</h1>
        <Button icon={<ReloadOutlined />} onClick={fetchRoles}>
          刷新
        </Button>
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
          <div className="flex items-center justify-between">
            <span>
              {selectedRole?.name} - 岗位画像
              {currentProfile && (
                <Tag color="blue" className="ml-2">v{currentProfile.version}</Tag>
              )}
            </span>
            {currentProfile && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(currentProfile);
                }}
              >
                编辑
              </Button>
            )}
          </div>
        }
        open={!!selectedRole && !detailLoading}
        onCancel={() => setSelectedRole(null)}
        width={800}
        footer={null}
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
