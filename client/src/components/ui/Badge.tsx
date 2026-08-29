import React, { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  ...props
}) => {
  const variants = {
    success: 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50',
    warning: 'bg-amber-950/80 text-amber-400 border border-amber-800/50',
    error: 'bg-rose-950/80 text-rose-400 border border-rose-800/50',
    info: 'bg-sky-950/80 text-sky-400 border border-sky-800/50',
    neutral: 'bg-slate-800 text-slate-300 border border-slate-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs font-medium',
    md: 'px-2.5 py-1 text-xs font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
