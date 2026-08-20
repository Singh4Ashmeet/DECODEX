import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Top-level error boundary — catches render-phase errors anywhere in the tree
 * below it and renders a recoverable fallback instead of a white screen.
 *
 * Mounted once in main.tsx, wrapping <App />. Because it sits OUTSIDE
 * <BrowserRouter>, route changes after an error work normally (the boundary
 * stays mounted across navigations).
 *
 * In production, replace the console.error with your real telemetry sink
 * (Sentry, Datadog RUM, etc.) — the boundary is the standard hook for it.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
    // Hook for production telemetry:
    // if (process.env.NODE_ENV === 'production') reportToSentry(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const errorMessage = this.state.error?.message || 'An unexpected error occurred.';

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="min-h-screen flex items-center justify-center bg-surface px-container-padding py-8 font-body"
      >
        <div className="max-w-xl w-full stat-card p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-error-container text-on-error-container flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl" aria-hidden="true">
              error
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-on-surface mb-2">
            Something went wrong
          </h1>
          <p className="text-on-surface-variant mb-6">
            We hit an unexpected problem rendering this page. Your work hasn&apos;t been lost —
            you can try again or reload the app.
          </p>
          <p className="text-xs font-mono text-on-surface-variant bg-surface-container-lowest rounded-lg p-3 mb-6 break-words">
            {errorMessage}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={this.handleReset}
              className="font-display text-sm font-bold uppercase tracking-[0.08em] bg-primary text-on-primary px-6 py-3 rounded-full hover:bg-primary-container hover:text-on-primary-container transition shadow-sm cursor-pointer"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="font-display text-sm font-bold uppercase tracking-[0.08em] border border-surface-variant text-on-surface px-6 py-3 rounded-full hover:bg-surface-container transition cursor-pointer"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
