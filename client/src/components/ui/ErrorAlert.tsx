import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorAlertProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
}) => {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 my-4 shadow-lg shadow-rose-950/20">
      <div className="p-2 rounded-lg bg-rose-900/50 text-rose-400 shrink-0">
        <AlertCircle className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-rose-100 mb-1">{title}</h4>
        <p className="text-xs text-rose-300/90 leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="text-rose-300 hover:text-rose-100 hover:bg-rose-900/40 shrink-0"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Retry
        </Button>
      )}
    </div>
  );
};
