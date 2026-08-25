import { describe, beforeEach, expect, test, jest } from '@jest/globals';

jest.mock('@/lib/stellar/budgetContract', () => ({
  callContractView: jest.fn(),
}));

import {
  fetchOracleSnapshot,
  computeIsStale,
  convertAmount,
  toUsdAmount,
  captureRateSnapshot,
  convertAtRate,
  getRateMap,
  PRICE_ORACLE_STALENESS_THRESHOLD_SECONDS,
  type OracleSnapshot,
  type PriceQuote,
  type SupportedAsset,
} from '../priceOracle';

const { callContractView } = jest.requireMock('@/lib/stellar/budgetContract') as {
  callContractView: jest.Mock;
};

const CACHED_RATES_KEY = 'stellarspend_cached_rates';

function buildQuotes(
  overrides: Partial<Record<SupportedAsset, Partial<PriceQuote>>> = {},
  timestamp?: number,
): Record<SupportedAsset, PriceQuote> {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const base: Record<SupportedAsset, PriceQuote> = {
    XLM: { asset: 'XLM', priceUsd: 0.15, change24h: 2.4, timestamp: ts, source: 'cache' },
    USDC: { asset: 'USDC', priceUsd: 1.0, change24h: 0.01, timestamp: ts, source: 'cache' },
    EURC: { asset: 'EURC', priceUsd: 1.08, change24h: -0.31, timestamp: ts, source: 'cache' },
  };
  for (const asset of Object.keys(overrides) as SupportedAsset[]) {
    base[asset] = { ...base[asset], ...overrides[asset] };
  }
  return base;
}

beforeEach(() => {
  localStorage.clear();
  callContractView.mockReset();
  delete process.env.NEXT_PUBLIC_CURRENCY_CONVERSION_CONTRACT_ID;
});

describe('fallback/cached snapshot', () => {
  test('returns fallback rates when no contract is configured', async () => {
    const snap = await fetchOracleSnapshot();

    expect(snap.source).toBe('cache');
    expect(snap.isStale).toBe(false);
    expect(snap.quotes.USDC.priceUsd).toBe(1);
    expect(snap.quotes.XLM.priceUsd).toBeCloseTo(0.15);
    expect(snap.quotes.EURC.priceUsd).toBeCloseTo(1.08);
  });

  test('flags a cached snapshot older than the threshold as stale', async () => {
    const old = Math.floor(Date.now() / 1000) - (PRICE_ORACLE_STALENESS_THRESHOLD_SECONDS + 60);
    localStorage.setItem(
      CACHED_RATES_KEY,
      JSON.stringify({ quotes: buildQuotes({}, old), savedAt: old }),
    );

    const snap = await fetchOracleSnapshot();

    expect(snap.source).toBe('cache');
    expect(snap.isStale).toBe(true);
    expect(snap.lastUpdatedAt).toBe(old);
  });

  test('treats quotes at exactly the threshold age as fresh', async () => {
    const old = Math.floor(Date.now() / 1000) - PRICE_ORACLE_STALENESS_THRESHOLD_SECONDS;
    localStorage.setItem(
      CACHED_RATES_KEY,
      JSON.stringify({ quotes: buildQuotes({}, old), savedAt: old }),
    );

    const snap = await fetchOracleSnapshot();

    expect(snap.isStale).toBe(false);
  });
});

