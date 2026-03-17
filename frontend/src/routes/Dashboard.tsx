import {
  TeamOutlined,
  UserOutlined,
  FileTextOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { LayoutDashboard, Briefcase, Users, FileText, TrendingUp } from 'lucide-react';

// 动画 keyframes
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
if (!document.head.querySelector('style[data-dashboard]')) {
  style.setAttribute('data-dashboard', 'true');
  document.head.appendChild(style);
}

// 模块专属色 - 珊瑚色系
const MODULE_COLOR = '#E07B6A';
const MODULE_BG = '#FFF2EF';

interface KPICardProps {
  icon: React.ReactNode;
  accent: string;
  bg: string;
  iconBg: string;
  label: string;
  value: number | string;
  suffix?: string;
  description: string;
  index: number;
}

function KPICard({ icon, accent, bg, iconBg, label, value, suffix, description, index }: KPICardProps) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.88)',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: 'default',
        animation: 'fadeInUp 0.4s ease forwards',
        animationDelay: `${index * 0.05}s`,
        opacity: 0,
        borderTop: `3px solid ${accent}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.07), 0 8px 32px rgba(0,0,0,0.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)';
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <span style={{ color: accent, fontSize: 18 }}>{icon}</span>
      </div>
      <div
        style={{
          fontSize: 40,
          fontWeight: 900,
          letterSpacing: '-1.5px',
          color: '#0A0A0A',
          lineHeight: 1,
        }}
      >
        {value}{suffix && <span style={{ fontSize: 20, fontWeight: 500, marginLeft: 4 }}>{suffix}</span>}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#9CA3AF',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginTop: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{description}</div>
    </div>
  );
}

interface ContentCardProps {
  title: string;
  children: React.ReactNode;
  index: number;
}

function ContentCard({ title, children, index }: ContentCardProps) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.88)',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: 'default',
        animation: 'fadeInUp 0.4s ease forwards',
        animationDelay: `${(index + 4) * 0.05}s`,
        opacity: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.07), 0 8px 32px rgba(0,0,0,0.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)';
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0A0A0A', marginBottom: 16 }}>{title}</h3>
      {children}
    </div>
  );
}

export default function Dashboard() {
  // KPI 配置 - 每个卡片不同专属色
  const kpiCards = [
    {
      title: '岗位数量',
      value: 0,
      icon: <Briefcase size={18} />,
      accent: '#5E8F6E',
      bg: '#EEF6F2',
      iconBg: 'rgba(94,143,110,0.12)',
      desc: '已入库岗位',
    },
    {
      title: '学生数量',
      value: 0,
      icon: <Users size={18} />,
      accent: '#C4758A',
      bg: '#FAECF0',
      iconBg: 'rgba(196,117,138,0.12)',
      desc: '已建档学生',
    },
    {
      title: '匹配报告',
      value: 0,
      icon: <FileText size={18} />,
      accent: '#5B6FD4',
      bg: '#ECEDFC',
      iconBg: 'rgba(91,111,212,0.12)',
      desc: '已生成报告',
    },
    {
      title: '平均匹配度',
      value: 0,
      suffix: '%',
      icon: <TrendingUp size={18} />,
      accent: '#CB8A4A',
      bg: '#FEF5E9',
      iconBg: 'rgba(203,138,74,0.12)',
      desc: '综合匹配得分',
    },
  ];

  return (
    <div data-module="dashboard" style={{ padding: '0 0 24px 0' }}>
      {/* 页面标题区 */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(224,123,106,0.10)',
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            color: MODULE_COLOR,
            marginBottom: 10,
          }}
        >
          <LayoutDashboard size={12} /> 总览
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
          职业规划系统
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '6px 0 0 0' }}>
          基于 AI 的大学生职业发展全链路平台
        </p>
      </div>

      {/* KPI Cards - 4 columns grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {kpiCards.map((card, idx) => (
          <KPICard
            key={card.title}
            icon={card.icon}
            accent={card.accent}
            bg={card.bg}
            iconBg={card.iconBg}
            label={card.title}
            value={card.value}
            suffix={card.suffix}
            description={card.desc}
            index={idx}
          />
        ))}
      </div>

      {/* Content Cards - 2 columns grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
        }}
      >
        <ContentCard title="最近活动" index={4}>
          <p style={{ color: '#9CA3AF', fontSize: 14 }}>暂无最近活动</p>
        </ContentCard>
        <ContentCard title="热门岗位" index={5}>
          <p style={{ color: '#9CA3AF', fontSize: 14 }}>暂无热门岗位数据</p>
        </ContentCard>
      </div>
    </div>
  );
}
