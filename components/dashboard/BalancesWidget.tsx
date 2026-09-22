import React from "react";
import { Balance } from "../../lib/api/client";

export function BalancesWidget({ balances }: { balances: Balance[] }) {
  const delayed = balances.some((b) => b.rate.stale);
  return <section aria-label="Balances">
    {delayed && <p role="status" className="rates-delayed">Rates may be delayed</p>}
    <ul>{balances.map((b) => <li key={`${b.asset.code}:${b.asset.issuer ?? "native"}`}>
      {b.amount} {b.asset.code} = ${b.usdValue.toFixed(2)}
      {b.rate.stale && <small aria-label="stale rate"> (rate delayed)</small>}
    </li>)}</ul>
  </section>;
}
