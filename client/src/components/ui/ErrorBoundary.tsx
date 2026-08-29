import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught component error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-slate-200 space-y-4 my-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
            <h2 className="text-lg font-bold text-white">Something went wrong loading this view</h2>
          </div>
          <p className="text-sm text-slate-300">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            leftIcon={<RefreshCw className="w-4 h-4 text-rose-400" />}
          >
            Reload Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
