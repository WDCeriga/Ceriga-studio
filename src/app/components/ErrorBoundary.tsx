import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Top-level error boundary: a render crash anywhere in the app shows a
 * recoverable screen instead of a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for diagnostics tools; replace with Sentry/monitoring capture later.
    console.error('Unhandled app error:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className="flex min-h-dvh items-center justify-center bg-[#09090B] px-5 text-white"
      >
        <div className="w-full max-w-md rounded-2xl border border-[#252528] bg-white/5 p-6 text-center">
          <div className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">
            Something went wrong
          </div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold text-white">
            We hit an unexpected error
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Your work is saved on our servers. Reload the page to continue — if this keeps
            happening, contact support.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg border border-[#252528] bg-black/30 p-3 text-left text-[11px] text-white/45">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 h-10 w-full rounded-lg bg-[#CC2D24] text-sm font-semibold text-white transition-colors hover:bg-[#CC2D24]/90"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
