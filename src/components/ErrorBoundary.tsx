import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[400px] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 rounded-xl bg-red-500/[0.07] border border-red-500/15 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1.5">Something went wrong</h2>
            <p className="text-[13px] text-zinc-500 mb-1">An unexpected error occurred in this section.</p>
            <p className="text-[11px] text-zinc-600 font-mono bg-zinc-900/50 border border-zinc-800/30 rounded-md px-3 py-2 mb-5 overflow-x-auto">{this.state.error?.message}</p>
            <div className="flex items-center justify-center gap-2">
              <button onClick={this.handleRetry}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-all">
                <RefreshCw className="w-3.5 h-3.5" /> Try Again
              </button>
              <button onClick={this.handleHome}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-zinc-800/40 text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-all border border-zinc-700/30">
                <Home className="w-3.5 h-3.5" /> Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
