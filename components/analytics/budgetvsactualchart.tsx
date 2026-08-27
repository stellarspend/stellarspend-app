'use client';

import { BudgetVsActualEntry, SupportedAsset } from '@/lib/api/stellar/analyticsContract';
import { ASSET_SYMBOL, stroopsToDisplay } from '@/lib/api/stellar/formatAmount';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface BudgetVsActualChartProps {
  data: BudgetVsActualEntry[];
  /** Which asset's budgets to display — budgets are shown one asset at a
   * time since "budgeted 500 XLM vs spent 60 USDC" isn't a single ratio. */
  asset: SupportedAsset;
}

interface ChartRow {
  categoryLabel: string;
  budgeted: number;
  actual: number;
}

export function BudgetVsActualChart({ data, asset }: BudgetVsActualChartProps) {
  const rows: ChartRow[] = data
    .filter((entry) => entry.asset === asset)
    .map((entry) => ({
      categoryLabel: entry.categoryLabel,
      budgeted: stroopsToDisplay(entry.budgetedAmount, asset),
      actual: stroopsToDisplay(entry.actualSpent, asset),
    }));

  if (rows.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        No active {ASSET_SYMBOL[asset]} budgets for this time range.
      </div>
    );
  }

  return (
    <div className="h-72 w-full" aria-label="Budget vs actual chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="categoryLabel" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={48} />
          <Tooltip formatter={(value: number) => `${value.toFixed(2)} ${ASSET_SYMBOL[asset]}`} />
          <Legend />
          <Bar dataKey="budgeted" name="Budgeted" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual" name="Actual" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}