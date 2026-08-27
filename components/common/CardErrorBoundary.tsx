'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface CardErrorBoundaryProps {
  children: React.ReactNode;
  cardTitle?: string;
}

interface CardErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class CardErrorBoundary extends React.Component<
  CardErrorBoundaryProps,
  CardErrorBoundaryState
> {
  constructor(props: CardErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): CardErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in card "${this.props.cardTitle ?? 'Unknown'}":`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative p-6 rounded-2xl bg-white/5 border border-red-500/20 flex flex-col items-center justify-center min-h-[120px] gap-3">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-red-400 text-sm font-semibold text-center">
            Something went wrong
          </p>
          <p className="text-[#7a8aaa] text-xs text-center max-w-xs">
            {this.props.cardTitle
              ? `Failed to load "${this.props.cardTitle}"`
              : 'This card encountered an error'}
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-1 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#e8b84b] bg-[#e8b84b]/10 border border-[#e8b84b]/20 rounded-lg hover:bg-[#e8b84b]/20 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
