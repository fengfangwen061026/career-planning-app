import { Progress, Tag, Empty } from 'antd';

interface SkillGap {
  skill: string;
  current_level?: number;
  required_level?: number;
  gap?: number;
  suggestions?: string[];
}

interface SkillGapListProps {
  gaps: SkillGap[];
  loading?: boolean;
}

export default function SkillGapList({ gaps, loading }: SkillGapListProps) {
  if (!gaps || gaps.length === 0) {
    return <Empty description="暂无技能差距数据" />;
  }

  return (
    <div className="space-y-4">
      {gaps.map((gap, index) => (
        <div key={index} className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">{gap.skill}</span>
            {gap.gap !== undefined && (
              <Tag color={gap.gap > 0 ? 'red' : 'green'}>
                差距: {gap.gap > 0 ? `+${gap.gap}` : gap.gap}
              </Tag>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">当前: {gap.current_level || 0}</span>
            <Progress
              percent={gap.current_level || 0}
              strokeColor="#1890ff"
              size="small"
              style={{ flex: 1 }}
            />
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm text-gray-500">要求: {gap.required_level || 0}</span>
            <Progress
              percent={gap.required_level || 0}
              strokeColor="#52c41a"
              size="small"
              style={{ flex: 1 }}
            />
          </div>
          {gap.suggestions && gap.suggestions.length > 0 && (
            <div className="mt-2">
              <span className="text-sm text-gray-500">建议: </span>
              {gap.suggestions.map((suggestion, i) => (
                <Tag key={i} className="mt-1">{suggestion}</Tag>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
