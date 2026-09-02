/**
 * lib/stellar/priceOracle.ts
 *
 * Client for reading live USD / cross-asset conversion rates from the deployed
 * currency-conversion contract (sibling repo: stellarspend/stellarspend-contracts,
 * see contracts/currency-conversion and contracts/shared/src/oracle.rs).
 *
 * The contract exposes a PriceOracle-style interface once real oracle
 * integration is wired in (sibling repo issue #8):
 *
 *   get_price(asset_a, asset_b) -> (value: i128 [7-decimal fixed point], timestamp: u64)
 *   is_fresh(asset_a, asset_b, staleness_threshold) -> bool
 *
 * Until that contract is deployed and configured via
 * NEXT_PUBLIC_CURRENCY_CONVERSION_CONTRACT_ID, this module falls back to a
 * locally-cached rate snapshot. That keeps the whole app (balances, budgets)
 * deriving every valuation from this single oracle source of truth instead of
 * hardcoded numbers scattered through the UI. When the on-chain oracle is
 * reachable, its quotes (and staleness timestamps) are used directly.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type SupportedAsset = 'XLM' | 'USDC' | 'EURC';

export const SUPPORTED_ASSETS: readonly SupportedAsset[] = ['XLM', 'USDC', 'EURC'];

export type RateSource = 'oracle' | 'cache';

/** A single asset price quote, expressed in USD per 1 unit of the asset. */
export interface PriceQuote {
  asset: SupportedAsset;
  /** USD value of 1 unit of the asset (e.g. XLM ≈ 0.15). */
  priceUsd: number;
  /** Percent change over the last 24h. Oracle-derived where available. */
  change24h: number;
  /** Unix seconds when this quote was last updated by the source. */
  timestamp: number;
  source: RateSource;
}

/** Flat USD-per-asset rate map, convenient for conversion math. */
export type RateMap = Record<SupportedAsset, number>;

/** Point-in-time snapshot of every tracked asset, plus staleness metadata. */
export interface OracleSnapshot {
  quotes: Record<SupportedAsset, PriceQuote>;
  /** True when the oldest quote is older than the staleness threshold. */
  isStale: boolean;
  /** Unix seconds of the most recent quote (null when nothing known). */
  lastUpdatedAt: number | null;
  stalenessThresholdSeconds: number;
  source: RateSource;
}

/** A rate map frozen at a specific moment (used for rate-at-spend-time math). */
export interface RateSnapshot {
  capturedAt: number;
  rates: RateMap;
}

// ─── Constants ─────────────────────────────────────────────────────────────

/** Maximum acceptable age of a price feed before it is flagged as stale. */
export const PRICE_ORACLE_STALENESS_THRESHOLD_SECONDS = 15 * 60; // 15 minutes

/** Fixed-point scale used by the on-chain oracle (7 decimals). */
const PRICE_SCALE = 10_000_000;

/**
 * Fallback rates used when no on-chain oracle is reachable (dev/test, or
 * before the currency-conversion contract is wired). These mirror the values
 * previously hardcoded in lib/api/client.ts and are replaced automatically by
 * live oracle quotes as soon as the contract responds.
 */
const FALLBACK_RATES: Record<SupportedAsset, { priceUsd: number; change24h: number }> = {
  XLM: { priceUsd: 0.15, change24h: 2.4 },
  USDC: { priceUsd: 1.0, change24h: 0.01 },
  EURC: { priceUsd: 1.08, change24h: -0.31 },
};

const CACHED_RATES_KEY = 'stellarspend_cached_rates';

/**
 * Deployed currency-conversion contract (sibling repo) that exposes the
 * oracle interface. Read lazily so the value can change at runtime/tests.
 */
function getCurrencyConversionContractId(): string {
  return process.env.NEXT_PUBLIC_CURRENCY_CONVERSION_CONTRACT_ID ?? '';
}

// ─── Local rate cache ──────────────────────────────────────────────────────

interface CachedRates {
  quotes: Record<SupportedAsset, PriceQuote>;
  savedAt: number;
}

function readCachedRates(): CachedRates | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CACHED_RATES_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedRates;
  } catch {
    return null;
  }
}

function writeCachedRates(cache: CachedRates): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHED_RATES_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to cache price quotes', e);
  }
}

function seedFallbackQuotes(now: number): Record<SupportedAsset, PriceQuote> {
  return Object.fromEntries(
    SUPPORTED_ASSETS.map((asset) => [
      asset,
      {
        asset,
        priceUsd: FALLBACK_RATES[asset].priceUsd,
        change24h: FALLBACK_RATES[asset].change24h,
        timestamp: now,
        source: 'cache' as RateSource,
      },
    ]),
  ) as Record<SupportedAsset, PriceQuote>;
}

// ─── On-chain read ─────────────────────────────────────────────────────────

/**
 * Read current quotes from the deployed currency-conversion contract using the
 * oracle interface (`get_price(asset_a, asset_b)` returning a 7-decimal
 * fixed-point value and an update timestamp). Returns null when the contract
 * is not configured, the user is not connected, or the read fails so callers
 * can fall back to the cached snapshot.
 */
