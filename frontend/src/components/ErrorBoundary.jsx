import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0B0E] flex flex-col items-center justify-center text-white p-6">
          <h1 className="text-3xl font-bold text-[#FF3B30] mb-4">Something went wrong.</h1>
          <p className="mb-4 text-white/70">The page crashed during rendering.</p>
          <div className="bg-black/50 p-4 rounded-3xl border border-white/10 w-full max-w-2xl overflow-auto text-left">
            <p className="text-red-400 font-mono text-sm mb-2">{this.state.error && this.state.error.toString()}</p>
            <pre className="text-white/50 font-mono text-[10px] whitespace-pre-wrap">
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
          <button 
            className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-3xl font-mono text-sm"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
