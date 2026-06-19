'use client';

import React, { Component, ReactNode } from 'react';
import Image from 'next/image';

interface DashboardCardProps {
  title: string;
  value: string;
  change: string;
  iconSrc?: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface DashboardCardErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
  title: string;
}

interface DashboardCardErrorBoundaryState {
  hasError: boolean;
}

class DashboardCardErrorBoundary extends Component<
  DashboardCardErrorBoundaryProps,
  DashboardCardErrorBoundaryState
> {
  state: DashboardCardErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Dashboard card failed to render:', error);
  }

  componentDidUpdate(prevProps: DashboardCardErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative p-6 rounded-2xl bg-red-500/5 border border-red-400/20 transition-all duration-300">
          <p className="text-[#7a8aaa] text-sm mb-2">{this.props.title}</p>
          <p className="text-white text-lg font-bold">
            This card could not load
          </p>
          <p className="text-red-200/70 text-sm mt-2">
            The rest of your dashboard is still available.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-5 rounded-xl bg-red-400/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-red-100 transition-colors hover:bg-red-400/25"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Dashboard card component with optimized icon images
 * Demonstrates proper Image usage for small icons and graphics
 */
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

export default function DashboardCard(props: DashboardCardProps) {
  const resetKey = `${props.title}-${props.value}-${props.change}`;

  return (
    <DashboardCardErrorBoundary title={props.title} resetKey={resetKey}>
      <DashboardCardContent {...props} />
    </DashboardCardErrorBoundary>
  );
}
