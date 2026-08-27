'use client';

import { CategoryBreakdownEntry, SUPPORTED_ASSETS } from "@/lib/api/stellar/analyticsContract";
import { formatAssetAmount } from "@/lib/api/stellar/formatAmount";


interface AssetSummaryCardsProps {
  categoryBreakdown: CategoryBreakdownEntry[];
}

export function AssetSummaryCards({ categoryBreakdown }: AssetSummaryCardsProps) {
  const totalsByAsset = SUPPORTED_ASSETS.map((asset) => {
    const entries = categoryBreakdown.filter((e) => e.asset === asset);
    const totalStroops = entries.reduce((sum, e) => sum + BigInt(e.totalSpent), BigInt(0));
    const transactionCount = entries.reduce((sum, e) => sum + e.transactionCount, 0);
    return { asset, totalStroops: totalStroops.toString(), transactionCount };
  }).filter((t) => t.transactionCount > 0);

  if (totalsByAsset.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Asset balances">
      {totalsByAsset.map(({ asset, totalStroops, transactionCount }) => (
        <div key={asset} className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{asset} spent</p>
          <p className="mt-1 text-2xl font-semibold">{formatAssetAmount(totalStroops, asset)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {transactionCount} transaction{transactionCount === 1 ? '' : 's'}
          </p>
        </div>
      ))}
    </div>
  );
}