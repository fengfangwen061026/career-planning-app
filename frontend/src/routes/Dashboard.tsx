import { Card, Row, Col, Statistic } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  FileTextOutlined,
  RiseOutlined,
} from '@ant-design/icons';

export default function Dashboard() {
  // TODO: Fetch dashboard statistics from API

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">仪表盘</h1>

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="岗位数量"
              value={0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="学生数量"
              value={0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="匹配报告"
              value={0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均匹配度"
              value={0}
              suffix="%"
              prefix={<RiseOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} className="mt-6">
        <Col span={12}>
          <Card title="最近活动" className="h-full">
            {/* TODO: Recent activities list */}
            <p className="text-gray-400">暂无最近活动</p>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="热门岗位" className="h-full">
            {/* TODO: Popular jobs list */}
            <p className="text-gray-400">暂无热门岗位数据</p>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
