import React from 'react';

type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', style = {}, ...rest }) => (
  <div
    className={`glass-card ${className}`}
    style={{
      background: 'rgba(255,255,255,0.82)',
      backdropFilter: 'blur(12px)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)',
      padding: '20px',
      ...style,
    }}
    {...rest}
  >
    {children}
  </div>
);
