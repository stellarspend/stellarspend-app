/**
 * app/dashboard/analytics/page.tsx
 */
'use client';

import { AssetSummaryCards } from '@/components/analytics/assetsummarycards';
import { BudgetVsActualChart } from '@/components/analytics/budgetvsactualchart';
import { CategoryBreakdownChart } from '@/components/analytics/categorybreakdownchart';
import { SpendingTrendChart } from '@/components/analytics/spendingtrendchart';
import { TimeRangeSelector } from '@/components/analytics/timerangeselector';
import { AnalyticsSection } from '@/components/analytics/analytics';
import { useAnalytics } from '@/hooks/useAnalytics';
import { getGranularity, SUPPORTED_ASSETS, TimeRange } from '@/lib/api/stellar/analyticsContract';
import { exportToCsv } from '@/lib/api/stellar/exportAnalytics';
import { useState } from 'react';

export default function AnalyticsPage() {
  const [range, setRange] = useState<TimeRange>('month');
  const [budgetAsset, setBudgetAsset] = useState(SUPPORTED_ASSETS[0]);

  const { trend, categoryBreakdown, budgetVsActual, isLoading, error, refetch } =
    useAnalytics(range);

  const handleExport = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    exportToCsv({ range, trend, categoryBreakdown, budgetVsActual }, `stellarspend-analytics-${range}-${dateStr}.csv`);
  };

  return (
    <AnalyticsSection>
      <div className="space-y-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Spending trends, category breakdown, and budget performance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TimeRangeSelector value={range} onChange={setRange} />
            <button
              type="button"
              onClick={handleExport}
              className="rounded-md px-3 py-1 text-sm font-medium bg-muted text-foreground hover:bg-muted/80"
            >
              Export CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}{' '}
            <button type="button" onClick={refetch} className="underline">
              Retry
            </button>
          </div>
        )}

        <AssetSummaryCards categoryBreakdown={categoryBreakdown} />

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 text-lg font-medium">Spending over time</h2>
          {isLoading ? (
            <ChartSkeleton />
          ) : (
            <SpendingTrendChart data={trend} granularity={getGranularity(range)} />
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-4 text-lg font-medium">Spending by category</h2>
          {isLoading ? <ChartSkeleton /> : <CategoryBreakdownChart data={categoryBreakdown} />}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-medium">Budget vs. actual</h2>
            <div className="inline-flex gap-1">
              {SUPPORTED_ASSETS.map((asset) => (
                <button
                  key={asset}
                  type="button"
                  onClick={() => setBudgetAsset(asset)}
                  className={[
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    asset === budgetAsset
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  {asset}
                </button>
              ))}
            </div>
          </div>
          {isLoading ? (
            <ChartSkeleton />
          ) : (
            <BudgetVsActualChart data={budgetVsActual} asset={budgetAsset} />
          )}
        </section>
      </div>
    </AnalyticsSection>
  );
}

function ChartSkeleton() {
  return <div className="h-72 w-full animate-pulse rounded-md bg-muted" />;
}
