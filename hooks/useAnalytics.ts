/**
 * hooks/useAnalytics.ts
 *
 * Drives app/dashboard/analytics/page.tsx. Fetches trend, category
 * breakdown, and budget-vs-actual data for the selected time range, all
 * scoped to the connected wallet's account.
 *
 * ASSUMPTION: there's an existing wallet context exposing the connected
 * public key. Adjust the import/hook name below to match this repo's real
 * context (context/ directory already exists per the project structure).
 */
'use client';

import { BudgetVsActualEntry, CategoryBreakdownEntry, getBudgetVsActual, getCategoryBreakdown, getGranularity, getSpendingTrend, getTimeWindow, SpendingTrendPoint, TimeRange } from '@/lib/api/stellar/analyticsContract';
import { useCallback, useEffect, useState } from 'react';
import useWallet from './useWallet';


// ASSUMPTION: adjust to match the real wallet context hook in context/.

export interface UseAnalyticsResult {
  trend: SpendingTrendPoint[];
  categoryBreakdown: CategoryBreakdownEntry[];
  budgetVsActual: BudgetVsActualEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * React hook that fetches and manages analytics data for a given time range.
 * Pulls spending trend, category breakdown, and budget-vs-actual data from the
 * on-chain analytics contract, scoped to the connected wallet's account.
 * @param range - The time range to query ('week', 'month', 'quarter', or 'year').
 * @returns An UseAnalyticsResult with trend data, loading state, error info, and a refetch function.
 */
export function useAnalytics(range: TimeRange): UseAnalyticsResult {
    const { freighter } = useWallet();
    const publicKey = freighter.publicKey;

  const [trend, setTrend] = useState<SpendingTrendPoint[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownEntry[]>([]);
  const [budgetVsActual, setBudgetVsActual] = useState<BudgetVsActualEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchToken, setRefetchToken] = useState(0);

  const refetch = useCallback(() => setRefetchToken((t) => t + 1), []);

  useEffect(() => {
    if (!publicKey) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);

      const window = getTimeWindow(range);
      const granularity = getGranularity(range);

      Promise.all([
        getSpendingTrend({ accountPublicKey: publicKey, window, granularity }),
        getCategoryBreakdown({ accountPublicKey: publicKey, window }),
        getBudgetVsActual({ accountPublicKey: publicKey, window }),
      ])
        .then(([trendData, categoryData, budgetData]) => {
          if (cancelled) return;
          setTrend(trendData);
          setCategoryBreakdown(categoryData);
          setBudgetVsActual(budgetData);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Failed to load analytics.');
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [publicKey, range, refetchToken]);

  return { trend, categoryBreakdown, budgetVsActual, isLoading, error, refetch };
}