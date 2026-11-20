import React from 'react';
import { Card } from './Card';
import { Button } from './Button';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F5EC] text-[#252B26] flex items-center justify-center p-6">
          <Card padding="lg" className="max-w-lg w-full space-y-4">
            <h1 className="text-xl font-bold text-[#C66B5B] font-display">
              Application Diagnostic Notice
            </h1>
            <pre className="p-3 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] text-xs font-mono-tabular overflow-x-auto whitespace-pre-wrap">
              {this.state.errorMessage}
            </pre>
            <Button
              variant="primary"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
            >
              Resume QueueSense
            </Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
