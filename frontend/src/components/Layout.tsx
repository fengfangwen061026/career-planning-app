import { useState } from 'react';
import { Layout as AntLayout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  UploadOutlined,
  UserOutlined,
  FileTextOutlined,
  BarChartOutlined,
  TeamOutlined,
  SettingOutlined,
  SolutionOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const { Header, Sider, Content } = AntLayout;

const menuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: '仪表盘',
  },
  {
    key: '/jobs',
    icon: <TeamOutlined />,
    label: '岗位管理',
  },
  {
    key: '/jobs/profiles',
    icon: <SolutionOutlined />,
    label: '岗位画像库',
  },
  {
    key: '/jobs/graph',
    icon: <LinkOutlined />,
    label: '岗位图谱',
  },
  {
    key: '/resume',
    icon: <UploadOutlined />,
    label: '简历上传',
  },
  {
    key: '/students',
    icon: <UserOutlined />,
    label: '学生画像',
  },
  {
    key: '/matching',
    icon: <BarChartOutlined />,
    label: '匹配推荐',
  },
  {
    key: '/reports',
    icon: <FileTextOutlined />,
    label: '报告导出',
  },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        theme="dark"
      >
        <div className="h-16 flex items-center justify-center text-white text-lg font-bold">
          {collapsed ? '职' : '职业规划系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <SettingOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
        </Header>
        <Content style={{ margin: 16, padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG, minHeight: 280 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
