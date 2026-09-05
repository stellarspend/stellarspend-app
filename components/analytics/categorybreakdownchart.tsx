'use client';

import { CategoryBreakdownEntry, SUPPORTED_ASSETS } from '@/lib/api/stellar/analyticsContract';
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

const ASSET_COLOR: Record<string, string> = {
  XLM: '#6366f1',
  USDC: '#22c55e',
  EURC: '#f59e0b',
};

interface CategoryBreakdownChartProps {
  data: CategoryBreakdownEntry[];
}

interface ChartRow {
  categoryLabel: string;
  [assetKey: string]: number | string;
}

function pivotByCategory(data: CategoryBreakdownEntry[]): ChartRow[] {
  const byCategory = new Map<string, ChartRow>();

  for (const entry of data) {
    const existing = byCategory.get(entry.categoryId) ?? {
      categoryLabel: entry.categoryLabel,
    };
    existing[entry.asset] = stroopsToDisplay(entry.totalSpent, entry.asset);
    byCategory.set(entry.categoryId, existing);
  }

  return Array.from(byCategory.values());
}

export function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
  const chartData = pivotByCategory(data);
  const assetsPresent = SUPPORTED_ASSETS.filter((asset) =>
    data.some((entry) => entry.asset === asset),
  );

  if (chartData.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        No categorized transactions in this time range yet.
      </div>
    );
  }

  return (
    <div className="h-72 w-full" aria-label="Category breakdown chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="categoryLabel" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={48} />
          <Tooltip
            formatter={(value: number, asset: string) => [
              `${value.toFixed(2)} ${ASSET_SYMBOL[asset as keyof typeof ASSET_SYMBOL] ?? asset}`,
              asset,
            ]}
          />
          <Legend />
          {assetsPresent.map((asset) => (
            <Bar key={asset} dataKey={asset} name={asset} fill={ASSET_COLOR[asset]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}