export type Asset = { code: string; issuer?: string };

export type OracleRate = {
  base: Asset;
  quote: Asset;
  rate: number;
  observedAt: number;
  stale: boolean;
};

export type ContractReader = (method: string, args: unknown[]) => Promise<unknown>;

/** Thin, network-agnostic reader for the deployed currency-conversion contract. */
export class PriceOracle {
  constructor(
    private readonly readContract: ContractReader,
    private readonly maxAgeMs = 5 * 60_000,
    private readonly now = () => Date.now(),
  ) {}

  async rate(base: Asset, quote: Asset): Promise<OracleRate> {
    if (base.code === quote.code && base.issuer === quote.issuer)
      return { base, quote, rate: 1, observedAt: this.now(), stale: false };
    const raw = await this.readContract("get_rate", [base, quote]);
    const value = raw as { rate?: number | string; observedAt?: number; timestamp?: number; stale?: boolean };
    const rate = Number(value.rate);
    const rawObservedAt = Number(value.observedAt ?? value.timestamp);
    if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(rawObservedAt))
      throw new Error("Invalid rate returned by currency-conversion contract");
    // Soroban timestamps are conventionally Unix seconds; accept milliseconds too.
    const observedAt = rawObservedAt < 1_000_000_000_000 ? rawObservedAt * 1000 : rawObservedAt;
    return { base, quote, rate, observedAt, stale: Boolean(value.stale) || this.now() - observedAt > this.maxAgeMs };
  }

  async convert(amount: number, base: Asset, quote: Asset): Promise<{ amount: number; rate: OracleRate }> {
    if (!Number.isFinite(amount)) throw new Error("Amount must be finite");
    const rate = await this.rate(base, quote);
    return { amount: amount * rate.rate, rate };
  }
}
