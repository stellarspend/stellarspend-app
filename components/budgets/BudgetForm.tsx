import React, { useState } from "react";
import { Asset, PriceOracle } from "../../lib/stellar/priceOracle";

export function BudgetForm({ budgetAsset, oracle, spent }: { budgetAsset: Asset; oracle: PriceOracle; spent: Array<{ amount: number; asset: Asset }> }) {
  const [progress, setProgress] = useState<{ amount: number; stale: boolean } | null>(null);
  async function refresh() {
    const converted = await Promise.all(spent.map((item) => oracle.convert(item.amount, item.asset, budgetAsset)));
    setProgress({ amount: converted.reduce((sum, item) => sum + item.amount, 0), stale: converted.some((item) => item.rate.stale) });
  }
  return <section aria-label="Budget tracking">
    <button type="button" onClick={refresh}>Refresh spending</button>
    {progress && <p>Spent {progress.amount.toFixed(2)} {budgetAsset.code}{progress.stale && <span role="status"> — rates may be delayed</span>}</p>}
  </section>;
}
