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
        <div className="min-h-screen bg-[#F7F8FC] flex flex-col items-center justify-center text-[#1E1B4B] p-6">
          <h1 className="text-3xl font-bold text-[#FF2D55] mb-4">Something went wrong.</h1>
          <p className="mb-4 text-[#64748B]">The page crashed during rendering.</p>
          <div className="bg-[#EEF2FF] p-4 rounded-3xl border border-[#1E1B4B]/08 w-full max-w-2xl overflow-auto text-left">
            <p className="text-red-400 font-mono text-sm mb-2">{this.state.error && this.state.error.toString()}</p>
            <pre className="text-[#64748B] font-mono text-[10px] whitespace-pre-wrap">
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
          <button
            className="mt-6 px-6 py-2 bg-[#EEF2FF] hover:bg-[#E2E8F0] rounded-3xl font-mono text-sm"
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
