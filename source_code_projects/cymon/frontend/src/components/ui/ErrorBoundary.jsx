import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  // A render crash with no boundary unmounts the whole app into a blank
  // white page. The soft retry re-renders (enough for transient errors);
  // the hard reload fetches a fresh index.html (the fix when a new deploy
  // renamed the code-split chunk the browser cached).
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl m-4 dark:bg-rose-950/40 dark:border-rose-900">
          <h2 className="text-lg font-bold text-rose-800 dark:text-rose-300 mb-2">Something went wrong</h2>
          <pre className="text-xs text-rose-600 dark:text-rose-400 whitespace-pre-wrap font-mono">
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo?.componentStack}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 text-sm font-semibold cursor-pointer"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </button>
            <button
              className="px-4 py-2 bg-white text-rose-700 border border-rose-300 rounded hover:bg-rose-100 text-sm font-semibold cursor-pointer"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
