interface LoadingStateProps {
  tip?: string;
  fullScreen?: boolean;
  lines?: Array<{ width: string; height?: number; marginBottom?: number }>;
}

const defaultLines = [
  { width: '60%', height: 24, marginBottom: 12 },
  { width: '90%', height: 16, marginBottom: 8 },
  { width: '75%', height: 16, marginBottom: 8 },
  { width: '80%', height: 16, marginBottom: 0 },
];

export default function LoadingState({
  tip = '加载中...',
  fullScreen = false,
  lines = defaultLines,
}: LoadingStateProps) {
  const skeleton = (
    <div style={{ animation: 'floatUp 0.3s var(--spring-smooth) forwards', width: '100%', maxWidth: 560 }}>
      {tip ? (
        <div style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 16 }}>
          {tip}
        </div>
      ) : null}
      {lines.map((line, index) => (
        <div
          key={`${line.width}-${index}`}
          className="skeleton-line"
          style={{
            height: line.height ?? 16,
            width: line.width,
            marginBottom: line.marginBottom ?? 8,
          }}
        />
      ))}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/75 px-6">
        {skeleton}
      </div>
    );
  }

  return (
    <div className="flex justify-center py-12">
      {skeleton}
    </div>
  );
}
