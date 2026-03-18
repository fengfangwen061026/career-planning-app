import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Input,
  Empty,
  Button,
  Tag,
  Modal,
  Form,
  message,
  Select,
} from 'antd';
import { ArrowRight, BookOpen } from 'lucide-react';
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
  Cell,
} from 'recharts';
import { jobsApi } from '../api/jobs';
import type { RoleResponse, JobProfileResponse } from '../types/job';
import LoadingState from '../components/LoadingState';
import JobProfileDetail from './JobProfileDetail';

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

// Role Glass Card - click to open detail modal
const RoleCard = ({
  role,
  onCardClick,
}: {
  role: RoleWithProfile;
  onCardClick: () => void;
}) => {
  return (
    <div
      className="pressable role-card-body"
      onClick={onCardClick}
      style={{
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(10px)',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.5)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
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
          <span className="role-card-arrow">
            <ArrowRight size={18} style={{ color: '#9CA3AF' }} />
          </span>
        </div>
      </div>
    </div>
  );
};

export default function JobProfiles() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<RoleWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState(searchParams.get('keyword') || '');
  const [detailModalRoleId, setDetailModalRoleId] = useState<string | null>(null);
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const flipOriginRef = useRef<{ ox: string; oy: string } | null>(null);
  const [modalAnimKey, setModalAnimKey] = useState(0);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState<JobProfileResponse | null>(null);
  const [editForm] = Form.useForm();
  const [batchGenerating, setBatchGenerating] = useState(false);

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

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const items = Array.from(
              document.querySelectorAll('.reveal-item')
            );
            const idx = items.indexOf(entry.target as Element);
            (entry.target as HTMLElement).style.transitionDelay = `${idx * 40}ms`;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
    );

    const bindObserver = () => {
      document.querySelectorAll('.reveal-item').forEach((el) => {
        observer.observe(el);
      });
    };

    const mutationObs = new MutationObserver(() => {
      bindObserver();
    });
    const container = document.querySelector('[data-module="profiles"]');
    if (container) {
      mutationObs.observe(container, { childList: true, subtree: true });
    }
    bindObserver();

    return () => {
      observer.disconnect();
      mutationObs.disconnect();
    };
  }, [roles]);

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

  const handleCardClick = (role: RoleWithProfile) => {
    // 计算 FLIP 起点：卡片中心相对于 Modal content 的偏移
    const cardEl = cardRefsMap.current.get(role.id);
    if (cardEl) {
      const cardRect = cardEl.getBoundingClientRect();
      const cardCX = cardRect.left + cardRect.width / 2;
      const cardCY = cardRect.top + cardRect.height / 2;

      // Modal 尺寸（与 Modal width="90vw" maxWidth=1400 对应）
      const modalW = Math.min(window.innerWidth * 0.9, 1400);
      const modalLeft = (window.innerWidth - modalW) / 2;
      const modalTop = 20 + 55; // top:20 + Ant Design header ~55px

      // 起点 (px 相对于 Modal content 左上角)
      const ox = Math.round(cardCX - modalLeft);
      const oy = Math.round(cardCY - modalTop);

      flipOriginRef.current = { ox: `${ox}px`, oy: `${oy}px` };
    } else {
      flipOriginRef.current = null;
    }

    setModalAnimKey(prev => prev + 1);  // 每次点击刷新动画
    setDetailModalRoleId(role.id);
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
    } catch (error) {
      message.error('保存失败');
    }
  };

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(searchText.toLowerCase()) ||
    role.category.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div data-module="profiles" className="p-6">
      {/* Page Title Area */}
      <div className="mb-8 page-header-anim">
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
      <div className="flex items-center gap-4 mb-6 toolbar-anim">
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
              setDetailModalRoleId(value);
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}>
          {filteredRoles.length === 0 ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <Empty description="暂无角色数据" />
            </div>
          ) : (
            filteredRoles.map((role) => (
              <div
                key={role.id}
                className="reveal-item"
                ref={(el) => {
                  if (el) cardRefsMap.current.set(role.id, el);
                  else cardRefsMap.current.delete(role.id);
                }}
              >
                <RoleCard role={role} onCardClick={() => handleCardClick(role)} />
              </div>
            ))
          )}
        </div>
      )}

      {/* 岗位画像详情 Modal */}
      <Modal
        open={!!detailModalRoleId}
        onCancel={() => setDetailModalRoleId(null)}
        footer={null}
        width="90vw"
        style={{ top: 20, maxWidth: 1400 }}
        transitionName="" /* 禁用 Ant Design 默认动画 */
        maskTransitionName="" /* 禁用遮罩默认动画 */
        styles={{
          mask: {
            animation: 'none',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            background: 'rgba(0,0,0,0.35)',
            transition: 'opacity 0.3s ease',
          },
          body: {
            padding: 0,
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: 16,
            background: 'linear-gradient(150deg, #FAF8FF 0%, #FFF0F5 25%, #FFFBF0 50%, #F0FBF5 75%, #F0F5FF 100%)',
          },
          content: {
            borderRadius: 16,
            overflow: 'hidden',
            padding: 0,
            '--flip-ox': flipOriginRef.current?.ox ?? '50%',
            '--flip-oy': flipOriginRef.current?.oy ?? '50%',
            animation: `modalFlipIn 0.5s var(--spring-smooth) forwards`,
          } as React.CSSProperties,
        }}
        destroyOnClose
        key={`modal-${modalAnimKey}`}
      >
        {detailModalRoleId && (
          <JobProfileDetail
            embeddedRoleId={detailModalRoleId}
            onClose={() => setDetailModalRoleId(null)}
          />
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
