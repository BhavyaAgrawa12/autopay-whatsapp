import React, { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'bordered';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  ...props
}) => {
  const variants = {
    default: 'bg-slate-900 border border-slate-800 shadow-xl shadow-slate-950/50',
    glass: 'bg-slate-900/60 backdrop-blur-md border border-slate-800/80 shadow-xl',
    bordered: 'bg-slate-900/30 border border-slate-800 hover:border-slate-700 transition-colors',
  };

  return (
    <div
      className={`rounded-xl p-5 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
