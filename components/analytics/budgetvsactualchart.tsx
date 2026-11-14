
'use client';

import { useMemo } from 'react';
import { BudgetVsActualEntry, SupportedAsset } from '@/lib/api/stellar/analyticsContract';
import { ASSET_SYMBOL, stroopsToDisplay } from '@/lib/api/stellar/formatAmount';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface BudgetVsActualChartProps {
  data: BudgetVsActualEntry[];
  asset: SupportedAsset;
}

interface ChartRow {
  categoryLabel: string;
  budgeted: number;
  actual: number;
  remaining: number;
  utilization: number | null;
  overBudget: boolean;
}

export function BudgetVsActualChart({
  data,
  asset,
}: BudgetVsActualChartProps) {
  const symbol = ASSET_SYMBOL[asset];

  const rows = useMemo<ChartRow[]>(
    () =>
      data
        .filter((entry) => entry.asset === asset)
        .map((entry) => {
          const budgeted = stroopsToDisplay(entry.budgetedAmount, asset);
          const actual = stroopsToDisplay(entry.actualSpent, asset);

          return {
            categoryLabel: entry.categoryLabel,
            budgeted,
            actual,
            remaining: budgeted - actual,
            utilization:
              budgeted > 0 ? (actual / budgeted) * 100 : null,
            overBudget: actual > budgeted,
          };
        }),
    [data, asset],
  );

  const money = (value: number) =>
    `${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${symbol}`;

  if (rows.length === 0) {
    return (
      <div
        role="status"
        className="flex min-h-72 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center"
      >
        <p className="text-sm font-medium">
          No budgets to display
        </p>
        <p className="text-sm text-muted-foreground">
          There are no {symbol} budgets for this time range.
          Try selecting another period or asset.
        </p>
      </div>
    );
  }

  const totalBudget = rows.reduce(
    (sum, row) => sum + row.budgeted,
    0,
  );
  const totalActual = rows.reduce(
    (sum, row) => sum + row.actual,
    0,
  );
  const overBudgetCount = rows.filter(
    (row) => row.overBudget,
  ).length;
  const totalUtilization =
    totalBudget > 0 ? (totalActual / totalBudget) * 100 : null;

  return (
    <section
      aria-labelledby="budget-chart-title"
      className="w-full space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="budget-chart-title"
            className="text-base font-semibold"
          >
            Budget vs. actual
          </h3>
          <p className="text-sm text-muted-foreground">
            Spending by category · {symbol}
          </p>
        </div>

        {overBudgetCount > 0 && (
          <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
            {overBudgetCount} over budget
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">
            Total budget
          </p>
          <p className="mt-1 break-words text-lg font-semibold tabular-nums">
            {money(totalBudget)}
          </p>
        </div>

        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">
            Actual spending
          </p>
          <p className="mt-1 break-words text-lg font-semibold tabular-nums">
            {money(totalActual)}
          </p>
        </div>

        <div className="col-span-2 rounded-lg border p-3 sm:col-span-1">
          <p className="text-xs text-muted-foreground">
            Budget used
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {totalUtilization === null
              ? '—'
              : `${totalUtilization.toFixed(1)}%`}
          </p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Total budget utilized"
            aria-valuenow={Math.min(
              100,
              totalUtilization ?? 0,
            )}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full rounded-full ${
                totalUtilization !== null &&
                totalUtilization > 100
                  ? 'bg-destructive'
                  : 'bg-primary'
              }`}
              style={{
                width: `${Math.min(
                  100,
                  totalUtilization ?? 0,
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div
        className="h-80 w-full sm:h-96"
        role="img"
        aria-label={`Bar chart comparing budgeted and actual ${symbol} spending by category. ${overBudgetCount} categories are over budget.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{
              top: 8,
              right: 8,
              bottom: 32,
              left: 12,
            }}
            barCategoryGap="24%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              className="stroke-border"
            />

            <XAxis
              dataKey="categoryLabel"
              tick={{ fontSize: 11 }}
              angle={-25}
              textAnchor="end"
              interval={0}
              height={64}
              tickMargin={10}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(value: number) =>
                `${value.toLocaleString()}`
              }
              width={60}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              domain={[0, 'auto']}
            />

            <Tooltip
              cursor={{ fill: 'currentColor', opacity: 0.05 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;

                const row = payload[0]?.payload as
                  | ChartRow
                  | undefined;

                if (!row) return null;

                return (
                  <div className="min-w-52 rounded-lg border bg-background p-3 shadow-lg">
                    <p className="mb-2 text-sm font-semibold">
                      {label}
                    </p>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          Budgeted
                        </span>
                        <span className="font-medium tabular-nums">
                          {money(row.budgeted)}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          Actual
                        </span>
                        <span className="font-medium tabular-nums">
                          {money(row.actual)}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          {row.remaining < 0
                            ? 'Over budget'
                            : 'Remaining'}
                        </span>
                        <span
                          className={`font-medium tabular-nums ${
                            row.overBudget
                              ? 'text-destructive'
                              : ''
                          }`}
                        >
                          {money(Math.abs(row.remaining))}
                        </span>
                      </div>

                      <div className="flex justify-between gap-4 border-t pt-2">
                        <span className="text-muted-foreground">
                          Budget used
                        </span>
                        <span className="font-semibold tabular-nums">
                          {row.utilization === null
                            ? 'No budget'
                            : `${row.utilization.toFixed(1)}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingBottom: 12 }}
            />

            <Bar
              dataKey="budgeted"
              name="Budgeted"
              fill="#94a3b8"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />

            <Bar
              dataKey="actual"
              name="Actual"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            >
              {rows.map((row, index) => (
                <Cell
                  key={`${row.categoryLabel}-${index}`}
                  fill={row.overBudget ? '#ef4444' : '#16a34a'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        Actual spending is shown in red when it exceeds the
        category budget, and green otherwise. Budget utilization
        can exceed 100%.
      </p>
    </section>
  );
}
