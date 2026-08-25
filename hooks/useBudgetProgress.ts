"use client";

/**
 * hooks/useBudgetProgress.ts
 *
 * Computes budget "spent so far" figures from real categorized transactions.
 * Used by the budgets dashboard to show progress bars driven by actual spend data.
 */

import { useState, useEffect, useCallback } from "react";
import { Transaction, fetchTransactions, getConnectedPublicKey, Budget } from "@/lib/api/client";

export interface BudgetProgress {
  budgetId: string;
  categoryId: string;
  budgeted: number;
  spent: number;
  asset: string;
}

/**
 * For each budget, computes the total spent amount by summing all matching
 * categorized outgoing transactions (same category, same asset, within date range).
 */
export function useBudgetProgress(budgets: Budget[]): {
  progress: BudgetProgress[];
  loading: boolean;
} {
  const [progress, setProgress] = useState<BudgetProgress[]>([]);
  const [loading, setLoading] = useState(false);

  const compute = useCallback(async () => {
    if (budgets.length === 0) {
      setProgress([]);
      return;
    }

    const publicKey = getConnectedPublicKey();
    setLoading(true);

    try {
      // Determine the widest date range across all budgets
      let earliest = Infinity;
      let latest = -Infinity;
      const categories = new Set<string>();
      const assets = new Set<string>();

      for (const b of budgets) {
        categories.add(b.category);
        assets.add(b.asset);
        const start = new Date(b.startDate).getTime();
        const end = new Date(b.endDate).getTime();
        if (start < earliest) earliest = start;
        if (end > latest) latest = end;
      }

      // Fetch all outgoing transactions in the union of all budget date ranges
      // (limited – we pull up to 500 for a reasonable user scale)
      const { data: allTxs } = await fetchTransactions(
        {
          dateFrom: new Date(earliest).toISOString(),
          dateTo: new Date(latest).toISOString(),
          type: "out",
        },
        1,
        500,
      );

      // Now compute per-budget totals
      const result: BudgetProgress[] = budgets.map((budget) => {
        const budgetStart = new Date(budget.startDate).getTime();
        const budgetEnd = new Date(budget.endDate).getTime();

        const spent = allTxs
          .filter((tx: Transaction) => {
            const txTime = new Date(tx.created_at).getTime();
            const txAsset = tx.operations[0]?.asset_code;
            const txCategory = tx.category;
            const txAmount = parseFloat(tx.operations[0]?.amount ?? "0");

            return (
              txCategory === budget.category &&
              txAsset === budget.asset &&
              txTime >= budgetStart &&
              txTime <= budgetEnd &&
              tx.successful
            );
          })
          .reduce((sum: number, tx: Transaction) => {
            return sum + parseFloat(tx.operations[0]?.amount ?? "0");
          }, 0);

        return {
          budgetId: budget.id,
          categoryId: budget.category,
          budgeted: budget.amount,
          spent,
          asset: budget.asset,
        };
      });

      setProgress(result);
    } catch (err) {
      console.error("Failed to compute budget progress:", err);
    } finally {
      setLoading(false);
    }
  }, [budgets]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void compute();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [compute]);

  return { progress, loading };
}