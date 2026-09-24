/**
 * app/dashboard/analytics/page.tsx
 *
 * Spending-insights view: trend over time, category breakdown, and
 * budget-vs-actual, all sourced from the on-chain analytics contract via
 * lib/stellar/analyticsContract.ts (see hooks/useAnalytics.ts).
 *
 * Client component: it holds time-range state and calls a hook that reads
 * from the connected wallet's account.
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
import { useState } from 'react';

export default function AnalyticsPage() {
  const [range, setRange] = useState<TimeRange>('month');
  const [budgetAsset, setBudgetAsset] = useState(SUPPORTED_ASSETS[0]);

  const { trend, categoryBreakdown, budgetVsActual, isLoading, error, refetch } =
    useAnalytics(range);

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
          <TimeRangeSelector value={range} onChange={setRange} />
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