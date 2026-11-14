/**
 * lib/stellar/priceOracle.ts
 *
 * Soroban oracle-backed currency conversion and asset valuation client.
 * Queries the on-chain price oracle / currency-conversion contract when
 * NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID (or NEXT_PUBLIC_CURRENCY_CONVERSION_CONTRACT_ID)
 * is configured, and falls back to cached/deterministic oracle quotes when
 * offline or in local development.
 */

import {
  Account,
  Contract,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc as SorobanRpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import {
  getNetworkPassphrase,
  getSorobanServer,
} from "@/lib/api/stellar/client";

export type SupportedAsset = "XLM" | "USDC" | "EURC";

export const SUPPORTED_ORACLE_ASSETS: readonly SupportedAsset[] = [
  "XLM",
  "USDC",
  "EURC",
] as const;

/** Default oracle staleness threshold: 5 minutes (300,000 ms). */
export const DEFAULT_ORACLE_STALENESS_MS = 5 * 60 * 1000;

/** Default probe account used for read-only Soroban view simulations. */
const DEFAULT_ORACLE_READER_PUBLIC_KEY =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

/** Price precision scale (7 decimals, matching Stellar stroops / SEP-40 oracle convention). */
const ORACLE_DECIMALS_SCALE = 1e7;

export interface OraclePriceQuote {
  asset: SupportedAsset;
  /** Current USD price per 1 unit of the asset. */
  priceUsd: number;
  /** USD price 24 hours ago per 1 unit of the asset. */
  price24hAgoUsd: number;
  /** 24-hour percentage change, e.g. +2.4 or -0.31. */
  change24h: number;
  /** ISO-8601 timestamp when the oracle last updated this asset's feed. */
  updatedAt: string;
  /** True when the oracle timestamp is older than the staleness threshold. */
  isStale: boolean;
  /** Source of the quote ('contract' | 'fallback'). */
  source: "contract" | "fallback";
}

export type OracleQuoteMap = Record<SupportedAsset, OraclePriceQuote>;

export interface FetchOracleOptions {
  /** Override contract ID (defaults to env NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID). */
  contractId?: string;
  /** Caller Stellar address for simulation (defaults to demo reader address). */
  readerPublicKey?: string;
  /** Maximum age in milliseconds before a price quote is flagged as stale. */
  maxStalenessMs?: number;
  /** Reference "now" timestamp in ms for deterministic staleness checks. */
  nowMs?: number;
}

export interface CrossAssetSpendItem {
  amount: number | string;
  asset: SupportedAsset;
  /** Timestamp of the spend (ISO-8601 or unix ms) used to look up historical rates. */
  timestamp?: string | number;
  /** Optional explicit USD rate of `asset` at spend time. */
  rateUsdAtSpend?: number;
  /** Optional explicit target-asset rate in USD at spend time. */
  targetRateUsdAtSpend?: number;
}

export type HistoricalRateResolver = (
  asset: SupportedAsset,
  timestamp?: string | number
) => number | undefined;

const FALLBACK_BASE_QUOTES: Record<
  SupportedAsset,
  { priceUsd: number; price24hAgoUsd: number }
> = {
  XLM: { priceUsd: 0.15, price24hAgoUsd: 0.146484375 }, // ~ +2.40%
  USDC: { priceUsd: 1.0, price24hAgoUsd: 0.9999 }, // ~ +0.01%
  EURC: { priceUsd: 1.085, price24hAgoUsd: 1.088374 }, // ~ -0.31%
};

/**
 * Resolves the configured Soroban price oracle / currency conversion contract ID.
 */
export function getOracleContractId(overrideId?: string): string {
  if (overrideId !== undefined) return overrideId.trim();
  return (
    process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID ||
    process.env.NEXT_PUBLIC_CURRENCY_CONVERSION_CONTRACT_ID ||
    ""
  ).trim();
}

/**
 * Computes percentage change between a 24h-ago price and current price, rounded to 2 decimals.
 */
export function computeChange24h(
  priceUsd: number,
  price24hAgoUsd: number
): number {
  if (
    !Number.isFinite(priceUsd) ||
    !Number.isFinite(price24hAgoUsd) ||
    price24hAgoUsd <= 0
  ) {
    return 0;
  }
  const pct = ((priceUsd - price24hAgoUsd) / price24hAgoUsd) * 100;
  return Number(pct.toFixed(2));
}

/**
 * Determines whether an oracle timestamp is stale relative to `nowMs`.
 */
export function isPriceStale(
  updatedAt: string | number | Date,
  maxStalenessMs: number = DEFAULT_ORACLE_STALENESS_MS,
  nowMs: number = Date.now()
): boolean {
  const tsMs =
    typeof updatedAt === "number"
      ? updatedAt < 1e12
        ? updatedAt * 1000
        : updatedAt
      : new Date(updatedAt).getTime();

  if (!Number.isFinite(tsMs) || tsMs <= 0) {
    return true;
  }

  return nowMs - tsMs > maxStalenessMs;
}

/**
 * Normalizes a raw numeric price returned by a Soroban oracle contract.
 * Supports scaled integers (e.g. 1500000 -> 0.15 at 1e7 stroop scale) as well as decimal numbers/strings.
 */
export function normalizeRawContractPrice(rawPrice: unknown): number {
  if (typeof rawPrice === "bigint") {
    return Number(rawPrice) / ORACLE_DECIMALS_SCALE;
  }
  const num = typeof rawPrice === "string" ? Number(rawPrice) : Number(rawPrice);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`Invalid oracle price value: ${String(rawPrice)}`);
  }
  // SEP-40 / Soroban price feeds typically report integer prices scaled by 1e7.
  if (Number.isInteger(num) && num >= 100_000) {
    return num / ORACLE_DECIMALS_SCALE;
  }
  return num;
}

