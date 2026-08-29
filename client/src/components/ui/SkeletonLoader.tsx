import React from 'react';

interface SkeletonProps {
  className?: string;
  count?: number;
  type?: 'card' | 'table-row' | 'grid' | 'line';
}

export const SkeletonLoader: React.FC<SkeletonProps> = ({
  className = '',
  count = 3,
  type = 'card',
}) => {
  if (type === 'line') {
    return (
      <div className={`animate-pulse bg-slate-800/80 rounded-md ${className || 'h-4 w-full'}`} />
    );
  }

  if (type === 'table-row') {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <tr key={i} className="animate-pulse border-b border-slate-800/60">
            <td className="p-4">
              <div className="h-4 bg-slate-800/80 rounded w-28 mb-1" />
              <div className="h-3 bg-slate-800/50 rounded w-16" />
            </td>
            <td className="p-4">
              <div className="h-4 bg-slate-800/80 rounded w-32 font-mono" />
            </td>
            <td className="p-4">
              <div className="h-6 bg-slate-800/80 rounded-full w-20" />
            </td>
            <td className="p-4">
              <div className="h-4 bg-slate-800/60 rounded w-24" />
            </td>
            <td className="p-4">
              <div className="h-4 bg-slate-800/60 rounded w-20" />
            </td>
            <td className="p-4">
              <div className="h-4 bg-slate-800/60 rounded w-20" />
            </td>
          </tr>
        ))}
      </>
    );
  }

  if (type === 'grid' || type === 'card') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-3 shadow-lg"
          >
            <div className="h-36 bg-slate-800/70 rounded-xl w-full" />
            <div className="space-y-2 pt-1">
              <div className="h-4 bg-slate-800/90 rounded w-3/4" />
              <div className="flex justify-between items-center pt-1">
                <div className="h-3 bg-slate-800/60 rounded w-1/4" />
                <div className="h-3 bg-slate-800/60 rounded w-1/4" />
              </div>
            </div>
            <div className="pt-3 border-t border-slate-800/60 flex justify-between items-center">
              <div className="h-7 bg-slate-800/80 rounded-lg w-20" />
              <div className="flex gap-2">
                <div className="h-7 bg-slate-800/60 rounded-md w-8" />
                <div className="h-7 bg-slate-800/60 rounded-md w-8" />
                <div className="h-7 bg-slate-800/60 rounded-md w-8" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
};
