import { Spin } from 'antd';

interface LoadingStateProps {
  tip?: string;
  fullScreen?: boolean;
}

export default function LoadingState({ tip = '加载中...', fullScreen = false }: LoadingStateProps) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
        <Spin size="large" tip={tip} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      <Spin size="large" tip={tip} />
    </div>
  );
}