/**
 * Builds a deterministic fallback quote for a supported asset.
 */
export function getFallbackAssetQuote(
  asset: SupportedAsset,
  options: Pick<FetchOracleOptions, "maxStalenessMs" | "nowMs"> & {
    updatedAt?: string;
    isStaleOverride?: boolean;
  } = {}
): OraclePriceQuote {
  const nowMs = options.nowMs ?? Date.now();
  const updatedAt = options.updatedAt ?? new Date(nowMs).toISOString();
  const base = FALLBACK_BASE_QUOTES[asset] ?? FALLBACK_BASE_QUOTES.USDC;
  const change24h = computeChange24h(base.priceUsd, base.price24hAgoUsd);
  const isStale =
    options.isStaleOverride ??
    isPriceStale(
      updatedAt,
      options.maxStalenessMs ?? DEFAULT_ORACLE_STALENESS_MS,
      nowMs
    );

  return {
    asset,
    priceUsd: base.priceUsd,
    price24hAgoUsd: base.price24hAgoUsd,
    change24h,
    updatedAt,
    isStale,
    source: "fallback",
  };
}

/**
 * Returns fallback quotes for all supported assets.
 */
export function getFallbackOracleQuotes(
  options: Pick<FetchOracleOptions, "maxStalenessMs" | "nowMs"> & {
    updatedAt?: string;
    isStaleOverride?: boolean;
  } = {}
): OracleQuoteMap {
  return {
    XLM: getFallbackAssetQuote("XLM", options),
    USDC: getFallbackAssetQuote("USDC", options),
    EURC: getFallbackAssetQuote("EURC", options),
  };
}

/**
 * Invokes a read-only view function on the Soroban price oracle contract.
 */