describe('on-chain oracle path', () => {
  test('uses contract quotes when the contract responds', async () => {
    process.env.NEXT_PUBLIC_CURRENCY_CONVERSION_CONTRACT_ID = 'CONTRACT_ID';
    const now = Math.floor(Date.now() / 1000);
    // 7-decimal fixed point values: XLM=0.15, USDC=1.00, EURC=1.08
    callContractView
      .mockResolvedValueOnce(['1500000', String(now)])
      .mockResolvedValueOnce(['10000000', String(now)])
      .mockResolvedValueOnce(['10800000', String(now)]);

    const snap = await fetchOracleSnapshot('GDEADBEEF');

    expect(snap.source).toBe('oracle');
    expect(snap.quotes.XLM.priceUsd).toBeCloseTo(0.15);
    expect(snap.quotes.USDC.priceUsd).toBeCloseTo(1);
    expect(snap.quotes.EURC.priceUsd).toBeCloseTo(1.08);
    expect(callContractView).toHaveBeenCalledTimes(3);
    expect(callContractView).toHaveBeenCalledWith('GDEADBEEF', 'CONTRACT_ID', 'get_price', ['XLM', 'USDC']);
  });

  test('falls back to cache when the contract read fails', async () => {
    process.env.NEXT_PUBLIC_CURRENCY_CONVERSION_CONTRACT_ID = 'CONTRACT_ID';
    callContractView.mockRejectedValue(new Error('simulation failed'));

    const snap = await fetchOracleSnapshot('GDEADBEEF');

    expect(snap.source).toBe('cache');
    expect(snap.quotes.USDC.priceUsd).toBe(1);
  });

  test('skips contract read when no public key is connected', async () => {
    process.env.NEXT_PUBLIC_CURRENCY_CONVERSION_CONTRACT_ID = 'CONTRACT_ID';

    const snap = await fetchOracleSnapshot(null);

    expect(callContractView).not.toHaveBeenCalled();
    expect(snap.source).toBe('cache');
  });
});

describe('conversion helpers', () => {
  const rates = { XLM: 0.15, USDC: 1, EURC: 1.08 };

  test('convertAmount converts between assets via a USD pivot', () => {
    expect(convertAmount(100, 'XLM', 'USDC', rates)).toBeCloseTo(15);
    expect(convertAmount(1080, 'EURC', 'XLM', rates)).toBeCloseTo((1080 * 1.08) / 0.15);
    expect(convertAmount(50, 'USDC', 'EURC', rates)).toBeCloseTo(50 / 1.08);
    expect(convertAmount(50, 'USDC', 'USDC', rates)).toBe(50);
  });

  test('toUsdAmount converts a single asset to USD', () => {
    expect(toUsdAmount(100, 'XLM', rates)).toBeCloseTo(15);
    expect(toUsdAmount(320, 'EURC', rates)).toBeCloseTo(345.6);
  });

  test('convertAmount handles a zero target rate safely', () => {
    expect(convertAmount(100, 'XLM', 'USDC', { ...rates, USDC: 0 })).toBe(0);
  });
});

describe('rate-at-spend-time conversion (cross-asset budgets)', () => {
  test('convertAtRate uses the rates captured at spend time, not current rates', async () => {
    const current = await fetchOracleSnapshot();

    // Simulate a spend that happened when XLM was worth $0.30 (today it is $0.15)
    const spendTimeSnapshot: OracleSnapshot = {
      ...current,
      quotes: buildQuotes(
        { XLM: { priceUsd: 0.3, timestamp: 1_700_000_000 } },
        1_700_000_000,
      ),
    };
    const atSpend = captureRateSnapshot(spendTimeSnapshot, 1_700_000_000);

    // A 100 XLM spend tracked against a USDC-denominated budget:
    // converted with the rate in effect at spend time => $30
    const convertedAtSpendTime = convertAtRate(100, 'XLM', 'USDC', atSpend);
    expect(convertedAtSpendTime).toBeCloseTo(30);

    // ...and must NOT be silently revalued with the current $0.15 rate
    const currentConversion = convertAmount(100, 'XLM', 'USDC', getRateMap(current));
    expect(currentConversion).toBeCloseTo(15);
    expect(convertedAtSpendTime).not.toBeCloseTo(currentConversion);
  });

  test('captureRateSnapshot freezes the rate map at a point in time', async () => {
    const snapshot = await fetchOracleSnapshot();
    const frozen = captureRateSnapshot(snapshot, 1234);

    expect(frozen.capturedAt).toBe(1234);
    expect(frozen.rates.XLM).toBe(snapshot.quotes.XLM.priceUsd);
    expect(frozen.rates).toEqual(getRateMap(snapshot));
  });
});

describe('computeIsStale', () => {
  test('is a pure threshold comparison', () => {
    expect(computeIsStale(1000, 900, 200)).toBe(false);
    expect(computeIsStale(1000, 700, 200)).toBe(true);
    expect(computeIsStale(1000, null, 200)).toBe(true);
    expect(computeIsStale(1000, 1000, 0)).toBe(false);
  });
});
