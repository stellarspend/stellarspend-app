import React from 'react';

interface AnalyticsSectionProps {
  children: React.ReactNode;
}

export function AnalyticsSection({ children }: AnalyticsSectionProps) {
  return (
    <div role="region" aria-label="Spending analytics">
      {children}
    </div>
  );
}
