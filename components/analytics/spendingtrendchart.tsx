'use client';

import { Granularity, SpendingTrendPoint, SUPPORTED_ASSETS } from '@/lib/api/stellar/analyticsContract';
import { ASSET_SYMBOL, stroopsToDisplay } from '@/lib/api/stellar/formatAmount';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';


const ASSET_COLOR: Record<string, string> = {
  XLM: '#6366f1', // indigo
  USDC: '#22c55e', // green
  EURC: '#f59e0b', // amber
};

interface SpendingTrendChartProps {
  data: SpendingTrendPoint[];
  granularity: Granularity;
}

interface ChartRow {
  bucketLabel: string;
  bucketStart: number;
  [assetKey: string]: number | string;
}

function formatBucketLabel(unixSeconds: number, granularity: Granularity): string {
  const date = new Date(unixSeconds * 1000);
  if (granularity === 'month') {
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Pivots per-(bucket, asset) rows into one row per bucket with a column per
 * asset, so recharts can draw one line per asset on a shared time axis
 * without ever adding the asset values together. */
function pivotByBucket(data: SpendingTrendPoint[], granularity: Granularity): ChartRow[] {
  const byBucket = new Map<number, ChartRow>();

  for (const point of data) {
    const existing = byBucket.get(point.bucketStart) ?? {
      bucketStart: point.bucketStart,
      bucketLabel: formatBucketLabel(point.bucketStart, granularity),
    };
    existing[point.asset] = stroopsToDisplay(point.totalSpent, point.asset);
    byBucket.set(point.bucketStart, existing);
  }

  return Array.from(byBucket.values()).sort((a, b) => a.bucketStart - b.bucketStart);
}

export function SpendingTrendChart({ data, granularity }: SpendingTrendChartProps) {
  const chartData = pivotByBucket(data, granularity);
  const assetsPresent = SUPPORTED_ASSETS.filter((asset) =>
    data.some((point) => point.asset === asset),
  );

  if (chartData.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        No spending in this time range yet.
      </div>
    );
  }

  return (
    <div className="h-72 w-full" aria-label="Spending trend chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="bucketLabel" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={48} />
          <Tooltip
            formatter={(value: number, asset: string) => [
              `${value.toFixed(2)} ${ASSET_SYMBOL[asset as keyof typeof ASSET_SYMBOL] ?? asset}`,
              asset,
            ]}
          />
          {assetsPresent.map((asset) => (
            <Line
              key={asset}
              type="monotone"
              dataKey={asset}
              name={asset}
              stroke={ASSET_COLOR[asset]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}