export async function readOnChainRates(
  publicKey?: string | null,
): Promise<Record<SupportedAsset, PriceQuote> | null> {
  const contractId = getCurrencyConversionContractId();
  if (!contractId || !publicKey) return null;
  try {
    const { callContractView } = await import('@/lib/stellar/budgetContract');
    const quotes = {} as Record<SupportedAsset, PriceQuote>;
    for (const asset of SUPPORTED_ASSETS) {
      // asset_a = base asset, asset_b = quote asset (USD).
      const result = await callContractView<[string | number, string | number]>(
        publicKey,
        contractId,
        'get_price',
        [asset, 'USDC'],
      );
      const priceUsd = Number(result?.[0]) / PRICE_SCALE;
      const timestamp = Number(result?.[1]);
      if (!Number.isFinite(priceUsd) || priceUsd <= 0) continue;
      quotes[asset] = {
        asset,
        priceUsd,
        // The oracle trait exposes current price + TWAP, not a 24h delta yet.
        // Kept as a separate field so the UI can render it once the contract
        // supplies history (see sibling repo oracle.rs).
        change24h: 0,
        timestamp,
        source: 'oracle',
      };
    }
    if (SUPPORTED_ASSETS.some((a) => quotes[a])) return quotes;
    return null;
  } catch (e) {
    console.warn('Failed to read prices from currency-conversion contract', e);
    return null;
  }
}

// ─── Snapshot assembly ─────────────────────────────────────────────────────

/**
 * Pure staleness check: a feed older than `thresholdSeconds` is stale.
 */
export function computeIsStale(
  now: number,
  lastUpdatedAt: number | null,
  thresholdSeconds: number,
): boolean {
  if (lastUpdatedAt == null) return true;
  return now - lastUpdatedAt > thresholdSeconds;
}

/**
 * Fetch the current oracle snapshot: on-chain quotes when available, otherwise
 * the cached/fallback snapshot. The result is always persisted back to the
 * local cache so subsequent renders (and offline usage) have a consistent view.
 */
export async function fetchOracleSnapshot(
  publicKey?: string | null,
): Promise<OracleSnapshot> {
  const now = Math.floor(Date.now() / 1000);
  const threshold = PRICE_ORACLE_STALENESS_THRESHOLD_SECONDS;

  const onChain = await readOnChainRates(publicKey);

  let quotes: Record<SupportedAsset, PriceQuote>;
  let source: RateSource;
  if (onChain) {
    quotes = onChain;
    source = 'oracle';
  } else {
    const cached = readCachedRates();
    if (cached && cached.quotes) {
      quotes = cached.quotes;
      source = 'cache';
    } else {
      quotes = seedFallbackQuotes(now);
      source = 'cache';
    }
  }

  writeCachedRates({ quotes, savedAt: now });

  const timestamps = SUPPORTED_ASSETS.map((a) => quotes[a]?.timestamp).filter(
    (t): t is number => typeof t === 'number' && t > 0,
  );
  const lastUpdatedAt = timestamps.length
    ? Math.max(...timestamps)
    : readCachedRates()?.savedAt ?? now;

  return {
    quotes,
    isStale: computeIsStale(now, lastUpdatedAt, threshold),
    lastUpdatedAt,
    stalenessThresholdSeconds: threshold,
    source,
  };
}

// ─── Conversion helpers ────────────────────────────────────────────────────

/** Build a flat USD-per-asset rate map from a snapshot (or the fallback). */
export function getRateMap(snapshot?: OracleSnapshot | null): RateMap {
  const quotes = snapshot?.quotes ?? seedFallbackQuotes(Math.floor(Date.now() / 1000));
  return Object.fromEntries(
    SUPPORTED_ASSETS.map((a) => [a, quotes[a]?.priceUsd ?? 0]),
  ) as RateMap;
}

/**
 * Convert an amount from one asset to another using the given rate map.
 * Conversion pivots through USD, which is how the dashboard aggregates.
 */
export function convertAmount(
  amount: number,
  from: SupportedAsset,
  to: SupportedAsset,
  rates: RateMap,
): number {
  if (from === to) return amount;
  const fromUsd = amount * (rates[from] ?? 0);
  const toRate = rates[to] ?? 0;
  if (toRate <= 0) return 0;
  return fromUsd / toRate;
}

/** Convert an amount denominated in `asset` to its USD equivalent. */
export function toUsdAmount(amount: number, asset: SupportedAsset, rates: RateMap): number {
  return amount * (rates[asset] ?? 0);
}

/**
 * Freeze the current rate map so later conversions use the rate in effect now.
 * This is the mechanism for tracking spend at the rate in effect at spend
 * time (acceptance criterion #3): capture a snapshot when a payment happens,
 * then convert subsequent budget comparisons against the frozen rates instead
 * of applying today's rate retroactively.
 */
export function captureRateSnapshot(
  snapshot: OracleSnapshot,
  at: number = Math.floor(Date.now() / 1000),
): RateSnapshot {
  return { capturedAt: at, rates: getRateMap(snapshot) };
}

/**
 * Convert an amount using a previously captured rate snapshot (rate at spend
 * time), not the current market rate.
 */
export function convertAtRate(
  amount: number,
  from: SupportedAsset,
  to: SupportedAsset,
  rateSnapshot: RateSnapshot,
): number {
  return convertAmount(amount, from, to, rateSnapshot.rates);
}

/** Round to 2 decimals for display/storage. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
