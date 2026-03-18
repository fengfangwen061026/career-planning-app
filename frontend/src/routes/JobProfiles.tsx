import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Empty, Modal, Select, message } from 'antd';
import { ReloadOutlined, SearchOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { ArrowRight, BookOpen } from 'lucide-react';
import client from '../api/client';
import { jobsApi } from '../api/jobs';
import LoadingState from '../components/LoadingState';
import JobProfileDetail from './JobProfileDetail';
import type { RoleResponse } from '../types/job';

interface RoleWithProfile extends RoleResponse {
  loading?: boolean;
}

function RoleCard({
  role,
  onCardClick,
}: {
  role: RoleWithProfile;
  onCardClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
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
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1F2937' }}>{role.name}</span>
          <span
            style={{
              background: 'rgba(124,109,200,0.10)',
              color: '#5A4FA8',
              border: '1px solid rgba(124,109,200,0.20)',
              borderRadius: 6,
              padding: '2px 10px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {role.category}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              background: 'rgba(124,109,200,0.10)',
              color: '#5A4FA8',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 700,
              border: '1px solid rgba(124,109,200,0.20)',
            }}
          >
            {role.job_count} 个岗位
          </span>
          <span className="role-card-arrow">
            <ArrowRight size={18} style={{ color: '#9CA3AF' }} />
          </span>
        </div>
      </div>
    </div>
  );
}

export default function JobProfiles() {
  const [searchParams] = useSearchParams();
  const [roles, setRoles] = useState<RoleWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [searchText, setSearchText] = useState(searchParams.get('keyword') || '');
  const [detailModalRoleId, setDetailModalRoleId] = useState<string | null>(null);
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const flipOriginRef = useRef<{ ox: string; oy: string } | null>(null);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await jobsApi.getRoles(true);
      setRoles(response.data);
    } catch {
      message.error('获取角色列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRoles();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const allItems = Array.from(document.querySelectorAll('.reveal-item'));
            const idx = allItems.indexOf(entry.target as HTMLElement);
            (entry.target as HTMLElement).style.transitionDelay = `${idx * 40}ms`;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -20px 0px' },
    );

    cardRefsMap.current.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [roles, searchText]);

  const filteredRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          role.name.toLowerCase().includes(searchText.toLowerCase()) ||
          role.category.toLowerCase().includes(searchText.toLowerCase()),
      ),
    [roles, searchText],
  );

  const handleBatchGenerate = async () => {
    setBatchGenerating(true);
    try {
      const response = await client.post<{ succeeded: number }>('/job-profiles/generate-all');
      message.success(`批量生成完成，成功生成 ${response.data.succeeded} 个画像`);
      await fetchRoles();
    } catch {
      message.error('批量生成失败');
    } finally {
      setBatchGenerating(false);
    }
  };

  const handleCardClick = (event: React.MouseEvent<HTMLDivElement>, role: RoleWithProfile) => {
    const cardRect = event.currentTarget.getBoundingClientRect();
    const cardCX = cardRect.left + cardRect.width / 2;
    const cardCY = cardRect.top + cardRect.height / 2;
    const modalW = Math.min(window.innerWidth * 0.9, 1400);
    const modalLeft = (window.innerWidth - modalW) / 2;
    const modalTop = 20 + 55;

    flipOriginRef.current = {
      ox: `${Math.round(cardCX - modalLeft)}px`,
      oy: `${Math.round(cardCY - modalTop)}px`,
    };
    setDetailModalRoleId(role.id);
  };

  return (
    <div data-module="profiles" className="p-6">
      <div className="page-header-anim" style={{ marginBottom: 32 }}>
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
            color: '#7C6DC8',
            marginBottom: 10,
          }}
        >
          <BookOpen size={12} /> 岗位画像库
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.8px', color: '#0A0A0A', margin: 0 }}>
          岗位画像库
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '6px 0 0 0' }}>
          基于智联招聘 JD 数据生成的岗位画像
        </p>
      </div>

      <div className="toolbar-anim" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: '#fff',
            borderRadius: 8,
            border: '1px solid #E5E7EB',
            width: 280,
          }}
        >
          <SearchOutlined style={{ color: '#9CA3AF', fontSize: 14 }} />
          <input
            type="text"
            placeholder="搜索角色名称..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
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

        <Select
          placeholder="快速查看角色"
          style={{ width: 180 }}
          allowClear
          onChange={(value) => setDetailModalRoleId(value ?? null)}
          options={roles.map((role) => ({ label: role.name, value: role.id }))}
        />

        <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleBatchGenerate} loading={batchGenerating}>
          生成画像
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => void fetchRoles()}>
          刷新
        </Button>
      </div>

      {loading ? (
        <LoadingState
          tip="正在整理岗位画像..."
          lines={[
            { width: '40%', height: 24, marginBottom: 20 },
            { width: '100%', height: 96, marginBottom: 16 },
            { width: '100%', height: 96, marginBottom: 16 },
            { width: '100%', height: 96, marginBottom: 0 },
          ]}
        />
      ) : filteredRoles.length === 0 ? (
        <div style={{ animation: 'floatUp 0.35s var(--spring-smooth) forwards' }}>
          <Empty description="暂无角色数据" />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {filteredRoles.map((role) => (
            <div
              key={role.id}
              className="reveal-item"
              ref={(el) => {
                if (el) {
                  cardRefsMap.current.set(role.id, el);
                } else {
                  cardRefsMap.current.delete(role.id);
                }
              }}
            >
              <RoleCard role={role} onCardClick={(event) => handleCardClick(event, role)} />
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!detailModalRoleId}
        onCancel={() => setDetailModalRoleId(null)}
        footer={null}
        width="90vw"
        style={{ top: 20, maxWidth: 1400 }}
        transitionName=""
        maskTransitionName=""
        destroyOnClose
        styles={{
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
            animation: 'modalFlipIn 0.5s var(--spring-smooth) both',
            opacity: 0,
          } as React.CSSProperties,
        }}
      >
        {detailModalRoleId ? (
          <JobProfileDetail embeddedRoleId={detailModalRoleId} onClose={() => setDetailModalRoleId(null)} />
        ) : null}
      </Modal>
    </div>
  );
}
