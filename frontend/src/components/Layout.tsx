import { useState } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  BookOpen,
  Network,
  Upload,
  User,
  BarChart2,
  FileText,
  LucideIcon,
} from 'lucide-react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

interface MenuItem {
  key: string;
  icon: LucideIcon;
  label: string;
  accentColor: string;
}

const menuItems: MenuItem[] = [
  { key: '/', icon: LayoutDashboard, label: '仪表盘', accentColor: '#E07B6A' },
  { key: '/jobs', icon: Briefcase, label: '岗位管理', accentColor: '#5E8F6E' },
  { key: '/jobs/profiles', icon: BookOpen, label: '岗位画像库', accentColor: '#7C6DC8' },
  { key: '/jobs/graph', icon: Network, label: '岗位图谱', accentColor: '#4B9AB3' },
  { key: '/resume', icon: Upload, label: '简历上传', accentColor: '#CB8A4A' },
  { key: '/students', icon: User, label: '学生画像', accentColor: '#C4758A' },
  { key: '/matching', icon: BarChart2, label: '匹配推荐', accentColor: '#5B6FD4' },
  { key: '/reports', icon: FileText, label: '报告导出', accentColor: '#5E8A7C' },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const getCurrentAccentColor = () => {
    const item = menuItems.find(
      (m) => location.pathname === m.key || (m.key !== '/' && location.pathname.startsWith(m.key))
    );
    return item?.accentColor || '#5B6FD4';
  };

  const currentAccent = getCurrentAccentColor();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar - 深色主题 */}
      <div
        style={{
          width: collapsed ? 64 : 220,
          minHeight: '100vh',
          background: '#1A1A2E',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease',
          flexShrink: 0,
        }}
      >
        {/* Logo 区 */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            padding: collapsed ? '0 20px' : '0 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            style={{
              width: 3,
              height: 18,
              borderRadius: 2,
              background: 'linear-gradient(180deg, #E07B6A, #7C6DC8)',
              marginRight: collapsed ? 0 : 10,
              flexShrink: 0,
            }}
          />
          {!collapsed && (
            <span
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-0.4px',
                whiteSpace: 'nowrap',
              }}
            >
              职业规划
            </span>
          )}
        </div>

        {/* 菜单区 */}
        <div style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {menuItems.map((item) => {
            const isActive =
              location.pathname === item.key ||
              (item.key !== '/' && location.pathname.startsWith(item.key));
            const IconComponent = item.icon;
            return (
              <div
                key={item.key}
                onClick={() => navigate(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 10,
                  marginBottom: 2,
                  cursor: 'pointer',
                  background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.52)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 13,
                  transition: 'all 0.15s ease',
                  borderLeft: isActive ? `3px solid ${item.accentColor}` : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                <IconComponent size={16} />
                {!collapsed && <span>{item.label}</span>}
              </div>
            );
          })}
        </div>

        {/* 折叠按钮 */}
        <div
          style={{
            padding: '12px 8px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-end',
              padding: '8px 12px',
              borderRadius: 10,
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.40)',
              fontSize: 12,
              transition: 'all 0.15s ease',
            }}
          >
            {collapsed ? '→' : '← 收起'}
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(229,231,235,0.7)',
            flexShrink: 0,
          }}
        >
          {/* 左：当前模块名称 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              color: currentAccent,
              background: `${currentAccent}15`,
            }}
          >
            {menuItems.find(
              (m) =>
                location.pathname === m.key ||
                (m.key !== '/' && location.pathname.startsWith(m.key))
            )?.label || '职业规划系统'}
          </div>

          {/* 右：头像 */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${currentAccent}, #7C6DC8)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            U
          </div>
        </div>

        {/* 页面内容 */}
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px 40px',
            background: 'transparent',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
