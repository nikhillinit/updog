// src/components/ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('UpdogLite Error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-6">
              We encountered an error while running your fund model. This might be due to invalid inputs or a calculation error.
            </p>
            {this.state.error && (
              <details className="text-left bg-gray-50 rounded p-3 mb-4 text-sm">
                <summary className="cursor-pointer font-medium">Error Details</summary>
                <pre className="mt-2 text-red-600 whitespace-pre-wrap">{this.state.error.message}</pre>
              </details>
            )}
            <button
              onClick={this.handleRetry}
              className="flex items-center justify-center space-x-2 w-full bg-press-600 text-white px-4 py-2 rounded-md hover:bg-press-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
