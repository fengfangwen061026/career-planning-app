import { useEffect, useState } from 'react';
import { LayoutDashboard, Briefcase, Users, FileText, TrendingUp } from 'lucide-react';

interface DashboardStats {
  job_count: number;
  student_count: number;
  report_count: number;
  avg_match_score: number;
}

interface StatCard {
  title: string;
  value: number | string;
  suffix?: string;
  description: string;
  accent: string;
  bg: string;
  icon: React.ReactNode;
}

const defaultStatCards: StatCard[] = [
  {
    title: '岗位数量',
    value: 0,
    description: '已入库岗位',
    accent: '#5E8F6E',
    bg: 'rgba(94,143,110,0.12)',
    icon: <Briefcase size={18} />,
  },
  {
    title: '学生数量',
    value: 0,
    description: '已建档学生',
    accent: '#C4758A',
    bg: 'rgba(196,117,138,0.12)',
    icon: <Users size={18} />,
  },
  {
    title: '匹配报告',
    value: 0,
    description: '已生成报告',
    accent: '#5B6FD4',
    bg: 'rgba(91,111,212,0.12)',
    icon: <FileText size={18} />,
  },
  {
    title: '平均匹配度',
    value: 0,
    suffix: '%',
    description: '综合匹配得分',
    accent: '#CB8A4A',
    bg: 'rgba(203,138,74,0.12)',
    icon: <TrendingUp size={18} />,
  },
];

function SummaryCard({ card, index }: { card: StatCard; index: number }) {
  return (
    <div
      className="card-bounce ds-card"
      style={{ '--ci': index } as React.CSSProperties}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: card.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          color: card.accent,
        }}
      >
        {card.icon}
      </div>
      <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-1.5px', color: '#0A0A0A', lineHeight: 1 }}>
        {card.value}
        {card.suffix ? <span style={{ fontSize: 20, fontWeight: 500, marginLeft: 4 }}>{card.suffix}</span> : null}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 8 }}>
        {card.title}
      </div>
      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{card.description}</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((res) => res.json())
      .then((data: DashboardStats) => setStats(data))
      .catch(console.error);
  }, []);

  const statCards: StatCard[] = [
    {
      title: '岗位数量',
      value: stats?.job_count ?? 0,
      description: '已入库岗位',
      accent: '#5E8F6E',
      bg: 'rgba(94,143,110,0.12)',
      icon: <Briefcase size={18} />,
    },
    {
      title: '学生数量',
      value: stats?.student_count ?? 0,
      description: '已建档学生',
      accent: '#C4758A',
      bg: 'rgba(196,117,138,0.12)',
      icon: <Users size={18} />,
    },
    {
      title: '匹配报告',
      value: stats?.report_count ?? 0,
      description: '已生成报告',
      accent: '#5B6FD4',
      bg: 'rgba(91,111,212,0.12)',
      icon: <FileText size={18} />,
    },
    {
      title: '平均匹配度',
      value: stats?.avg_match_score ?? 0,
      suffix: '%',
      description: '综合匹配得分',
      accent: '#CB8A4A',
      bg: 'rgba(203,138,74,0.12)',
      icon: <TrendingUp size={18} />,
    },
  ];

  return (
    <div data-module="dashboard" className="ds-page">
      <div className="page-header-anim" style={{ marginBottom: 28 }}>
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
            color: '#E07B6A',
            marginBottom: 10,
          }}
        >
          <LayoutDashboard size={12} /> 总览
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.8px', margin: 0 }}>
          职业规划系统
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '6px 0 0 0' }}>
          基于 AI 的大学生职业发展全链路平台
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 24 }}>
        {statCards.map((card, index) => (
          <SummaryCard key={card.title} card={card} index={index} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <div className="card-bounce ds-card" style={{ '--ci': 4 } as React.CSSProperties}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0A0A0A', margin: '0 0 16px 0' }}>最近活动</h3>
          <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0 }}>暂无最近活动</p>
        </div>
        <div className="card-bounce ds-card" style={{ '--ci': 5 } as React.CSSProperties}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0A0A0A', margin: '0 0 16px 0' }}>热门岗位</h3>
          <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0 }}>暂无热门岗位数据</p>
        </div>
      </div>
    </div>
  );
}
