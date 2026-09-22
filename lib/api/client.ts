import { Asset, OracleRate, PriceOracle } from "../stellar/priceOracle";

export type Balance = { asset: Asset; amount: number; usdValue: number; change24h?: number; rate: OracleRate };

export async function valueBalances(
  balances: Array<{ asset: Asset; amount: number }>, oracle: PriceOracle, usd: Asset = { code: "USD" },
): Promise<Balance[]> {
  return Promise.all(balances.map(async ({ asset, amount }) => {
    const result = await oracle.convert(amount, asset, usd);
    return { asset, amount, usdValue: result.amount, rate: result.rate };
  }));
}