async function callOracleContractView<T>(
  contractId: string,
  method: string,
  args: unknown[],
  readerPublicKey: string = DEFAULT_ORACLE_READER_PUBLIC_KEY
): Promise<T> {
  const server = getSorobanServer();
  const networkPassphrase = getNetworkPassphrase();
  const contract = new Contract(contractId);
  const validReaderKey = StrKey.isValidEd25519PublicKey(readerPublicKey)
    ? readerPublicKey
    : DEFAULT_ORACLE_READER_PUBLIC_KEY;
  const sourceAccountResp = await server.getAccount(validReaderKey);
  const sourceAccount = new Account(
    validReaderKey,
    sourceAccountResp.sequenceNumber()
  );
  const scArgs = args.map((arg) => nativeToScVal(arg));

  const tx = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Oracle simulation error: ${sim.error}`);
  }

  if (!sim.result?.retval) {
    throw new Error(`Empty oracle return value for method: ${method}`);
  }

  return scValToNative(sim.result.retval) as T;
}

/**
 * Parses a raw contract response for `get_price` / `lastprice` into an OraclePriceQuote.
 */
function parseContractPriceQuote(
  asset: SupportedAsset,
  raw: unknown,
  options: Pick<FetchOracleOptions, "maxStalenessMs" | "nowMs"> = {}
): OraclePriceQuote {
  const nowMs = options.nowMs ?? Date.now();
  const maxStalenessMs =
    options.maxStalenessMs ?? DEFAULT_ORACLE_STALENESS_MS;
  const fallback = FALLBACK_BASE_QUOTES[asset] ?? FALLBACK_BASE_QUOTES.USDC;

  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const rawPrice =
      record.price_usd ??
      record.priceUsd ??
      record.price ??
      record.rate ??
      fallback.priceUsd;
    const priceUsd = normalizeRawContractPrice(rawPrice);

    const rawPrevPrice =
      record.price_24h_ago ??
      record.price24hAgoUsd ??
      record.prev_price ??
      undefined;
    const price24hAgoUsd =
      rawPrevPrice !== undefined
        ? normalizeRawContractPrice(rawPrevPrice)
        : fallback.price24hAgoUsd;

    const rawChange = record.change_24h ?? record.change24h;
    const change24h =
      typeof rawChange === "number" && Number.isFinite(rawChange)
        ? Number(rawChange.toFixed(2))
        : computeChange24h(priceUsd, price24hAgoUsd);

    const rawTimestamp =
      record.timestamp ??
      record.updated_at ??
      record.updatedAt ??
      Math.floor(nowMs / 1000);
    const updatedAtMs =
      typeof rawTimestamp === "number" || typeof rawTimestamp === "bigint"
        ? Number(rawTimestamp) < 1e12
          ? Number(rawTimestamp) * 1000
          : Number(rawTimestamp)
        : new Date(String(rawTimestamp)).getTime();
    const updatedAt = new Date(
      Number.isFinite(updatedAtMs) ? updatedAtMs : nowMs
    ).toISOString();

    return {
      asset,
      priceUsd,
      price24hAgoUsd,
      change24h,
      updatedAt,
      isStale: isPriceStale(updatedAt, maxStalenessMs, nowMs),
      source: "contract",
    };
  }

  const priceUsd = normalizeRawContractPrice(raw);
  const updatedAt = new Date(nowMs).toISOString();
  return {
    asset,
    priceUsd,
    price24hAgoUsd: fallback.price24hAgoUsd,
    change24h: computeChange24h(priceUsd, fallback.price24hAgoUsd),
    updatedAt,
    isStale: false,
    source: "contract",
  };
}

/**
 * Fetches the latest price quote for a single asset from the Soroban oracle contract.
 * Falls back to deterministic quote marked stale if the contract call fails after being configured.
 */
export async function fetchAssetPrice(
  asset: SupportedAsset,
  options: FetchOracleOptions = {}
): Promise<OraclePriceQuote> {
  const contractId = getOracleContractId(options.contractId);
  if (!contractId) {
    return getFallbackAssetQuote(asset, options);
  }

  try {
    const raw = await callOracleContractView<unknown>(
      contractId,
      "get_price",
      [asset],
      options.readerPublicKey
    );
    return parseContractPriceQuote(asset, raw, options);
  } catch {
    // When a configured oracle contract fails or times out, return fallback rates flagged as stale
    // so the UI warns the user that rates may be delayed.
    return getFallbackAssetQuote(asset, {
      ...options,
      isStaleOverride: true,
    });
  }
}

/**
 * Fetches oracle quotes for all supported assets (`XLM`, `USDC`, `EURC`).
 */
export async function fetchAllAssetPrices(
  options: FetchOracleOptions = {}
): Promise<OracleQuoteMap> {
  const [XLM, USDC, EURC] = await Promise.all([
    fetchAssetPrice("XLM", options),
    fetchAssetPrice("USDC", options),
    fetchAssetPrice("EURC", options),
  ]);
  return { XLM, USDC, EURC };
}

/**
 * Converts an amount from `fromAsset` to `toAsset` using oracle USD rates.
 *
 * @param amount - Numeric or string amount in `fromAsset`.
 * @param fromAsset - Source asset (`XLM`, `USDC`, or `EURC`).
 * @param toAsset - Target asset (`XLM`, `USDC`, or `EURC`).
 * @param quotesOrRates - Optional map of oracle quotes or USD rates per asset.
 * @returns Converted amount in `toAsset`, rounded to 2 decimal places.
 */
export function convertCurrency(
  amount: number | string,
  fromAsset: SupportedAsset,
  toAsset: SupportedAsset,
  quotesOrRates?: Partial<
    Record<SupportedAsset, OraclePriceQuote | number>
  >
): number {
  const numericAmount =
    typeof amount === "string"
      ? Number(amount.replace(/\s/g, ""))
      : Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount === 0) {
    return 0;
  }

  if (fromAsset === toAsset) {
    return Number(numericAmount.toFixed(2));
  }

  const resolveRate = (asset: SupportedAsset): number => {
    const entry = quotesOrRates?.[asset];
    if (typeof entry === "number" && Number.isFinite(entry) && entry > 0) {
      return entry;
    }
    if (
      entry &&
      typeof entry === "object" &&
      typeof entry.priceUsd === "number" &&
      entry.priceUsd > 0
    ) {
      return entry.priceUsd;
    }
    return FALLBACK_BASE_QUOTES[asset].priceUsd;
  };

  const fromUsd = resolveRate(fromAsset);
  const toUsd = resolveRate(toAsset);
  if (toUsd <= 0) return 0;

  const usdAmount = numericAmount * fromUsd;
  return Number((usdAmount / toUsd).toFixed(2));
}

/**
 * Computes total budget spend in `budgetAsset` across a mixed-currency list of spend items,
 * converting each spend using the oracle rate in effect at the time of spend.
 */
export function calculateCrossAssetBudgetSpend(
  budgetAsset: SupportedAsset,
  spends: CrossAssetSpendItem[],
  options: {
    currentQuotes?: Partial<Record<SupportedAsset, OraclePriceQuote | number>>;
    historicalRateResolver?: HistoricalRateResolver;
  } = {}
): number {
  if (!Array.isArray(spends) || spends.length === 0) {
    return 0;
  }

  let totalInBudgetAsset = 0;

  for (const item of spends) {
    const rawAmount =
      typeof item.amount === "string"
        ? Number(item.amount.replace(/\s/g, ""))
        : Number(item.amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) continue;

    if (item.asset === budgetAsset) {
      totalInBudgetAsset += rawAmount;
      continue;
    }

    const fromRateAtSpend =
      item.rateUsdAtSpend ??
      options.historicalRateResolver?.(item.asset, item.timestamp);
    const toRateAtSpend =
      item.targetRateUsdAtSpend ??
      options.historicalRateResolver?.(budgetAsset, item.timestamp);

    const rateOverrides: Partial<
      Record<SupportedAsset, OraclePriceQuote | number>
    > = {
      ...options.currentQuotes,
    };
    if (fromRateAtSpend !== undefined && fromRateAtSpend > 0) {
      rateOverrides[item.asset] = fromRateAtSpend;
    }
    if (toRateAtSpend !== undefined && toRateAtSpend > 0) {
      rateOverrides[budgetAsset] = toRateAtSpend;
    }

    totalInBudgetAsset += convertCurrency(
      rawAmount,
      item.asset,
      budgetAsset,
      rateOverrides
    );
  }

  return Number(totalInBudgetAsset.toFixed(2));
}
