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
import { ADMIN_AUTH_KEY } from '../routes/Login';

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

  // 找最精确匹配的菜单项（key 最长的那个）
  const activeKey = menuItems
    .filter(item =>
      item.key === '/'
        ? location.pathname === '/'
        : location.pathname === item.key || location.pathname.startsWith(item.key + '/')
    )
    .sort((a, b) => b.key.length - a.key.length)[0]?.key ?? '';

  const getCurrentAccentColor = () => {
    const item = menuItems.find(m => m.key === activeKey);
    return item?.accentColor || '#5B6FD4';
  };

  const currentAccent = getCurrentAccentColor();

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_AUTH_KEY);
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar - 浅色主题 */}
      <div
        style={{
          width: collapsed ? 64 : 220,
          minHeight: '100vh',
          background: '#FFFFFF',
          borderRight: '1px solid #E5E7EB',
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
            borderBottom: '1px solid #E5E7EB',
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
                color: '#111827',
                letterSpacing: '-0.4px',
                whiteSpace: 'nowrap',
              }}
            >
              智引鸿图
            </span>
          )}
        </div>

        {/* 菜单区 */}
        <div style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {menuItems.map((item) => {
            const isActive = item.key === activeKey;
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
                  background: isActive ? `${item.accentColor}14` : 'transparent',
                  color: isActive ? item.accentColor : '#6B7280',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 13,
                  transition: 'all 0.15s ease',
                  borderLeft: isActive ? `3px solid ${item.accentColor}` : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#F3F4F6';
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
            borderTop: '1px solid #E5E7EB',
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
              color: '#9CA3AF',
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
            {menuItems.find(m => m.key === activeKey)?.label || '智引鸿图管理台'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
              A
            </div>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                padding: '7px 12px',
                background: '#FFFFFF',
                color: '#6B7280',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              退出登录
            </button>
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
