'use client';

import { Component, Fragment, type ReactNode } from 'react';
import Image from 'next/image';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  value: string;
  change: string;
  iconSrc?: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface DashboardCardErrorBoundaryProps {
  title: string;
  children: ReactNode;
}

interface DashboardCardErrorBoundaryState {
  error: Error | null;
  retryKey: number;
}

class DashboardCardErrorBoundary extends Component<
  DashboardCardErrorBoundaryProps,
  DashboardCardErrorBoundaryState
> {
  state: DashboardCardErrorBoundaryState = {
    error: null,
    retryKey: 0,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  handleRetry = () => {
    this.setState(({ retryKey }) => ({
      error: null,
      retryKey: retryKey + 1,
    }));
  };

  render() {
    if (this.state.error) {
      return (
        <div
          className="relative p-6 rounded-2xl bg-white/5 border border-red-400/30 transition-all duration-300"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-[#7a8aaa] text-sm mb-1">{this.props.title}</p>
              <p className="text-white text-lg font-semibold">This card could not load.</p>
            </div>

            <div className="relative w-12 h-12 rounded-lg bg-red-400/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-300" aria-hidden="true" />
            </div>
          </div>

          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:border-[#e8b84b]/40 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#e8b84b]/50"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      );
    }

    return <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>;
  }
}

/**
 * Dashboard card component with optimized icon images
 * Demonstrates proper Image usage for small icons and graphics
 */
export default function DashboardCard({
  title,
  value,
  change,
  iconSrc,
  trend = 'neutral',
}: DashboardCardProps) {
  return (
    <DashboardCardErrorBoundary title={title}>
      <DashboardCardContent
        title={title}
        value={value}
        change={change}
        iconSrc={iconSrc}
        trend={trend}
      />
    </DashboardCardErrorBoundary>
  );
}

function DashboardCardContent({
  title,
  value,
  change,
  iconSrc,
  trend = 'neutral',
}: DashboardCardProps) {
  const trendColor = {
    up: 'text-green-500',
    down: 'text-red-500',
    neutral: 'text-[#7a8aaa]',
  }[trend];

  return (
    <div className="relative p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-[#e8b84b]/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[#7a8aaa] text-sm mb-1">{title}</p>
          <p className="text-white text-3xl font-bold">{value}</p>
        </div>
        
        {iconSrc && (
          <div className="relative w-12 h-12 rounded-lg bg-[#e8b84b]/10 flex items-center justify-center">
            <Image
              src={iconSrc}
              alt={`${title} icon`}
              width={24}
              height={24}
              className="object-contain"
              loading="lazy"
            />
          </div>
        )}
      </div>
      
      <p className={`text-sm ${trendColor}`}>
        {change}
      </p>
    </div>
  );
}
